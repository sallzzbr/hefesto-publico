"""Tests for extrair_audio.py."""
import subprocess
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from extrair_audio import extract_audio, build_ffmpeg_cmd


def test_build_ffmpeg_cmd_wav():
    cmd = build_ffmpeg_cmd("video.mkv", "output.wav")
    assert cmd[0] == "ffmpeg"
    assert "-i" in cmd
    assert "video.mkv" in cmd
    assert "output.wav" in cmd
    assert "-ar" in cmd
    idx = cmd.index("-ar")
    assert cmd[idx + 1] == "16000"
    assert "-ac" in cmd
    idx = cmd.index("-ac")
    assert cmd[idx + 1] == "1"


def test_build_ffmpeg_cmd_default_output():
    cmd = build_ffmpeg_cmd("aula.mkv", None)
    assert cmd[-1] == "aula.wav"


def test_build_ffmpeg_cmd_mp3():
    cmd = build_ffmpeg_cmd("aula.mkv", "aula.mp3", fmt="mp3")
    assert "libmp3lame" in cmd
    assert cmd[-1] == "aula.mp3"


def test_extract_audio_file_not_found():
    import pytest
    with pytest.raises(FileNotFoundError):
        extract_audio("/nonexistent/video.mkv")


@patch("extrair_audio.subprocess.run")
def test_extract_audio_calls_ffmpeg(mock_run):
    with tempfile.NamedTemporaryFile(suffix=".mkv", delete=False) as f:
        tmp = Path(f.name)
    try:
        mock_run.return_value = MagicMock(returncode=0)
        result = extract_audio(str(tmp))
        assert mock_run.called
        assert result == str(tmp.with_suffix(".wav"))
    finally:
        tmp.unlink(missing_ok=True)
