# Corpus + WER tool — Stage 1 baseline + Stage 3 quality gate

Tiny self-contained test bench for the Faster-Whisper feasibility spike.

## What this is

We can't share Souvik's personal voice corpus, so we build our own tiny one
(10–15 short samples covering English, Hindi-Devanagari, Hinglish). Then
we run Oscar's current whisper.cpp against it to get the **Stage 1 baseline
WER**. Later, we run the CT2-converted models against the same audio to
prove (or disprove) the **Stage 3 quality gate**: "Oriserve int8 must hold
romanization quality."

## Directory layout

```
experiments/corpus-and-wer/
├── README.md                  ← this file
├── requirements.txt           ← Python deps (jiwer)
├── wer.py                     ← compute WER given a transcripts.json
└── corpus/
    ├── transcripts.json       ← ground truth + per-engine hypotheses
    └── audio/                 ← WAV files you record (gitignored)
        ├── en-01.wav
        ├── en-02.wav
        ├── hi-01.wav
        ├── hi-en-01.wav
        └── ...
```

## How to use

### 1. One-time setup

```bash
cd experiments/corpus-and-wer
python -m pip install -r requirements.txt
```

### 2. Record audio samples

Record 10–15 short WAVs (5–15 seconds each) covering:

- **5–6 English** — neutral sentences, normal speaking pace
- **3–4 Hindi-Devanagari** — pure Hindi, written in Devanagari
- **4–5 Hinglish** — code-switched (Hindi + English mixed), as you'd
  actually talk in a real meeting

Recording tool: anything that produces a WAV file. Windows Voice Recorder
works (save as WAV). Save them under `corpus/audio/`.

### 3. Write ground truth in `corpus/transcripts.json`

For each WAV, add an entry with the EXACT text you said and the language:

```json
{
  "samples": [
    {
      "id": "en-01",
      "audio": "audio/en-01.wav",
      "language": "en",
      "ground_truth": "I will send you the report by Friday afternoon.",
      "transcripts": {}
    }
  ]
}
```

`language` should be one of `en`, `hi`, `hi-en`.

### 4. Get the baseline transcript from Oscar (whisper.cpp)

For each audio sample, get Oscar's current whisper.cpp transcript. Easiest
way: play the WAV through your speakers while Oscar's Stream/Minutes is
recording, OR drag the file into a tool that calls Oscar's Whisper. Copy
the output into the matching entry under `transcripts.baseline`.

```json
{
  "id": "en-01",
  "audio": "audio/en-01.wav",
  "language": "en",
  "ground_truth": "I will send you the report by Friday afternoon.",
  "transcripts": {
    "baseline": "I'll send you the report Friday afternoon."
  }
}
```

### 5. Compute baseline WER

```bash
python wer.py
```

Output looks like:

```
== WER report ==
Engine: baseline (whisper.cpp via Oscar)

  English (6 samples):       7.4% WER
  Hindi-Devanagari (4 samples): 12.1% WER
  Hinglish (5 samples):      18.6% WER

  Overall (15 samples):      12.3% WER
```

Save this number — it's the **Stage 1 baseline**.

### 6. Later (Stage 3) — add CT2 transcripts and compare

When we have CT2-converted models, we run the same audio through them and
add `transcripts.ct2_int8` (and optionally `ct2_int8_float16`) entries to
the same JSON. `wer.py` will print a comparison table.

The **gate** is: CT2 int8 must hold romanization quality on Hinglish ≈
baseline (±2% absolute WER). If CT2 int8 craters Hinglish quality, we
either keep Oriserve on whisper.cpp OR move to `int8_float16` (less
aggressive quantization).
