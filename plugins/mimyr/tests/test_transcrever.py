"""Tests for transcrever.py — formatting logic only (no GPU needed)."""
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from transcrever import format_time, format_transcript


def test_format_time_zero():
    assert format_time(0.0) == "00:00:00"


def test_format_time_seconds():
    assert format_time(45.7) == "00:00:45"


def test_format_time_minutes():
    assert format_time(125.0) == "00:02:05"


def test_format_time_hours():
    assert format_time(3661.0) == "01:01:01"


def test_format_transcript_basic():
    result = {
        "segments": [
            {"start": 0.0, "end": 5.0, "text": " Oi pessoal!"},
            {"start": 5.0, "end": 12.0, "text": " Vamos falar sobre APIs."},
        ]
    }
    output = format_transcript(result, model_name="large-v3")
    assert "# Transcrição" in output
    assert "large-v3" in output
    assert "[00:00:00 → 00:00:05] Oi pessoal!" in output
    assert "[00:00:05 → 00:00:12] Vamos falar sobre APIs." in output


def test_format_transcript_strips_whitespace():
    result = {
        "segments": [
            {"start": 0.0, "end": 3.0, "text": "  texto com espacos  "},
        ]
    }
    output = format_transcript(result)
    assert "texto com espacos" in output
    assert "  texto" not in output
