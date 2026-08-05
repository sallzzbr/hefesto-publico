#!/usr/bin/env python3
"""Extract audio from video files using ffmpeg.

Usage:
    python extrair_audio.py <video_path> [output_path]

Extracts audio as 16kHz mono WAV (optimized for Whisper).
"""
import subprocess
import sys
from pathlib import Path
from typing import Optional


def build_ffmpeg_cmd(video_path: str, output_path: Optional[str], fmt: str = "wav") -> list[str]:
    """Build the ffmpeg command list."""
    if output_path is None:
        output_path = str(Path(video_path).with_suffix(f".{fmt}"))

    codec = "pcm_s16le" if fmt == "wav" else "libmp3lame"

    return [
        "ffmpeg", "-i", video_path,
        "-vn",
        "-acodec", codec,
        "-ar", "16000",
        "-ac", "1",
        "-y",
        output_path,
    ]


def extract_audio(video_path: str, output_path: Optional[str] = None, fmt: str = "wav") -> str:
    """Extract audio track from a video file.

    Args:
        video_path: Path to .mkv or .mp4 file.
        output_path: Where to save audio. Defaults to same name with .wav extension.
        fmt: Output format — "wav" (default, best for Whisper) or "mp3".

    Returns:
        Path to the extracted audio file.
    """
    video = Path(video_path)
    if not video.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    cmd = build_ffmpeg_cmd(str(video), output_path, fmt)
    if output_path is None:
        output_path = cmd[-1]

    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extrair_audio.py <video_path> [output_path]")
        sys.exit(1)

    result = extract_audio(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(f"Audio extracted: {result}")
