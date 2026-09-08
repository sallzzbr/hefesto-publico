#!/usr/bin/env python3
"""Transcribe audio files using Whisper (local GPU).

Usage:
    python transcrever.py <audio_path> [output_path] [--model large-v3]

Outputs a Markdown file with timestamped transcript.
"""
import argparse
import sys
from pathlib import Path


def format_time(seconds: float) -> str:
    """Convert seconds to HH:MM:SS format."""
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def format_transcript(result: dict, model_name: str = "whisper") -> str:
    """Format Whisper result dict into readable Markdown."""
    lines = [
        "# Transcrição\n",
        f"**Modelo:** {model_name}",
        f"**Idioma:** pt\n",
        "---\n",
    ]
    for segment in result["segments"]:
        start = format_time(segment["start"])
        end = format_time(segment["end"])
        text = segment["text"].strip()
        lines.append(f"[{start} → {end}] {text}\n")

    return "\n".join(lines)


def transcribe(audio_path: str, model_name: str = "large-v3") -> dict:
    """Transcribe an audio file using Whisper.

    Args:
        audio_path: Path to .wav or .mp3 file.
        model_name: Whisper model size (tiny, base, small, medium, large-v3).

    Returns:
        Whisper result dict with segments.
    """
    import whisper

    audio = Path(audio_path)
    if not audio.exists():
        raise FileNotFoundError(f"Audio not found: {audio_path}")

    print(f"Loading model '{model_name}'...")
    model = whisper.load_model(model_name)
    print(f"Transcribing {audio.name}...")
    result = model.transcribe(str(audio), language="pt", verbose=False)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Transcribe audio with Whisper")
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument("output_path", nargs="?", help="Output .md path (default: same name)")
    parser.add_argument("--model", default="large-v3", help="Whisper model (default: large-v3)")
    args = parser.parse_args()

    output = args.output_path or str(Path(args.audio_path).with_suffix(".md"))

    result = transcribe(args.audio_path, args.model)
    transcript = format_transcript(result, model_name=args.model)
    Path(output).write_text(transcript, encoding="utf-8")
    print(f"Transcript saved: {output}")
