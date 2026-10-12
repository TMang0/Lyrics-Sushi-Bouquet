"""Word-level lyric timing for Untitled Bounce2.wav using faster-whisper."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "src" / "assets" / "Untitled Bounce2.wav"
OUTPUT = ROOT / "tools" / "lyric-words.json"
MODEL_SIZE = sys.argv[1] if len(sys.argv) > 1 else "small"


def load_audio(path: Path) -> np.ndarray:
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
        check=True,
        capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def main() -> None:
    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        load_audio(AUDIO),
        language="en",
        word_timestamps=True,
        vad_filter=False,
        beam_size=5,
    )

    words = []
    for segment in segments:
        for word in segment.words or []:
            words.append({
                "word": word.word.strip(),
                "start": round(word.start, 2),
                "end": round(word.end, 2),
                "probability": round(word.probability, 2),
            })

    OUTPUT.write_text(json.dumps(words, indent=2, ensure_ascii=False))
    print(f"model={MODEL_SIZE} duration={info.duration:.2f}s words={len(words)}")
    for entry in words:
        print(f"{entry['start']:6.2f} - {entry['end']:6.2f}  {entry['word']}")


if __name__ == "__main__":
    main()
