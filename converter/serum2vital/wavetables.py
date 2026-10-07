"""Serum wavetables, noise samples and LFO curves -> Vital JSON fragments.

Serum and Vital store wavetables differently:

  * Serum wavetables are single-file WAVs with a custom ``clm `` chunk stating
    the single-cycle frame size (always 2048 samples for modern tables).  The
    file holds up to 256 such frames end-to-end.
  * Vital presets embed their wavetables inline as a JSON structure.  Each keyframe
    carries a base64-encoded float32 PCM block (always 2048 floats), and Vital
    interpolates between keyframe positions (0..255).

When Serum presets use one of the builtin single-cycle shapes (Sine, Triangle,
Saw, Square) that aren't on disk, we synthesize a single-cycle Vital table so
the oscillator still sounds identical.
"""

from __future__ import annotations

import base64
import math
import struct
from dataclasses import dataclass
from pathlib import Path

VITAL_FRAME_SIZE = 2048
VITAL_MAX_POSITION = 256
DEFAULT_FRAME_LIMIT = 64

# Serum LFO vertical range is 0..240 in .shp files and normalized 0..1 in presets.
# Vital LFO powers range roughly -20..+20.
LFO_POWER_SCALE = 12.0


class WavetableError(Exception):
    """Raised when a Serum wavetable/sample cannot be read."""


@dataclass
class SerumWavetable:
    name: str
    frames: list[list[float]]
    frame_size: int


def read_wav_bytes(data: bytes, name: str = "") -> tuple[list[float], int, int, int]:
    """Return (interleaved samples as float, channels, sample_rate, frame_size)."""
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise WavetableError(f"{name or 'data'}: not a RIFF/WAVE file")

    fmt = None
    audio = b""
    frame_size = 0
    offset = 12
    while offset + 8 <= len(data):
        chunk_id = data[offset : offset + 4]
        size = struct.unpack_from("<I", data, offset + 4)[0]
        body = data[offset + 8 : offset + 8 + size]
        if chunk_id == b"fmt ":
            fmt = struct.unpack_from("<HHIIHH", body, 0)
        elif chunk_id == b"data":
            audio = body
        elif chunk_id == b"clm ":
            text = body.decode("latin-1", "replace")
            if text.startswith("<!>"):
                head = text[3:].split()
                if head and head[0].isdigit():
                    frame_size = int(head[0])
        offset += 8 + size + (size & 1)

    if fmt is None or not audio:
        raise WavetableError(f"{name or 'data'}: missing fmt/data chunk")

    audio_format, channels, sample_rate, _, _, bits = fmt
    if audio_format == 3 and bits == 32:
        count = len(audio) // 4
        samples = list(struct.unpack_from("<%df" % count, audio, 0))
    elif audio_format == 1 and bits == 16:
        count = len(audio) // 2
        samples = [v / 32768.0 for v in struct.unpack_from("<%dh" % count, audio, 0)]
    elif audio_format == 1 and bits == 24:
        count = len(audio) // 3
        samples = []
        for i in range(count):
            chunk = audio[i * 3 : i * 3 + 3]
            value = int.from_bytes(chunk, "little", signed=True)
            samples.append(value / 8388608.0)
    elif audio_format == 1 and bits == 32:
        count = len(audio) // 4
        samples = [v / 2147483648.0 for v in struct.unpack_from("<%di" % count, audio, 0)]
    else:
        raise WavetableError(f"{name or 'data'}: unsupported format {audio_format}/{bits}-bit")

    return samples, max(channels, 1), sample_rate, frame_size


def _read_wav(path: Path) -> tuple[list[float], int, int, int]:
    """Return (interleaved samples as float, channels, sample_rate, frame_size)."""
    return read_wav_bytes(path.read_bytes(), name=path.name)


def load_serum_wavetable_bytes(data: bytes, name: str = "Init") -> SerumWavetable:
    """Split a Serum wavetable WAV buffer into single-cycle frames."""
    samples, channels, _sample_rate, declared = read_wav_bytes(data, name=name)
    if channels > 1:
        samples = samples[::channels]

    frame_size = declared or VITAL_FRAME_SIZE
    if frame_size <= 0 or len(samples) < frame_size:
        frame_size = max(1, len(samples))

    frames = [
        samples[i : i + frame_size]
        for i in range(0, len(samples) - frame_size + 1, frame_size)
    ]
    if not frames:
        raise WavetableError(f"{name}: no complete frames")
    return SerumWavetable(name=name, frames=frames, frame_size=frame_size)


