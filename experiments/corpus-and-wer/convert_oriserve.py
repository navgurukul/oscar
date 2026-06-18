"""Stage 3 setup — converts Oriserve Whisper-Hindi2Hinglish-Apex from
HuggingFace (safetensors) to CTranslate2 int8 format.

Run once. Outputs to ./models/oriserve-apex-ct2-int8/.

We also convert to int8_float16 in a second pass — kept as the fallback
quantization in case int8 craters Hinglish romanization quality (Souvik's
Stage 3 gate calls this out explicitly).

Usage:

    pip install -r requirements.txt
    python convert_oriserve.py

Disk: ~3 GB temp during conversion, ~600 MB final per quantization.
Time: 5-10 min depending on internet (model download is most of it).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ORISERVE_HF_ID = "Oriserve/Whisper-Hindi2Hinglish-Apex"
OUTPUT_ROOT = Path(__file__).parent / "models"

# We convert to both int8 (the target quantization per Souvik's plan) and
# int8_float16 (the documented fallback if int8 hurts Hinglish quality).
# Converting both upfront means we don't re-download the 3 GB HF checkpoint
# the second time — the converter caches it in ~/.cache/huggingface.
QUANTIZATIONS = ["int8", "int8_float16"]


def run_converter(quantization: str) -> bool:
    output_dir = OUTPUT_ROOT / f"oriserve-apex-ct2-{quantization}"
    if output_dir.exists() and any(output_dir.iterdir()):
        print(f"[skip] {output_dir} already populated — delete it to re-convert.")
        return True

    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ct2-transformers-converter",
        "--model", ORISERVE_HF_ID,
        "--output_dir", str(output_dir),
        "--quantization", quantization,
        "--copy_files", "tokenizer.json", "preprocessor_config.json",
        "--force",
    ]
    print(f"\n== Converting {ORISERVE_HF_ID} → {quantization} ==")
    print(" ".join(cmd))
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"[fail] ct2-transformers-converter exited {result.returncode}")
        return False
    print(f"[ok] Wrote {output_dir}")
    return True


def main() -> int:
    failed = []
    for q in QUANTIZATIONS:
        if not run_converter(q):
            failed.append(q)

    if failed:
        print(f"\n✗ Failed quantizations: {', '.join(failed)}")
        return 1

    print("\n✅ All conversions done. Outputs under: models/")
    print("   Next: python run_ct2.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
