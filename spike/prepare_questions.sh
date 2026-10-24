#!/usr/bin/env bash
# Make the hold-to-talk question clips for asr_match.mjs (all synthetic):
#  - Swahili: Chatterbox multilingual Q4 (the app's own Swahili voice)
#  - English: Supertonic 3 voice F1
# Each clip also gets a slowed copy (atempo 0.85, a slow older speaker) and a
# noisy copy (pink noise, roughly 10 dB SNR, a pharmacy queue). 16 kHz mono.
# Audio lands in data/asr/q/ (git-ignored).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
Q=data/asr/q
mkdir -p "$Q/raw"
node asr_match.mjs texts
TEXTS_FILE=$Q/sw_texts.json OUT_DIR=$Q/raw TAG=q_sw node tts.mjs chatterbox
TEXTS_FILE=$Q/en_texts.json OUT_DIR=$Q/raw TAG=q_en_f1 VOICE=F1 node tts.mjs supertonic

variants() { # src lang n voice
  local src=$1 lang=$2 n=$3 v=$4
  ffmpeg -loglevel error -y -i "$src" -ac 1 -ar 16000 -sample_fmt s16 "$Q/${lang}_${n}_${v}clean.wav"
  ffmpeg -loglevel error -y -i "$src" -filter:a atempo=0.85 -ac 1 -ar 16000 -sample_fmt s16 "$Q/${lang}_${n}_${v}slow.wav"
  ffmpeg -loglevel error -y -i "$src" -f lavfi -i "anoisesrc=color=pink:amplitude=0.06:seed=$n" \
    -filter_complex "[0:a]aresample=16000,aformat=channel_layouts=mono[a];[1:a]aresample=16000,aformat=channel_layouts=mono[b];[a][b]amix=inputs=2:duration=first:normalize=0" \
    -ac 1 -ar 16000 -sample_fmt s16 "$Q/${lang}_${n}_${v}noisy.wav"
}
for f in $Q/raw/chatterbox_q_sw_*.wav; do n=${f##*_}; n=${n%.wav}; variants "$f" sw "$n" ""; done
for f in $Q/raw/supertonic_q_en_f1_*.wav; do n=${f##*_}; n=${n%.wav}; variants "$f" en "$n" ""; done
ls $Q/*.wav | wc -l