def load_serum_wavetable(path: str | Path) -> SerumWavetable:
    """Split a Serum wavetable WAV into single-cycle frames."""
    path = Path(path)
    return load_serum_wavetable_bytes(path.read_bytes(), name=path.stem)


def _resample_frame(frame: list[float], size: int = VITAL_FRAME_SIZE) -> list[float]:
    """Linearly resample one cycle to Vital's 2048-sample frame."""
    if len(frame) == size:
        return frame
    source_len = len(frame)
    out = []
    for i in range(size):
        position = i * source_len / size
        low = int(position)
        frac = position - low
        a = frame[low % source_len]
        b = frame[(low + 1) % source_len]
        out.append(a + (b - a) * frac)
    return out


def _encode_frame(frame: list[float]) -> str:
    packed = struct.pack("<%df" % VITAL_FRAME_SIZE, *_resample_frame(frame))
    return base64.b64encode(packed).decode("ascii")


def wavetable_to_vital(
    table: SerumWavetable,
    name: str | None = None,
    max_keyframes: int = DEFAULT_FRAME_LIMIT,
) -> dict:
    """Build the Vital wavetable object for one oscillator slot."""
    total = len(table.frames)
    if total <= max_keyframes:
        indices = list(range(total))
    else:
        indices = sorted({round(i * (total - 1) / (max_keyframes - 1)) for i in range(max_keyframes)})

    keyframes = []
    for slot, frame_index in enumerate(indices):
        if len(indices) == 1:
            position = 0
        else:
            position = round(slot * VITAL_MAX_POSITION / (len(indices) - 1))
        keyframes.append(
            {"position": position, "wave_data": _encode_frame(table.frames[frame_index])}
        )

    return {
        "author": "",
        "full_normalize": False,
        "groups": [
            {
                "components": [
                    {
                        "interpolation": 0,
                        "interpolation_style": 1,
                        "keyframes": keyframes,
                        "type": "Wave Source",
                    }
                ]
            }
        ],
        "name": name or table.name,
        "remove_all_dc": False,
        "version": "1.5.5",
    }


