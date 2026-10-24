# Soma Nami: card plan

Rules for every card: [hackathon.md](hackathon.md). One branch and one PR per card. At most 2 cards in progress at once.

The live status is on the `soma-nami` Kanban board; the board wins over this file. Each card's worker updates its row here when the card closes. Each card clones the repo into `/workspace/soma-nami-<card>` so parallel workers never share a working tree.

| Card | Board id | Title | Depends on | Status | Branch / PR |
|---|---|---|---|---|---|
| C1 | `t_3d199e48` | Technical scope → `docs/scope.md` | none | done | `docs/scope` |
| C2 | `t_250daa6d` | VPS spike: OCR, TTS, grounded Q&A, Swahili ASR in Node; go/no-go by Sun 25 Oct 21:00 | C1 | ready | |
| C3 | `t_22903510` | Expo dev-build + QVAC app scaffold with CI (lint, typecheck, tests) | C1 | todo | |
| C4 | `t_ad242ab0` | Camera → OCR → read aloud | C2, C3 | todo | |
| C5 | `t_99e45430` | Ask about the label: grounded, cites the line, refuses when unsure | C4 | todo | |
| C6 | `t_cebb50ba` | Accessibility and language: large controls, TalkBack, sw/en toggle, low-confidence handling | C4 | todo | |
| C7 | `t_3605b8f3` | Stretch: pharmacist send over Pears | C4, C5, C6 working offline | todo | |
| C8 | `t_55dd85be` | Submission pack: README sections and demo video script | C4, C5, C6 | todo | |

## Card details

### C1 Technical scope
Write `docs/scope.md`: QVAC SDK version; Expo dev-build setup; the OCR, TTS, small LLM and ASR models that fit a 4 GB Android phone and which handle Swahili; how models get downloaded (P2P vs Hugging Face, and what works from the VPS); memory budget; offline demo plan; model licences (no non-commercial licences; Genesis is CC-BY-NC). Mark each claim verified (with source) or assumed.

### C2 VPS spike
Run QVAC in Node on the VPS. OCR on photos of printed generic medicine packaging and on self-made handwritten "1×3" / "2 bd" labels. Swahili and English TTS samples attached as audio. Q&A grounded in label text that refuses when unsure. Swahili ASR on a few clips. Output: `spike/` scripts, `docs/spike-report.md` with numbers, audio attachments, and a go/no-go per capability.

### C3 App scaffold
Expo (SDK 54+) dev build, not managed; `@qvac/sdk` Expo plugin; Android minSdk 29; TypeScript; ESLint; unit tests; GitHub Actions CI running lint, typecheck and tests. The APK is built on CI or by Wesley; physical device only.

### C4 Camera → OCR → read aloud
Capture or pick a photo, run QVAC OCR on device, show the text large, read it aloud with QVAC TTS. Must work in airplane mode.

### C5 Ask about the label
Typed question (voice is a bonus if ASR passes C2). Answer only from the OCR text, quote the line used, refuse and point to the pharmacist when unsure. Tests for refusal cases.

### C6 Accessibility and language
Large touch targets, TalkBack labels, Swahili/English toggle, a clear low-confidence state ("Sina uhakika, muulize mfamasia").

### C7 Pharmacist send over Pears (stretch)
Only after C4 to C6 work offline.

### C8 Submission pack
README sections the rules require, plus a demo video script. Wesley submits.
