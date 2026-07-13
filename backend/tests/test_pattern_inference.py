"""Unit tests for pure-Python barcode pattern inference (no DB required)."""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.barcode.inference import InferenceError, infer_pattern  # noqa: E402

TI_SAMPLES = [
    "1PTPS54331DRCR1T30009D2024W15",
    "1PLM358DR1T15009D2023W44",
    "1PSN74LVC1G08DBVR1T50009D2024W02",
]
TI_LABELS = {"vendor_pn": "TPS54331DRCR", "qty": "3000", "lot_code": "2024W15"}


def test_ti_style_inference_matches_all_samples():
    result = infer_pattern(TI_SAMPLES, TI_LABELS)
    assert result["field_mapping"] == {
        "vendor_pn": "vendor_pn",
        "qty": "qty",
        "lot_code": "lot_code",
    }
    assert len(result["previews"]) == 3
    assert result["previews"][0]["parsed"]["vendor_pn"] == "TPS54331DRCR"
    assert result["previews"][1]["parsed"]["qty"] == "1500"
    assert result["previews"][2]["parsed"]["lot_code"] == "2024W02"


def test_single_sample_uses_exact_lengths():
    result = infer_pattern([TI_SAMPLES[0]], TI_LABELS)
    assert "{12}" in result["regex_rule"]  # vendor_pn fixed length


def test_value_not_found_raises():
    with pytest.raises(InferenceError, match="找不到"):
        infer_pattern(TI_SAMPLES, {"vendor_pn": "NOT-IN-SAMPLE"})


def test_ambiguous_duplicate_value_raises():
    with pytest.raises(InferenceError, match="出現"):
        infer_pattern(["AA123AA456"], {"vendor_pn": "AA"})


def test_inconsistent_sample_raises():
    with pytest.raises(InferenceError, match="不一致"):
        infer_pattern(
            ["1PTPS543311T3000", "TOTALLY-DIFFERENT"], {"vendor_pn": "TPS54331"}
        )


def test_adjacent_fields_without_separator_raises():
    with pytest.raises(InferenceError, match="固定分隔"):
        infer_pattern(["ABC1234"], {"vendor_pn": "ABC", "qty": "1234"})


def test_no_labels_raises():
    with pytest.raises(InferenceError, match="標註"):
        infer_pattern(TI_SAMPLES, {})


def test_delimited_format():
    samples = ["VND-A100-Q50-L2024", "VND-B7-Q1200-L2025"]
    result = infer_pattern(
        samples, {"vendor_pn": "A100", "qty": "50", "lot_code": "2024"}
    )
    assert result["previews"][1]["parsed"] == {
        "vendor_pn": "B7",
        "qty": "1200",
        "lot_code": "2025",
    }
