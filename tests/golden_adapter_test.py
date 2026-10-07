import sys
import json
from pathlib import Path

# Add converter to sys.path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root / "converter"))

from serum2vital import web_adapter

def test_all_fixtures():
    fixtures_dir = repo_root / "tests" / "fixtures"
    fixtures = list(fixtures_dir.glob("*.fxp")) + list(fixtures_dir.glob("*.SerumPreset"))
    assert len(fixtures) >= 5, f"Expected at least 5 fixtures, found {len(fixtures)}"

    print(f"Running golden tests on {len(fixtures)} fixtures...")

    for fix in fixtures:
        data = fix.read_bytes()
        res = web_adapter.convert_file(data, fix.name)

        assert res["success"] is True, f"Conversion failed for {fix.name}: {res.get('errors')}"
        assert res["output_bytes"] is not None, f"No output bytes for {fix.name}"
        assert res["output_filename"].endswith(".vital"), f"Expected .vital extension, got {res['output_filename']}"
        assert len(res["errors"]) == 0, f"Unexpected errors for {fix.name}: {res['errors']}"

        # Vital presets are UTF-8 JSON
        vital_json = json.loads(res["output_bytes"].decode("utf-8"))

        assert "settings" in vital_json, f"Vital preset missing 'settings' for {fix.name}"
        assert "preset_name" in vital_json, f"Vital preset missing 'preset_name' for {fix.name}"
        assert "synth_version" in vital_json, f"Vital preset missing 'synth_version' for {fix.name}"
        assert vital_json["synth_version"] == "1.5.5"

        settings = vital_json["settings"]
        assert len(settings) > 700, f"Vital preset has too few parameters ({len(settings)}) for {fix.name}"
        assert "lfos" in settings and len(settings["lfos"]) == 8
        assert "wavetables" in settings and len(settings["wavetables"]) == 3
        assert "modulations" in settings and len(settings["modulations"]) == 64

        print(f"  [PASS] {fix.name} -> {res['output_filename']} ({len(settings)} params, {len(res['warnings'])} warnings)")

def test_missing_resource_warning():
    fix = repo_root / "tests" / "fixtures" / "00 init.fxp"
    data = fix.read_bytes()
    res = web_adapter.convert_file(data, fix.name, resources={})
    assert res["success"] is True
    assert isinstance(res["warnings"], list)
    print("  [PASS] Missing resource test passed")

def test_invalid_file_rejection():
    invalid_fix = repo_root / "tests" / "fixtures" / "invalid.txt"
    data = invalid_fix.read_bytes()
    res = web_adapter.convert_file(data, invalid_fix.name)
    assert res["success"] is False, "Expected conversion to fail for invalid.txt"
    assert res["output_bytes"] is None, "Expected no output bytes for invalid.txt"
    assert len(res["errors"]) > 0, "Expected error message for invalid.txt"
    print(f"  [PASS] Invalid file rejection passed: {res['errors'][0]}")

if __name__ == "__main__":
    test_all_fixtures()
    test_missing_resource_warning()
    test_invalid_file_rejection()
    print("ALL GOLDEN & ERROR HANDLING TESTS PASSED SUCCESSFULLY!")
