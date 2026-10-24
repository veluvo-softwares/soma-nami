#!/usr/bin/env bash
# Creates the soma-nami Kanban board and cards C1-C8 on the Hermes host.
# Run on the machine where Hermes and its gateway run (not in the agent sandbox):
#   bash kanban-setup.sh
# Safe to re-run: every card has an idempotency key, so nothing is duplicated.
set -euo pipefail

BOARD=soma-nami
ASSIGNEE=default
REPO=https://github.com/veluvo-softwares/soma-nami
K="hermes kanban --board $BOARD"

hermes kanban boards create "$BOARD" --name "Soma Nami" \
  --description "AI Yako QVAC hackathon entry, 24-31 Oct 2026" 2>/dev/null || true

COMMON="Repo: $REPO (clone to /workspace/soma-nami). Before anything else, read docs/hackathon.md (rules, product rules, milestones, git rules), docs/plan.md and docs/scope.md. Load the github-workflow and engineering-practice skills. One branch and one PR per card; merge your own PR only after CI passes (docs-only PRs before C3 lands are the exception). No Co-Authored-By or Generated-with footers; noreply email only. Synthetic data only, never a real person's prescription or name. Large model files are never committed. Never make the repo public, submit on DoraHacks, post publicly or spend money. If you need a physical phone or Wesley, kanban_block with exact instructions (what to run, what to report back); if it threatens a milestone, also alert Wesley on Telegram at once with a one-shot cronjob (schedule 'in 1m', deliver 'telegram'). On completion update the card's row in docs/plan.md."

mk () {  # mk <key> <title> <body>  -> prints the task id
  $K create "$2" --assignee "$ASSIGNEE" --body "$3

$COMMON" --skill github-workflow --skill engineering-practice \
    --idempotency-key "soma-nami-$1" --json \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or d.get("task_id") or d["task"]["id"])'
}

C1=$(mk c1 "C1 Technical scope -> docs/scope.md" "Done in PR #2 (docs/scope.md). Kept for the record.")
C2=$(mk c2 "C2 VPS spike: OCR, TTS, grounded Q&A, Swahili ASR (verdict Sun 25 Oct 21:00 EAT)" "Run @qvac/sdk 0.22.0 in Node on the VPS (a probe install already exists at /workspace/qvac-probe). 1) OCR (OCR_LATIN + OCR_CRAFT; LightOnOCR only if its licence allows) on synthetic photos of printed generic medicine packaging, and on self-made handwritten '1x3' / '2 bd' labels: report text accuracy and confidence scores. 2) TTS: English with Supertonic 3 Q4; Swahili with Chatterbox multilingual Q4 (Supertonic 3 has no Swahili). Time each, record peak RAM, attach the WAV files to this card with kanban_attach so Wesley can listen. 3) Grounded Q&A with Qwen3 1.7B vs 0.6B: answers must quote the label line used and refuse (ask the pharmacist) when the label doesn't say; include at least 5 refusal cases. 4) Whisper small vs base on a few Swahili clips (synthetic or public-domain, licence noted). Deliver spike/ scripts, docs/spike-report.md with numbers, and a go/no-go per capability, with the overall recommendation by Sun 25 Oct 21:00 EAT. Send the verdict to Wesley on Telegram when done.")
C3=$(mk c3 "C3 Expo dev-build + QVAC app scaffold with CI" "Expo SDK 54+ dev build (not managed), TypeScript, @qvac/sdk pinned at 0.22.0 with its Expo plugin, expo-build-properties android.minSdkVersion 29. ESLint, typecheck, unit tests (Jest). GitHub Actions CI running lint, typecheck and tests on every PR, plus a workflow that builds a debug/dev APK as an artifact Wesley can install (the VPS can't build APKs). A models screen that downloads all models once and shows 'ready' before any read is allowed. Block with exact install-and-run instructions for Wesley's phone when the APK exists.")
C4=$(mk c4 "C4 Camera -> OCR -> read aloud" "Capture or pick a photo, run QVAC OCR on device, show the text in large type, read it aloud with QVAC TTS (language per the C2 verdict). Low-confidence lines are marked and read as 'I can't read this line, ask the pharmacist'. Works in airplane mode. Tests for the OCR-result to display/speech pipeline. Target: on Wesley's phone by Tue 27 Oct; airplane-mode build Tue night.")
C5=$(mk c5 "C5 Ask about the label: grounded, cites the line, refuses when unsure" "Typed question (voice only if C2 passed ASR). Answer only from the OCR text, quote the line used, never interpret or compute a dose, refuse and point to the pharmacist when the text doesn't say or confidence is low. Unit tests for refusal cases and for numbers in answers matching the source text exactly.")
C6=$(mk c6 "C6 Accessibility and language" "Large touch targets, TalkBack labels on every control, Swahili/English toggle for the interface, clear low-confidence state ('Sina uhakika, muulize mfamasia'). Label text is read verbatim; translation only if Wesley has approved it (docs/scope.md section 6).")
C7=$(mk c7 "C7 Stretch: pharmacist send over Pears" "Only after C4-C6 work offline. First confirm how two phones find each other with no internet (Hyperswarm discovery normally needs internet bootstrap nodes); write the finding on this card before building. Pharmacist types the instruction once; it arrives on the patient's phone and can be read aloud.")
C8=$(mk c8 "C8 Submission pack (ready Fri 30 Oct 12:00)" "README sections the rules require: setup, QVAC package versions, models and download steps, files where QVAC is used, test device and OS, memory, licences, list of features that need a network, built-during-the-event disclosure. Plus a demo video script following docs/scope.md section 7. Wesley submits on DoraHacks; do not submit.")

$K link "$C1" "$C2"; $K link "$C1" "$C3"
$K link "$C2" "$C4"; $K link "$C3" "$C4"
$K link "$C4" "$C5"; $K link "$C4" "$C6"
for p in "$C4" "$C5" "$C6"; do $K link "$p" "$C7"; $K link "$p" "$C8"; done
$K complete "$C1" --result "docs/scope.md merged in PR #2"

echo "C1=$C1 C2=$C2 C3=$C3 C4=$C4 C5=$C5 C6=$C6 C7=$C7 C8=$C8"
$K list
