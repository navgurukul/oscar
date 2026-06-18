"""Stage 3 inference — runs the corpus through CTranslate2 (Faster-Whisper)
and writes the transcripts into corpus/transcripts.json under
`transcripts.ct2_int8` and `transcripts.ct2_int8_float16`.

We use two model families to mirror Oscar's actual variant routing:

  - en + hi    → Systran/faster-whisper-large-v3-turbo (auto-downloaded;
                 pre-converted to CT2 by the Systran team, no manual
                 conversion needed)
  - hi-en      → ./models/oriserve-apex-ct2-int8/  (produced locally by
                 convert_oriserve.py; standard Whisper has no Hinglish-
                 tuned variant, so Oscar uses Oriserve here)

For each `quantization` in {int8, int8_float16} we run all three samples
and record the result. After this you can re-run `python wer.py` and see
baseline vs CT2 numbers side-by-side.

ffmpeg must be on PATH for m4a / wav decoding (Faster-Whisper requires it).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:
    sys.exit("faster_whisper not installed. Run: pip install -r requirements.txt")

CORPUS_DIR = Path(__file__).parent / "corpus"
TRANSCRIPTS_PATH = CORPUS_DIR / "transcripts.json"
MODELS_DIR = Path(__file__).parent / "models"

# Quantizations we benchmark. int8 is the target per Souvik's plan;
# int8_float16 is the documented fallback if int8 hurts Hinglish quality.
QUANTIZATIONS = ["int8", "int8_float16"]

# Maps language code → (model spec, kwargs for transcribe). For en/hi we
# point at the Systran CT2-converted Whisper turbo (auto-downloaded from
# HuggingFace). For hi-en we point at our locally converted Oriserve model.
GENERAL_MODEL_ID = "Systran/faster-whisper-large-v3-turbo"


def oriserve_path(quantization: str) -> Path:
    return MODELS_DIR / f"oriserve-apex-ct2-{quantization}"


def load_corpus() -> dict:
    if not TRANSCRIPTS_PATH.exists():
        sys.exit(f"transcripts.json not found at {TRANSCRIPTS_PATH}")
    with TRANSCRIPTS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def save_corpus(data: dict) -> None:
    with TRANSCRIPTS_PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def transcribe(model: WhisperModel, audio_path: Path, language: str) -> str:
    # `task="transcribe"` (default) + an explicit `language` is what Oscar
    # passes today via Whisper. Hinglish (`hi-en`) isn't a Whisper language
    # code, so we tell Whisper the audio is `en` (matches Oscar's
    # getWhisperLanguage hi-en → en mapping in lib/whisper.ts).
    whisper_lang = "en" if language == "hi-en" else language
    segments, _info = model.transcribe(
        str(audio_path),
        language=whisper_lang,
        beam_size=5,
        vad_filter=False,
    )
    return " ".join(s.text.strip() for s in segments).strip()


def run_for_quantization(corpus: dict, quantization: str) -> None:
    print(f"\n== Quantization: {quantization} ==")

    print(f"  Loading general model ({GENERAL_MODEL_ID}) [{quantization}]…")
    general_model = WhisperModel(
        GENERAL_MODEL_ID,
        device="cpu",
        compute_type=quantization,
    )

    oriserve_dir = oriserve_path(quantization)
    oriserve_model = None
    if oriserve_dir.exists() and any(oriserve_dir.iterdir()):
        print(f"  Loading Oriserve model ({oriserve_dir.name}) [{quantization}]…")
        oriserve_model = WhisperModel(
            str(oriserve_dir),
            device="cpu",
            compute_type=quantization,
        )
    else:
        print(f"  [warn] {oriserve_dir} not found — Hinglish sample will skip this engine.")
        print(f"         Run `python convert_oriserve.py` first.")

    field_name = f"ct2_{quantization}"

    for sample in corpus.get("samples", []):
        audio_path = CORPUS_DIR / sample["audio"]
        if not audio_path.exists():
            print(f"  [skip] {sample['id']}: audio missing at {audio_path}")
            continue

        language = sample.get("language", "en")
        model = oriserve_model if language == "hi-en" else general_model
        if model is None:
            print(f"  [skip] {sample['id']}: no model loaded for language {language}")
            continue

        print(f"  Transcribing {sample['id']} ({language})…")
        text = transcribe(model, audio_path, language)
        sample.setdefault("transcripts", {})[field_name] = text
        print(f"    → {text[:80]}{'…' if len(text) > 80 else ''}")


def main() -> int:
    corpus = load_corpus()

    for q in QUANTIZATIONS:
        run_for_quantization(corpus, q)

    save_corpus(corpus)
    print(f"\n✅ Wrote transcripts back to {TRANSCRIPTS_PATH}")
    print("Next: python wer.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
