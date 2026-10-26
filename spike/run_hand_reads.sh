#!/bin/sh
# Reader A runs for the handwriting spike: original + two preprocessings.
cd "$(dirname "$0")" || exit 1
for v in "data/hand orig" "data/hand_var/crop crop" "data/hand_var/bin bin"; do
  node ocr_reads.mjs $v
done
echo ALLDONE
