"""Web Adapter for serum2vital.

Provides in-memory, bytes-based conversion API for browser execution via Pyodide.
Accepts raw byte arrays and resource dictionaries, returns structured results.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from . import categorize, mapping, serum1, serum2, wavetables, writer

_UNSAFE_FILENAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]+')


def detect_format(data: bytes, filename: str = "") -> str:
    """Detect whether `data` is a Serum 1 (.fxp), Serum 2 (.SerumPreset), or unknown.

    Validates structural headers, not just extension.
    """
    if len(data) >= 20 and data[:4] == b"CcnK" and data[8:12] == b"FPCh" and data[16:20] == serum1.PLUGIN_ID:
        return "serum1"

    if data.startswith(serum2.MAGIC):
        return "serum2"

    # Fallback to extension check if magic wasn't matched at offset 0
    lower_fn = filename.lower()
    if lower_fn.endswith(".fxp") and len(data) >= 4 and data[:4] == b"CcnK":
        return "serum1"
    if lower_fn.endswith((".serumpreset", ".serum_preset")):
        return "serum2"

    return "unknown"


def _find_resource(resources: dict[str, bytes], reference: str) -> bytes | None:
    """Case-insensitive and basename-tolerant lookup in the resources dictionary."""
    if not resources or not reference:
        return None

    # Exact match
    if reference in resources:
        return resources[reference]

    # Lowercase match
    ref_lower = reference.lower()
    for k, v in resources.items():
        if k.lower() == ref_lower:
            return v

    # Stem / Basename match
    clean_ref = reference.replace("\\", "/").split("/")[-1].lower()
    ref_stem = Path(clean_ref).stem.lower()
    for k, v in resources.items():
        clean_k = k.replace("\\", "/").split("/")[-1].lower()
        if clean_k == clean_ref or Path(clean_k).stem.lower() == ref_stem:
            return v

    return None


def _classify_notes(notes: list[str]) -> tuple[list[str], list[str], list[str]]:
    """Split converter notes into warnings, approximations, and unsupported features."""
    warnings: list[str] = []
    approximations: list[str] = []
    unsupported: list[str] = []

    approx_keywords = ("approx", "closest", "linearized", "scaled", "mapped to", "tuned")
    unsupported_keywords = ("unsupported", "not supported", "omitted", "ignored", "no equivalent")

    for note in notes:
        lower = note.lower()
        if any(kw in lower for kw in unsupported_keywords):
            unsupported.append(note)
        elif any(kw in lower for kw in approx_keywords):
            approximations.append(note)
        else:
            warnings.append(note)

    return warnings, approximations, unsupported


def convert_file(
    input_bytes: bytes,
    filename: str,
    resources: dict[str, bytes] | None = None,
    options: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Convert a Serum preset (in-memory bytes) to Vital.

    Args:
        input_bytes: Raw bytes of .fxp or .SerumPreset file
        filename: Original filename (used for format detection & default naming)
        resources: Dict of {filename: bytes} for wavetables/noise samples
        options: Optional settings:
            - max_frames (int, default 64)
            - max_sample_seconds (float, default 4.0)
            - include_wavetables (bool, default True)
            - include_samples (bool, default True)

    Returns:
        Structured result dictionary.
    """
    if options is None:
        options = {}
    if resources is None:
        resources = {}

    max_frames = options.get("max_frames", wavetables.DEFAULT_FRAME_LIMIT)
    max_sample_seconds = options.get("max_sample_seconds", 4.0)
    include_wavetables = options.get("include_wavetables", True)
    include_samples = options.get("include_samples", True)

    fmt = detect_format(input_bytes, filename)
    if fmt == "unknown":
        return {
            "success": False,
            "filename": filename,
            "output_filename": "",
            "output_bytes": None,
            "vital_json": None,
            "name": "",
            "author": "",
            "category": [],
            "warnings": [],
            "approximations": [],
            "unsupported": [],
            "errors": [f"Unrecognized or invalid Serum preset format: {filename}"],
        }

    try:
        if fmt == "serum1":
            patch = serum1.read_bytes(input_bytes, filename=filename)
            conv = mapping.convert_serum1(patch)
            bank = patch.menu
            tags: list[str] = []
        else:
            if "serum2_state" in options and "serum2_meta" in options:
                meta = options["serum2_meta"]
                state = options["serum2_state"]
                stem = Path(filename).stem if filename else ""
                patch = serum2.Serum2Patch(
                    name=str(meta.get("presetName") or state.get("presetName") or stem or "Init"),
                    author=str(meta.get("presetAuthor") or ""),
                    description=str(meta.get("presetDescription") or ""),
                    tags=[str(t) for t in meta.get("tags", []) if isinstance(t, str)],
                    product_version=str(meta.get("productVersion") or ""),
                    meta=meta,
                    state=state,
                    source_path=filename,
                )
            else:
                patch = serum2.read_bytes(input_bytes, filename=filename)
            conv = mapping.convert_serum2(patch)
            bank = patch.description
            tags = list(patch.tags)

        # Attach wavetables
        if include_wavetables and hasattr(conv, "wavetable_refs"):
            for slot, reference in enumerate(conv.wavetable_refs):
                if not reference:
                    continue

                ref_lookup = reference
                if ref_lookup.endswith("Default Shapes.wav"):
                    ref_lookup = "saw.wav"

                builtin = wavetables.builtin_wavetable(ref_lookup)
                if builtin is not None:
                    conv.wavetables[slot] = builtin
                    continue

                res_data = _find_resource(resources, reference)
                if res_data is not None:
                    try:
                        table = wavetables.load_serum_wavetable_bytes(
                            res_data, name=Path(reference).stem
                        )
                        conv.wavetables[slot] = wavetables.wavetable_to_vital(
                            table, name=Path(reference).stem, max_keyframes=max_frames
                        )
                    except Exception as exc:
                        conv.note(f"wavetable {reference!r} failed to load: {exc}")
                else:
                    conv.note(f"wavetable {reference!r} not provided; using initialized fallback")

        # Attach noise sample
        if include_samples and getattr(conv, "sample_ref", None):
            res_data = _find_resource(resources, conv.sample_ref)
            if res_data is not None:
                try:
                    sample = wavetables.sample_bytes_to_vital(
                        res_data, name=Path(conv.sample_ref).stem, max_seconds=max_sample_seconds
                    )
                    if sample is not None:
                        conv.sample = sample
                    else:
                        conv.note(f"noise sample {conv.sample_ref!r} unreadable")
                except Exception as exc:
                    conv.note(f"noise sample {conv.sample_ref!r} error: {exc}")
            else:
                conv.note(f"noise sample {conv.sample_ref!r} not provided; using default noise")

        # Classify sound category
        category = categorize.categorize(
            conv.name, bank, filename, tags, conv.settings, notes=conv.notes
        )
        conv.category = category

        # Build Vital preset
        vital_json = writer.to_vital_json(conv)
        vital_bytes = vital_json.encode("utf-8")

        # Safe filename
        stem = _UNSAFE_FILENAME.sub("_", conv.name).strip(" ._") or Path(filename).stem or "Preset"
        output_filename = f"{stem}.vital"

        warnings, approximations, unsupported = _classify_notes(conv.notes)

        return {
            "success": True,
            "filename": filename,
            "output_filename": output_filename,
            "output_bytes": vital_bytes,
            "vital_json": vital_json,
            "name": conv.name,
            "author": conv.author,
            "category": list(category) if category else ["SYNTH", "GENERAL", "CLEAN"],
            "warnings": warnings,
            "approximations": approximations,
            "unsupported": unsupported,
            "errors": [],
        }

    except (serum1.SerumReadError, serum2.SerumReadError) as exc:
        return {
            "success": False,
            "filename": filename,
            "output_filename": "",
            "output_bytes": None,
            "vital_json": None,
            "name": "",
            "author": "",
            "category": [],
            "warnings": [],
            "approximations": [],
            "unsupported": [],
            "errors": [f"Serum read error: {exc}"],
        }
    except Exception as exc:
        return {
            "success": False,
            "filename": filename,
            "output_filename": "",
            "output_bytes": None,
            "vital_json": None,
            "name": "",
            "author": "",
            "category": [],
            "warnings": [],
            "approximations": [],
            "unsupported": [],
            "errors": [f"{type(exc).__name__}: {exc}"],
        }


def convert_file_json(
    input_bytes: bytes,
    filename: str,
    resources_json: str | None = None,
    options_json: str | None = None,
) -> str:
    """Wrapper that accepts and returns JSON strings for seamless Pyodide/JS interop."""
    resources: dict[str, bytes] = {}
    if resources_json:
        try:
            raw_map = json.loads(resources_json)
            import base64
            for k, v in raw_map.items():
                if isinstance(v, str):
                    resources[k] = base64.b64decode(v)
        except Exception:
            pass

    options: dict[str, Any] = {}
    if options_json:
        try:
            options = json.loads(options_json)
        except Exception:
            pass

    result = convert_file(input_bytes, filename, resources=resources, options=options)

    serializable = dict(result)
    if serializable.get("output_bytes") is not None:
        import base64
        serializable["output_base64"] = base64.b64encode(serializable["output_bytes"]).decode("ascii")
        del serializable["output_bytes"]

    return json.dumps(serializable)