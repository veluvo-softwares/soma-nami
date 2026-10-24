#!/usr/bin/env bash
# Run the whole spike sequentially (one model in memory at a time).
# Logs go to out/logs/<step>.log. Usage: ./run_all.sh [step ...]
# Steps: data tts_en tts_sw ocr qa_small qa_large qa_small_v3 qa_large_v3 asr_prep asr_base asr_small ocr_vlm
# Extra (Wesley's iPhone questions): tts_sw_t4 q_prep asrq_base asrq_small
#   ocr_mem_default ocr_mem_c1280_b8 ocr_mem_m1_b8 ocr_mem_c1024_b1
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p out/logs
steps=("$@")
[ ${#steps[@]} -eq 0 ] && steps=(data tts_en tts_sw ocr qa_small qa_large asr_prep asr_base asr_small ocr_vlm)
run() { # name cmd...
  local name=$1; shift
  echo "== $name: $* ($(date +%H:%M:%S))"
  "$@" > "out/logs/$name.log" 2>&1
  echo "== $name exit=$? ($(date +%H:%M:%S))"
}
for s in "${steps[@]}"; do
  case $s in
    data) run data python3 make_images.py ;;
    tts_en) run tts_en node tts.mjs supertonic ;;
    tts_sw) run tts_sw node tts.mjs chatterbox ;;
    ocr) run ocr node ocr.mjs ;;
    qa_small) run qa_small node qa.mjs QWEN3_600M_INST_Q4 ;;
    qa_large) run qa_large node qa.mjs QWEN3_1_7B_INST_Q4 ;;
    qa_small_v3) PROMPT=v3 TAG=v3 run qa_small_v3 node qa.mjs QWEN3_600M_INST_Q4 ;;
    qa_large_v3) PROMPT=v3 TAG=v3 run qa_large_v3 node qa.mjs QWEN3_1_7B_INST_Q4 ;;
    asr_prep) run asr_prep bash prepare_asr.sh ;;
    q_prep) run q_prep bash prepare_questions.sh ;;
    asrq_base) run asrq_base node asr_match.mjs WHISPER_BASE_Q8_0 ;;
    asrq_small) run asrq_small node asr_match.mjs WHISPER_SMALL_Q8_0 ;;
    tts_sw_t4) THREADS=4 TAG=t4 LIMIT=2 run tts_sw_t4 node tts.mjs chatterbox ;;
    ocr_mem_default) OCR_OUT=out/ocr_mem_default.json run ocr_mem_default node ocr.mjs p1_paracetamol_photo p2_amoxicillin_hard h5_tds_indieflower ;;
    ocr_mem_c1280) OCR_CANVAS=1280 OCR_OUT=out/ocr_mem_c1280.json run ocr_mem_c1280 node ocr.mjs p1_paracetamol_photo p2_amoxicillin_hard h5_tds_indieflower ;;
    ocr_mem_c1280_b8) OCR_CANVAS=1280 OCR_BATCH=8 OCR_OUT=out/ocr_mem_c1280_b8.json run ocr_mem_c1280_b8 node ocr.mjs p1_paracetamol_photo p2_amoxicillin_hard h5_tds_indieflower ;;
    ocr_mem_m1_b8) OCR_MAG=1.0 OCR_BATCH=8 OCR_OUT=out/ocr_mem_m1_b8.json run ocr_mem_m1_b8 node ocr.mjs p1_paracetamol_photo p2_amoxicillin_hard h5_tds_indieflower ;;
    ocr_mem_c1024_b1) OCR_CANVAS=1024 OCR_BATCH=1 OCR_OUT=out/ocr_mem_c1024_b1.json run ocr_mem_c1024_b1 node ocr.mjs p1_paracetamol_photo p2_amoxicillin_hard h5_tds_indieflower ;;
    asr_base) run asr_base node asr.mjs WHISPER_BASE_Q8_0 ;;
    asr_small) run asr_small node asr.mjs WHISPER_SMALL_Q8_0 ;;
    ocr_vlm) run ocr_vlm node ocr_vlm.mjs ;;
    *) echo "unknown step $s" ;;
  esac
done
