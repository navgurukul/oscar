"""Compute WER for the Faster-Whisper feasibility spike.

Reads `corpus/transcripts.json`, computes WER for each engine ("baseline",
"ct2_int8", "ct2_int8_float16") against `ground_truth`, broken out by
language. Prints a comparison table.

Usage:

    pip install -r requirements.txt
    python wer.py

The script is forgiving — it skips samples missing `ground_truth` (still
template placeholders) and engines missing transcripts (haven't been
collected yet). So you can run it after every step to see progress.
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

try:
    from jiwer import wer
except ImportError:
    sys.exit(
        "jiwer is not installed. Run: pip install -r requirements.txt"
    )

CORPUS_PATH = Path(__file__).parent / "corpus" / "transcripts.json"
PLACEHOLDER = "REPLACE ME"
LANGUAGE_LABEL = {"en": "English", "hi": "Hindi-Devanagari", "hi-en": "Hinglish"}


def load_corpus() -> list[dict]:
    if not CORPUS_PATH.exists():
        sys.exit(f"Corpus file not found: {CORPUS_PATH}")
    with CORPUS_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    samples = data.get("samples", [])
    return [
        s
        for s in samples
        if isinstance(s, dict)
        and s.get("ground_truth")
        and PLACEHOLDER not in s["ground_truth"]
    ]


def engines_in_corpus(samples: list[dict]) -> list[str]:
    """Order-preserving union of engine names across all samples."""
    seen: list[str] = []
    for s in samples:
        for engine in (s.get("transcripts") or {}).keys():
            if engine not in seen:
                seen.append(engine)
    return seen


def compute(samples: list[dict], engine: str) -> dict[str, tuple[int, float]]:
    """Return {language: (sample_count, wer_percent)} plus an "overall" key."""
    refs = defaultdict(list)
    hyps = defaultdict(list)
    for s in samples:
        hyp = (s.get("transcripts") or {}).get(engine)
        if not hyp:
            continue
        lang = s.get("language") or "unknown"
        refs[lang].append(s["ground_truth"])
        hyps[lang].append(hyp)
        refs["__overall__"].append(s["ground_truth"])
        hyps["__overall__"].append(hyp)
    out: dict[str, tuple[int, float]] = {}
    for lang, ref_list in refs.items():
        if not ref_list:
            continue
        out[lang] = (len(ref_list), wer(ref_list, hyps[lang]) * 100)
    return out


def fmt_row(label: str, count: int, value: float) -> str:
    return f"  {label:<22} ({count:>2} sample{'s' if count != 1 else ' '}): {value:>5.1f}% WER"


def main() -> int:
    samples = load_corpus()
    if not samples:
        print("No samples with ground_truth yet. Edit corpus/transcripts.json.")
        return 0

    engines = engines_in_corpus(samples)
    if not engines:
        print(f"{len(samples)} samples loaded but no transcripts populated yet.")
        print("Add transcripts under samples[].transcripts.<engine> in the JSON.")
        return 0

    print(f"== WER report ({len(samples)} samples loaded) ==\n")
    for engine in engines:
        bucket = compute(samples, engine)
        if not bucket:
            print(f"Engine: {engine}  (no transcripts populated)\n")
            continue
        print(f"Engine: {engine}")
        for lang in ("en", "hi", "hi-en"):
            if lang in bucket:
                count, value = bucket[lang]
                print(fmt_row(LANGUAGE_LABEL[lang], count, value))
        if "__overall__" in bucket:
            count, value = bucket["__overall__"]
            print(fmt_row("Overall", count, value))
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
