#!/usr/bin/env bash
# Prepare Swahili ASR clips for asr.mjs.
#  - 8 FLEURS sw_ke dev clips (google/fleurs, CC-BY-4.0, real read speech)
#  - the synthetic Chatterbox Swahili WAVs written by `node tts.mjs chatterbox`
# Audio is not committed: it lands in data/asr/ (git-ignored) and in a cache.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="${C2_CACHE:-/workspace/c2-cache}/fleurs"
OUT="$HERE/data/asr"
mkdir -p "$CACHE" "$OUT"
BASE=https://huggingface.co/datasets/google/fleurs/resolve/main/data/sw_ke
[ -f "$CACHE/dev.tsv" ] || curl -sL -o "$CACHE/dev.tsv" "$BASE/dev.tsv"
[ -f "$CACHE/dev.tar.gz" ] || curl -sL -o "$CACHE/dev.tar.gz" "$BASE/audio/dev.tar.gz"
# first clip of the first 8 distinct sentences
awk -F'\t' '!seen[$1]++ && n < 8 { print; n++ }' "$CACHE/dev.tsv" > "$CACHE/pick.tsv"
cut -f2 "$CACHE/pick.tsv" | sed 's#^#dev/#' > "$CACHE/files.txt"
(cd "$CACHE" && tar xzf dev.tar.gz -T files.txt)

json="["
sep=""
while IFS=$'\t' read -r _id wav raw _norm _rest; do
  ffmpeg -loglevel error -y -i "$CACHE/dev/$wav" -ac 1 -ar 16000 -sample_fmt s16 "$OUT/fleurs_$wav"
  ref=$(printf '%s' "$raw" | sed 's/\\/\\\\/g; s/"/\\"/g')
  json+="$sep{\"file\":\"data/asr/fleurs_$wav\",\"ref\":\"$ref\",\"source\":\"fleurs\"}"
  sep=","
done < "$CACHE/pick.tsv"

# synthetic clips: texts must match tts.mjs (chatterbox) order
i=0
while IFS= read -r ref; do
  i=$((i+1))
  src="$HERE/out/tts/chatterbox_$i.wav"
  [ -f "$src" ] || continue
  ffmpeg -loglevel error -y -i "$src" -ac 1 -ar 16000 -sample_fmt s16 "$OUT/synthetic_$i.wav"
  json+="$sep{\"file\":\"data/asr/synthetic_$i.wav\",\"ref\":\"$ref\",\"source\":\"synthetic\"}"
  sep=","
done <<'EOF'
Chumvi ya kurejesha maji mwilini.
Yeyusha pakiti moja katika lita moja ya maji safi. Tumia ndani ya saa ishirini na nne.
Meza kidonge kimoja mara tatu kwa siku, kwa siku saba.
Sina uhakika nimesoma vizuri. Tafadhali muulize mfamasia.
EOF
json+="]"
printf '%s\n' "$json" > "$OUT/clips.json"
echo "wrote $OUT/clips.json"