def _builtin_shape(kind: str) -> list[float]:
    """Synthesize one 2048-sample cycle of a standard oscillator waveform."""
    n = VITAL_FRAME_SIZE
    if kind == "sine":
        return [math.sin(2.0 * math.pi * i / n) for i in range(n)]
    if kind == "triangle":
        return [1.0 - 4.0 * abs(i / n - 0.5) for i in range(n)]
    if kind == "saw":
        return [1.0 - 2.0 * (i / n) for i in range(n)]
    if kind == "square":
        return [1.0 if i < n // 2 else -1.0 for i in range(n)]
    if kind == "pulse25":
        return [1.0 if i < n // 4 else -1.0 for i in range(n)]
    return [0.0] * n


_BUILTIN_MAP: dict[str, str] = {
    "sine": "sine",
    "sin": "sine",
    "triangle": "triangle",
    "tri": "triangle",
    "saw": "saw",
    "sawtooth": "saw",
    "square": "square",
    "pulse": "square",
    "basic shapes": "sine",
}


def builtin_wavetable(reference: str) -> dict | None:
    """Return a Vital wavetable object if `reference` names a factory shape."""
    cleaned = reference.lower().replace("\\", "/").split("/")[-1]
    stem = Path(cleaned).stem.lower()
    kind = _BUILTIN_MAP.get(stem)
    if kind is None:
        return None
    frame = _builtin_shape(kind)
    return {
        "author": "",
        "full_normalize": False,
        "groups": [
            {
                "components": [
                    {
                        "interpolation": 0,
                        "interpolation_style": 0,
                        "keyframes": [{"position": 0, "wave_data": _encode_frame(frame)}],
                        "type": "Wave Source",
                    }
                ]
            }
        ],
        "name": reference.split("/")[-1],
        "remove_all_dc": False,
        "version": "1.5.5",
    }


def default_wavetable(name: str = "Init") -> dict:
    """A single-frame sine wavetable, used when the Serum table can't be found."""
    frame = [math.sin(2.0 * math.pi * i / VITAL_FRAME_SIZE) for i in range(VITAL_FRAME_SIZE)]
    return {
        "author": "",
        "full_normalize": False,
        "groups": [
            {
                "components": [
                    {
                        "interpolation": 0,
                        "interpolation_style": 0,
                        "keyframes": [{"position": 0, "wave_data": _encode_frame(frame)}],
                        "type": "Wave Source",
                    }
                ]
            }
        ],
        "name": name,
        "remove_all_dc": False,
        "version": "1.5.5",
    }


def sample_bytes_to_vital(data: bytes, name: str = "Sample", max_seconds: float = 4.0) -> dict | None:
    """Convert a Serum noise/sample WAV bytes buffer into Vital's `sample` object (16-bit PCM)."""
    try:
        samples, channels, sample_rate, _ = read_wav_bytes(data, name=name)
    except WavetableError:
        return None

    left = samples[::channels] if channels > 1 else samples
    right = samples[1::channels] if channels > 1 else None

    limit = int(sample_rate * max_seconds)
    left = left[:limit]
    if right is not None:
        right = right[:limit]

    def encode(values: list[float]) -> str:
        pcm = struct.pack(
            "<%dh" % len(values),
            *[max(-32768, min(32767, int(round(v * 32767.0)))) for v in values],
        )
        return base64.b64encode(pcm).decode("ascii")

    data_obj = {
        "name": name,
        "length": len(left),
        "sample_rate": sample_rate,
        "samples": encode(left),
    }
    if right is not None and len(right) == len(left):
        data_obj["samples_stereo"] = encode(right)
    return data_obj


def sample_to_vital(path: str | Path, name: str | None = None, max_seconds: float = 4.0) -> dict | None:
    """Convert a Serum noise/sample WAV into Vital's `sample` object (16-bit PCM)."""
    path = Path(path)
    return sample_bytes_to_vital(path.read_bytes(), name=name or path.stem, max_seconds=max_seconds)


def lfo_to_vital(shape, name: str = "Serum", invert_y: bool = True, close_loop: bool = False,
                 power_sign: float = 1.0) -> dict:
    """Convert a :class:`serum1.LfoShape` into Vital's LFO curve object."""
    xs = list(shape.xs)
    ys = list(shape.ys)
    curves = list(shape.curves)

    if not xs or not ys:
        return {
            "name": name,
            "num_points": 3,
            "points": [0.0, 1.0, 0.5, 0.0, 1.0, 1.0],
            "powers": [0.0, 0.0, 0.0],
            "smooth": False,
        }

    if xs[0] > 0.0:
        xs.insert(0, 0.0)
        ys.insert(0, ys[0])
        curves.insert(0, 0.5)
    if xs[-1] < 1.0:
        xs.append(1.0)
        ys.append(ys[0] if close_loop else ys[-1])
        curves.append(0.5)
    elif close_loop:
        ys[-1] = ys[0]

    if len(xs) < 2:
        return {
            "name": name,
            "num_points": 3,
            "points": [0.0, 1.0, 0.5, 0.0, 1.0, 1.0],
            "powers": [0.0, 0.0, 0.0],
            "smooth": False,
        }

    points: list[float] = []
    for x, y in zip(xs, ys):
        points.append(max(0.0, min(1.0, x)))
        points.append(max(0.0, min(1.0, 1.0 - y if invert_y else y)))

    powers = []
    for i in range(len(xs)):
        curve = curves[i] if i < len(curves) else 0.5
        powers.append(max(-20.0, min(20.0, power_sign * (curve - 0.5) * 2.0 * LFO_POWER_SCALE)))

    return {
        "name": name,
        "num_points": len(xs),
        "points": points,
        "powers": powers,
        "smooth": False,
    }


def read_shp_bytes(blob: bytes, name: str = ""):
    """Read standalone Serum .shp bytes."""
    from .serum1 import LfoShape

    if len(blob) < 2048 + 4:
        raise WavetableError(f"{name or 'data'}: too short for a .shp file")

    values = struct.unpack_from("<256d", blob, 0)
    count = struct.unpack_from("<I", blob, 2048)[0]

    curves = list(values[0:64])
    xs = [v / 388.0 for v in values[64:128]]
    ys = [v / 240.0 for v in values[128:192]]

    end = len(xs)
    for i, x in enumerate(xs):
        if x >= 1.0 - 1e-9:
            end = i + 1
            break
    end = max(end, min(count, len(xs)))

    return LfoShape(xs=xs[:end], ys=ys[:end], curves=curves[: max(end - 1, 1)])


def read_shp(path: str | Path):
    """Read a standalone Serum ``.shp`` LFO shape file."""
    path = Path(path)
    return read_shp_bytes(path.read_bytes(), name=path.name)