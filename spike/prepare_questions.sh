#!/usr/bin/env bash
# Make the hold-to-talk question clips for asr_match.mjs (all synthetic):
#  - Swahili: Chatterbox multilingual Q4 (the app's own Swahili voice)
#  - English: Supertonic 3 voice F1
# Clips 1..8 are the fixed list in data/questions.json; clips 9.. are
# out-of-list questions ("neg") that the matcher must reject.
# Each clip also gets a slowed copy (atempo 0.85, a slow older speaker) and a
# noisy copy (pink noise, a pharmacy queue). 16 kHz mono.
# Audio lands in data/asr/q/ (git-ignored). TTS is skipped if raw files exist.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
Q=data/asr/q
mkdir -p "$Q/raw"
node asr_match.mjs texts

tts() { # engine tag textsfile [VOICE]
  local engine=$1 tag=$2 texts=$3
  if ls "$Q/raw/${engine}_${tag}_"[0-9]*.wav >/dev/null 2>&1; then echo "skip $tag (exists)"; return; fi
  TEXTS_FILE=$texts OUT_DIR=$Q/raw TAG=$tag node tts.mjs "$engine"
}
tts chatterbox q_sw $Q/sw_texts.json
VOICE=F1 tts supertonic q_en_f1 $Q/en_texts.json
tts chatterbox q_sw_neg $Q/sw_neg_texts.json
VOICE=F1 tts supertonic q_en_neg $Q/en_neg_texts.json

variants() { # src lang n
  local src=$1 lang=$2 n=$3
  ffmpeg -loglevel error -y -i "$src" -ac 1 -ar 16000 -sample_fmt s16 "$Q/${lang}_${n}_clean.wav"
  ffmpeg -loglevel error -y -i "$src" -filter:a atempo=0.85 -ac 1 -ar 16000 -sample_fmt s16 "$Q/${lang}_${n}_slow.wav"
  ffmpeg -loglevel error -y -i "$src" -f lavfi -i "anoisesrc=color=pink:amplitude=0.06:seed=$n" \
    -filter_complex "[0:a]aresample=16000,aformat=channel_layouts=mono[a];[1:a]aresample=16000,aformat=channel_layouts=mono[b];[a][b]amix=inputs=2:duration=first:normalize=0" \
    -ac 1 -ar 16000 -sample_fmt s16 "$Q/${lang}_${n}_noisy.wav"
}
num() { local n=${1##*_}; echo "${n%.wav}"; }
nlist=$(node asr_match.mjs count)
for f in $Q/raw/chatterbox_q_sw_[0-9]*.wav; do variants "$f" sw "$(num "$f")"; done
for f in $Q/raw/supertonic_q_en_f1_*.wav; do variants "$f" en "$(num "$f")"; done
for f in $Q/raw/chatterbox_q_sw_neg_*.wav; do variants "$f" sw "$(( $(num "$f") + nlist ))"; done
for f in $Q/raw/supertonic_q_en_neg_*.wav; do variants "$f" en "$(( $(num "$f") + nlist ))"; done
ls $Q/*.wav | wc -l
