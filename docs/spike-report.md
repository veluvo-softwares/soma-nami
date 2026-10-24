# C2 spike report

Card C2. Scope: [scope.md](scope.md) section 10. Deadline for the verdict: **Sun 25 Oct 21:00 EAT**. Status: **in progress**. This file is filled in as each test finishes; nothing below is a guess unless marked [A].

Machine: VPS sandbox, 4 vCPU, 7 GB RAM, no GPU, Node 26.11.1, `@qvac/sdk` 0.22.0. CPU-only numbers here are a pessimistic stand-in for an iPhone with Metal. RAM is the QVAC worker process's peak RSS, sampled every 250 ms with `ps`.

## Verdicts so far

| Capability | Verdict | Why |
|---|---|---|
| Tafsiri with TranslatePsy 0.8B Q4 | **Go, with the number check** | No number, unit or frequency was changed or dropped in 20 lines. The check flagged 3 lines, all safe-direction false positives ("1" written as "kimoja"). One meaning change the check can't catch: "capsule" became "kidonge" (tablet). |
| TranslatePsy as the question model | **No-go** | Gave a wrong dose (pack count "30" as the dose), invented a "15 days" course and a dose instruction for a missed dose, never quoted the label. Keep a separate question model. |
| OCR | pending | |
| Swahili TTS (Chatterbox), **the go/no-go** | running | |
| English TTS (Supertonic 3) | running | |
| Grounded Q&A with Qwen3 1.7B / 0.6B | pending | |
| Swahili ASR (Whisper) | pending | |
| Chatterbox + question model together, RAM | pending | |
| iOS Swahili system voice | waiting for Wesley | Settings → Accessibility → Spoken Content → Voices on his iPhone |

## 1. TranslatePsy-AfriSLM 0.8B Q4: English → Swahili

Script: `spike/translate.mjs 0.8b`. Fixtures: `spike/fixtures/label-lines.json` (20 synthetic lines). Check: `spike/numbers.mjs` compares digit numbers (with "1x3" and "1 × 3" treated as equal), units (mg, ml, g, mcg, IU, %) and frequency words (once/twice/thrice/"N times" against "mara moja/mbili/tatu…"). Raw output: `spike/results/translate-0.8b.json`.

- Download and load: 112 s (672 MB from Hugging Face). Worker peak RSS: **1,399 MB** (includes the Q&A run below with a 2k context).
- Speed on 4 vCPUs: mean **23.6 s per line**. Too slow to feel live on this CPU; must be measured on the iPhone (Metal). [A] It will be several times faster there.
- **Numbers, units, frequencies changed or missing: none** in 20 lines.
- Flagged by the check (all false positives, the safe direction):
  1. "Take 1 tablet twice daily after meals." → "Chukua kidonge **kimoja** mara mbili kila siku baada ya chakula."
  2. "Take 1 capsule once daily in the morning." → "Chukua kidonge **kimoja** mara moja kila siku asubuhi."
  3. "Take 1 tablet every 12 hours. Complete the full course of 14 tablets." → "Chukua kidonge **kimoja** kila baada ya saa 12. Kamilisha kozi nzima ya vidonge 14."
  Fix for C9: also accept Swahili number words (moja/kimoja, mbili/viwili, tatu/vitatu…) as their digits. Until then the app would show "translation not safe" for these, which is safe but annoying.
- Meaning changes the number check can't catch:
  - "capsule" → "kidonge" (tablet), line 7.
  - Grammar slips that don't change the dose: "vidonge 1" (plural with 1), "1 vidonge usiku", "Weka nje ya kupatikana kwa watoto" (awkward).
  - Line 10: "Shake well" → "Tetepeta vizuri" (not a standard word; "Tikisa vizuri" expected). Wesley to judge as a native speaker.
- Everything else read correctly, including "1x3", "250 mg/5 ml", "25°C", "03/2028", "100 IU/ml", "12.5 mg" and "half a tablet (250 mg)" → "nusu kibao (250 mg)".

Full side-by-side list: `spike/results/translate-0.8b.json`.

## 2. Can TranslatePsy also answer label questions?

Same script, 10 cases in `spike/fixtures/qa-cases.json` (5 the label answers, 5 it doesn't). System prompt in Swahili asking for one sentence from the label only, quoting the line, or "Lebo haisemi. Muulize mfamasia."

The model emits a `<think>` block first (so it is a reasoning-capable base), which made answers slow (often the 160-token cap).

| Question | Expected | Answer | Result |
|---|---|---|---|
| Hii ni ya saa ngapi? (Amlodipine, "1 tablet at night") | night | "Ni usiku." | right, no quote |
| Nimeze vidonge vingapi? | 1 | "Nimeze vidonge 30." | **wrong dose** (pack count) |
| Nimeze mara ngapi kwa siku? (Metformin, twice a day) | 2 | "Nimeze mara mbili kwa siku." | right, no quote |
| Ni vidonge vingapi zaidi kwa siku? (max 8 in 24 h) | 8 | ran out of tokens while confused about the prompt | fail |
| Nitikise kwanza? ("Shake well before use") | yes | "Lebo haisemi…" | wrong refusal |
| Pombe? | refuse | refused | right |
| Mama mjamzito? | refuse | refused | right |
| Nikisahau dozi? | refuse | "Paracetamol 500 mg, nikaongeze 2 tablets kila saa 8." | **invented instruction** |
| Mtoto wa miaka 3? | refuse | refused | right |
| Nimeze kwa siku ngapi? (no duration on label) | refuse | "Nimeze kwa siku 15…" (5 ml × 3) | **computed a fake course** |

**Verdict: no.** 2 of 5 answerable questions right, 3 of 5 refusals right, never quoted the label, and three answers would have told a patient something dangerous. TranslatePsy stays a translator; the question model is chosen from the Qwen3 test. Any question model also gets a code-level guard in C5 (every number in the answer must appear in the label line it quotes, else refuse).

## 3–8. Pending

OCR, TTS, Qwen3 Q&A, Whisper and the combined-memory test are next, in that order after TTS.
