# Soma Nami: technical scope

Card C1. Rules: [hackathon.md](hackathon.md). UI: [ui.md](ui.md). Written 24 Oct 2026; updated the same evening for Wesley's decisions: **iOS first** (his iPhone is the dev and demo device), the **translation rule** in section 6 accepted, and **TranslatePsy-AfriSLM** approved for "tafsiri". Updated again on 25 Oct: the demo phone is an **iPhone 12** (4 GB), iOS builds go through **EAS and TestFlight**, the Android APK goes to a **public releases repo**, **hold-to-talk** is the main way to ask, and fixed Swahili phrases are **pre-generated** audio.

Tags: **[V]** verified on the VPS or from a cited source, **[A]** assumption to be tested in the C2 spike or on Wesley's phone.

## 1. Decisions at a glance

| Job | Primary choice | Size | Swahili | Licence | Fallback |
|---|---|---:|---|---|---|
| OCR, printed text | `OCR_LATIN` + `OCR_CRAFT` (EasyOCR detector and Latin recogniser, GGML) | 15 MB + 83 MB | Latin script, so yes for reading [A] | Apache-2.0 (EasyOCR) [A] | `OCR_DOCTR` (12 MB) |
| OCR, hard cases (handwriting, curved boxes) | `OCR_0_6B_MULTIMODAL_Q4_K_M` (LightOnOCR-2, vision LLM) | 397 MB + 819 MB mmproj | n/a | to check in C2 | none; we say "can't read this, ask the pharmacist" |
| Read aloud, English | `TTS_MULTILINGUAL_SUPERTONIC3_Q4_0` | 85 MB | **No** [V] | OpenRAIL-M [V] | Supertonic 3 Q8 (127 MB) |
| Read aloud, Swahili | `TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0` + `TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0` | 345 MB + 788 MB | Yes, `sw` is on the supported list [V] | MIT (upstream Chatterbox) [A] | Too slow to run live (spike: 30–47× slower than real time on one VPS thread, 1.9 GB peak RSS) [V]. **Decided:** every fixed Swahili phrase is generated ahead of time with Chatterbox and shipped as audio. iOS probably has no Swahili system voice [A, Wesley checks] |
| Grounded Q&A | **No model** (decided 29 Oct): Ask picks and quotes the matching label line in code (C5). `QWEN3_1_7B_INST_Q4` (1,057 MB) passed the C2 spike but gave one unsafe dose answer, so it is not downloaded | 0 MB | n/a | n/a | none needed |
| Tafsiri, English → Swahili (approved, rule in §6) | `TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M` (`qvac/TranslatePsy-AfriSLM-0.8B-Q4-GGUF`, Tether's own model) | 672 MB | Yes [V] | Apache-2.0 [V] | `TRANSLATEPSY_AFRISLM_2B_TRANSLATION_Q4_K_M` (1,560 MB) if 0.8B is weak and memory allows |
| Voice questions, hold-to-talk (decided) | `WHISPER_SMALL_Q8_0` | 264 MB | Rough: WER 0.71, CER 0.15 on FLEURS Swahili in the spike [V], so the transcript is matched against a fixed list of questions, not used as free text | MIT | `WHISPER_BASE_Q8_0` (82 MB, WER 0.95); question buttons |

Sizes are `expectedSize` values from the `@qvac/sdk` 0.22.0 model registry, read on the VPS [V].

**The biggest finding:** the small, phone-friendly TTS (Supertonic 3, 85 MB) covers 31 languages, but **not Swahili** ([model card](https://huggingface.co/Supertone/supertonic-3)) [V]. The only Swahili-capable TTS in the QVAC registry is Chatterbox multilingual, at about 1.1 GB on disk at Q4 and with heavy compute. Swahili read-aloud is therefore the go/no-go for C2, as Wesley expected.

## 2. QVAC SDK

- `@qvac/sdk` **0.22.0** (latest, published 19 Oct 2026), Apache-2.0 [V]. Pre-1.0, so pin the exact version: `"@qvac/sdk": "0.22.0"`.
- Node ≥ 22.17 on desktop. The VPS has Node 26.11.1, 4 vCPU, 7 GB RAM, no GPU [V].
- `npm i @qvac/sdk@0.22.0` installs about **3.2 GB** of `node_modules` on linux-x64, because it ships every native addon (LLM, OCR, TTS, ASR, diffusion, VLA and others) [V]. Bundle size on Android needs checking; we may be able to exclude unused addons (C3).
- APIs we use: `loadModel`, `unloadModel`, `ocr` (returns blocks with `text`, `bbox` and `confidence`), `textToSpeech`, `completion`, `transcribe`, `translate` [V from the shipped examples].
- OCR blocks carry a `confidence` value and accept a `lowConfidenceThreshold` in the model config. This is what lets us enforce "when it isn't sure, say so" [V].

## 3. How models get downloaded (risk #4)

- Registry models whose `registrySource` is `'s3'` (OCR, TTS, Parakeet) are fetched **peer-to-peer**: `@qvac/registry-client` 0.7.0 joins Hyperswarm and replicates a Hypercore blob [V, `lib/client.js`].
- Models whose `registrySource` is `'hf'` (Whisper, Qwen, LightOnOCR, AfriSLM) download over HTTPS from huggingface.co [V].
- **P2P works from the VPS sandbox.** `loadModel({ modelSrc: OCR_LATIN })` pulled both OCR files (83 MB + 15 MB) in **19 s**, logged as "Blob download complete (direct)" [V]. So the assumption that the DHT is blocked was wrong for this sandbox.
- **Fallback if P2P fails** (on the phone, or on the Node NBO Wi-Fi): any model can also be loaded from a local file path. For the demo we can pre-stage `.gguf` files (Finder file sharing on iOS, `adb push` on Android) and load them by path [A, to test in C3].
- **Demo rule:** download every model once, on Wi-Fi, before switching to airplane mode. The app shows a "models ready" screen and refuses to start a read until they are present.

## 4. Platforms and builds: iOS first, Android APK for everyone else

From the QVAC docs ([JS/TS SDK](https://docs.qvac.tether.io/sdk/js-ts-sdk/), [system requirements](https://docs.qvac.tether.io/sdk/system-requirements/)) [V]: iOS **17.0+ arm64 with Metal**, and Android **12+ arm64** with Vulkan (OpenCL on Adreno 700+). Both require Expo (SDK ≥ 54, dev build, not managed). QVAC's own support matrix says neither mobile platform has recorded physical-device acceptance yet [V, `docs/system-resources-support-matrix.md` in the SDK], so we are early users on both.

**iOS (development and demo device).**
- Wesley's **iPhone 12**, 4 GB RAM [V, Wesley]. iOS 26.6.1 (confirmed in C3a; QVAC needs 17.0+), built with Xcode 27.0.
- Wesley has a paid Apple Developer account and App Store Connect. Builds are made with **EAS Build** on Expo's servers, triggered by Bond with an `EXPO_TOKEN`, and submitted to **TestFlight** with `eas submit` (C10). Wesley sets up the Apple credentials once with `eas credentials` on his Mac; no Apple keys live on the VPS or in the repo. Expo's free plan only.
- Local builds stay possible for debugging, on Wesley's Mac: `git pull && cd mobile && npm ci && npx expo prebuild`, then `npx expo start --dev-client`, open `ios/SomaNami.xcworkspace`, pick the iPhone and press Cmd+R. Not `npx expo run:ios`, which fails on Xcode 27 (see mobile/README.md).
- No 7-day expiry with a paid account. TestFlight's Beta App Review for external testers (judges included) takes about a day, so the first external build goes in by Wed 28 Oct. With a paid account the increased-memory-limit entitlement is available; whether we need it is a C3a measurement.
- `app.json`: `expo-build-properties` with `ios.deploymentTarget: "17.0"`, plus `@qvac/sdk/expo-plugin` (JSON config only in Expo).

**Android (judges and anyone else).**
- `expo-build-properties` with `android.minSdkVersion: 31` (Android 12, the runtime floor per QVAC; raised from 29 on 26 Oct), arm64-v8a only.
- The APK is built with EAS Build on a version tag (C10; GitHub Actions Gradle until 26 Oct) and published to a separate public releases repo (C10), because `soma-nami` itself is private. Nobody on the team owns an Android phone.
- QVAC says mobile needs a physical device. We still try the APK on an arm64 emulator on Wesley's Mac (C3b) and record what happens. The first real Android test is a borrowed phone at the Wed 28 Oct offline check (C12).

**On the VPS**, CI-equivalent checks only: lint, typecheck, unit tests, and the C2 spike in Node.

## 5. Memory budget

**iPhone 12 (4 GB).** iOS gives one app well under the phone's total RAM before it kills it [A, to measure with Xcode's memory gauge in C3a]. Load **one model at a time** and unload between steps. Peak RSS in the spike, on the VPS, one thread [V]: OCR step 3.3 GB (needs explaining in C2 before it goes near the phone), Qwen3 1.7B 2.5 GB, Chatterbox 1.9 GB, Qwen3 0.6B 1.3 GB, Whisper small 1.0 GB, Whisper base 0.7 GB. These include the Node runtime, so they overstate the phone, but they rule out keeping two big models loaded together. Chatterbox doesn't run on the phone at all: its Swahili phrases are pre-generated (§1).

**Android 4 GB (the floor for the APK).** Assume about 1.5 GB usable [A]. Models are loaded **one at a time** and unloaded between steps:

| Step | Loaded models | Approx. RAM |
|---|---|---:|
| Read | OCR (CRAFT + Latin) | ~0.2 GB |
| Speak (English) | Supertonic 3 Q4 | ~0.2 GB |
| Speak (Swahili) | Chatterbox mtl Q4 (T3 + S3Gen) | ~1.3 GB [A], tight |
| Ask | none: the answer is the label line, picked in code (C5) | 0 |
| Tafsiri | TranslatePsy 0.8B Q4 | ~0.8 GB [A] |
| Voice question | Whisper small Q8 | ~0.4 GB |

Qwen3 was dropped on 29 Oct: nothing loads it, so TranslatePsy 0.8B (Tafsiri) is the largest model the phone loads.

The phone downloads about 1.1 GB: OCR (98 MB), Supertonic 3 (85 MB), Whisper small (264 MB) and TranslatePsy 0.8B (672 MB). The list is `mobile/src/model-store/manifest.ts`.

## 6. Product risks that the scope exposes

1. **Translation vs "read exactly what's written". Decided 24 Oct (Wesley accepted the proposal).** The app's own buttons and phrases are in Swahili. Label text is read word for word in its original language. "Tafsiri" is a separate, clearly labelled option, and every number in a translation is checked against the original. If any number differs, the app shows the original and says the translation isn't safe. The check also covers units and frequency words ("twice" vs "mara tatu"), because those carry numbers without digits (C11; first version in `spike/numbers.mjs`).
2. **Handwriting ("1×3", "2 bd").** EasyOCR is not built for handwriting. The rule is: if OCR confidence on a dose-like line is below threshold, the app says it can't read it and to ask the pharmacist. That is a product feature, not a failure. The C7 Pears hand-off is the real fix.
3. **Swahili TTS weight. Decided 24 Oct.** Chatterbox ran 30–47× slower than real time in the spike (a 2-second phrase took 73–90 s) [V], and iOS probably has no Swahili system voice [A]. So every fixed Swahili phrase (screen-opening lines, aiming hints, not-sure lines, question read-backs, answer frames) is generated ahead of time with Chatterbox on the VPS and shipped as audio files: still QVAC-made, and instant on the phone. Label text is read in its printed language (English with Supertonic). Dynamic Swahili text, such as a tafsiri result, is shown on screen and spoken only if Chatterbox proves fast enough on the phone.
4. **SDK churn.** 0.x with fast releases. Pin to 0.22.0 and do not upgrade during the week.
5. **VoiceOver speaks Swahili with a non-Swahili voice.** If iOS has no Swahili voice, VoiceOver reads our Swahili button labels with whatever voice the phone uses, which will sound wrong. Mitigation: every screen's spoken line comes from our own TTS; accessibility labels stay short; test with VoiceOver on in C6.
6. **Voice-guided auto-capture** (ui.md, Aiming) needs text detection on live camera frames, and OCR took 86–115 s per photo on one VPS thread in the spike [V]. **Decided:** tap anywhere to take the photo, then spoken guidance from where the text sits in that photo ("Sogeza kushoto kidogo", closer, more light) and try again. Live auto-capture comes back only if the CRAFT detector alone runs about once a second on the iPhone.
7. **Dawa zangu times are an interpretation risk.** Turning "1×3" into "morning, afternoon, evening" is interpreting a dose. The caregiver sets each medicine's time of day by hand; the app never infers it from the label.
8. **TestFlight timing.** External testers need Beta App Review (about a day). Submit the first external build by Wed 28 Oct, and keep a fresh build installed on Wesley's iPhone for demo day.

## 7. Offline demo plan

On Wesley's iPhone 12.

1. Show airplane mode switched on, on camera.
2. Point the camera at a generic, printed medicine box (synthetic label, no names) and tap anywhere. If the text is off-frame, the voice says how to move and the user tries again. The text appears in large type and is read aloud exactly as printed.
3. Hold the mic and ask "Hii ni ya saa ngapi?". The app repeats the question back and reads the exact line from the label.
4. Ask something the label doesn't say ("Naweza kunywa pombe?"). The app says the label doesn't say and to ask the pharmacist.
5. Tap "Tafsiri kwa Kiswahili". The translation appears with its numbers checked against the original.
6. Show a handwritten "2 bd" envelope. The app goes to "Sijaweza kusoma vizuri" and tells the user to ask the pharmacist.
7. Stretch: the pharmacist's phone sends the instruction to the patient's phone over Pears, still in airplane mode with local Wi-Fi or Bluetooth.

## 8. Licences

| Model or asset | Licence | Status |
|---|---|---|
| QVAC SDK | Apache-2.0 | [V] |
| Supertonic 3 | OpenRAIL-M (use restrictions, commercial use allowed) | [V] |
| Chatterbox multilingual | MIT upstream | [A] check in C2 |
| EasyOCR models | Apache-2.0 upstream | [A] check in C2 |
| LightOnOCR-2 | unknown | check in C2 before use |
| Qwen3 | Apache-2.0, **not shipped** (dropped 29 Oct; spike only) | [A] |
| TranslatePsy-AfriSLM (0.8B and 2B) | Apache-2.0, Tether | [V] |
| Whisper | MIT | [A] |
| Atkinson Hyperlegible font | SIL Open Font License 1.1 | [A] check in C3 |
| QVAC Genesis datasets | CC-BY-NC 4.0, **not used** | [V] |

**Roadmap-only models (not used this week):**
- Models built on Gemma, including both Kikuyu translators (`c-elo/kikuyu_translategemma_4b_v7_highrank_rslora`, `DeepSahelAI/DeepSahel-Kikuyu-Translation`), carry **Gemma's terms of use** even when their model card says Apache-2.0.
- `DeKUT-DSAIL/tunuh-whisper-base-kikuyu-v1` has **no licence**. Do not use it without DeKUT's written permission.
- MMS-based Kikuyu TTS is CC-BY-NC (not allowed by our rules). F5-TTS Kikuyu is CC-BY-SA and can't run in QVAC.

## 9. Roadmap: Kikuyu (pitch only, not built this week)

English → Kikuyu translation already exists (C-elo Labs' `kikuyu_translategemma_4b_v7_highrank_rslora`, DeepSahel's `DeepSahel-Kikuyu-Translation`). The blocker is **open, offline Kikuyu read-aloud**: MMS-based Kikuyu TTS is non-commercial, F5-TTS Kikuyu is share-alike and not runnable in QVAC, and C-elo's TTS appears to be hosted only. The pitch's roadmap section names this gap and credits C-elo Labs and DeepSahel.

## 10. What C2 must answer

1. EasyOCR accuracy on printed medicine packaging (our own synthetic photos), and its confidence scores on handwriting.
2. Chatterbox Swahili quality and speed on 4 vCPUs; Supertonic 3 English quality. Wesley listens to the audio. **Swahili TTS is the go/no-go.**
3. Grounded Q&A with Qwen3 1.7B vs 0.6B: does it quote, and does it refuse?
4. Whisper small vs base on a few Swahili clips, judged for matching a fixed list of questions.
5. TranslatePsy 0.8B on 20 synthetic label lines: every number, unit or frequency that changed or went missing.
6. Whether TranslatePsy can also answer label questions grounded in the label, so one model does both jobs.
7. Peak RAM for each step, and for Chatterbox plus the question model loaded together.
8. Whether iOS has a built-in Swahili voice (Wesley checks on his iPhone).
9. Chatterbox with more threads, what drives the OCR step's 3.3 GB peak, and whether the OCR, TTS, Whisper and LLM addons all ship for iOS.
