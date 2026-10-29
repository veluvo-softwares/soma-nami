# Soma Nami

*"Read with me."* Point your phone at a medicine box, a letter or a notice, and Soma Nami reads it aloud in Swahili or English. Then ask it a question. Everything runs on the phone with the internet off.

Built for [AI Yako: Own Your AI](https://dorahacks.io/hackathon/ai-yako/detail), the QVAC hackathon at Node NBO, Nairobi (24–31 October 2026).

## The problem

Your grandmother takes five medicines a day and can't read any of the labels.

Older people with failing eyesight often take several chronic medicines (blood pressure, diabetes, HIV or TB treatment). Many also read little or no English. The pharmacist explains the doses once, at the counter. Days later, at home, the patient holds two similar boxes and can't remember which is "1×3" and which is "1×1". The fallback is a neighbour or a grandchild, or guessing. Missed doses of HIV or TB treatment breed drug resistance, and a doubled blood-pressure dose can cause a fall.

The same goes for everything else printed: bank letters, school notices and test results, which people would rather not hand to a neighbour to read.

## Who it's for

- **Main user:** older adults with poor eyesight who take daily medicines, and the caregivers who look after them. Often the phone is a caregiver's or a shared household phone.
- **Also:** blind and low-vision people, and anyone who can't read the language a document is written in.
- **Pharmacists (optional):** a chemist can send the dosing instructions straight to the patient's phone, so they can always be read back correctly.

## What it does (as built)

Status on 29 Oct 2026. This section describes what is on `main` (everything up to and including PR #29, which includes hold-to-talk in #26 and dropping Qwen in #29) and what has been run on a phone. "Tested on a phone" means Wesley's iPhone 12; see "Tested devices". Every feature below has unit or component tests, but only the first read-aloud path has been run on a phone.

1. **Read aloud.** Camera (tap anywhere) or photo library, then QVAC OCR on the phone, then the label lines in large type, each read aloud exactly as printed with the on-device English voice. Expiry dates are spoken with the month name ("Exp 08/2028" is said "Exp August 2028"); the screen text stays as printed. After a photo the app may speak a framing hint (left, right, up, down, further, closer, no text) and wait for another tap. Batch numbers, manufacturing dates, barcodes and the maker's address are shown under "More details" and are not spoken. A stuck OCR read is stopped after 120 seconds and the app says it couldn't read the photo (unit-tested; not seen on a phone). Tilted photos are not straightened: deskew was measured and not shipped.
2. **Not sure.** A line OCR is unsure about is never shown or read: the app says it couldn't read that line. A page that is mostly unreadable, or that looks like a handwritten dose ("1x3", "2 bd", "Tab 1 tds"), goes to a Not sure screen: "Sitakisia dozi. Muulize mfamasia au daktari." An optional "call my helper" button dials a number the caregiver saved.
3. **Ask about it.** Seven fixed question buttons (what is it, how many, how many times a day, what time, with food, expiry, read again). The app repeats the question from a pre-made clip and then reads the label line that answers it, quoted exactly, with the quote on screen. If the label doesn't say, the line is unreadable, or two lines disagree, it refuses and says to ask the pharmacist. Alcohol, children, pregnancy, allergy and missed-dose questions always go to the pharmacist. **No AI model writes or computes the answer**: it is the OCR line, matched by code. **Hold-to-talk:** instead of a button, hold the microphone and ask in Swahili. QVAC Whisper small transcribes on the phone (Whisper is loaded only for that step, with every other model unloaded), and the transcript is matched to the same fixed question list. Anything it can't match gets "Sijaelewa, jaribu tena" (I didn't understand, try again). The microphone path is unit-tested with a fake microphone. Not yet run on a phone, so its speed on the iPhone 12 is unknown.
4. **Setup for a caregiver.** Interface language (Kiswahili or English), voice speed, light or dark theme, helper's number, model status. Saved on the phone only. Every control has a VoiceOver/TalkBack label and hint; touch targets are at least 88 pt.
5. **Tafsiri kwa Kiswahili (translate to Swahili).** A button on the Reading screen. TranslatePsy-AfriSLM 0.8B translates each confident English line on the phone, then a number check compares every number, frequency, unit and before/after-meals word with the original. If anything differs, the translation is not shown and the app says "Tafsiri hii si salama" and points to the original. A safe translation is shown under the original and labelled as a translation, not the label. It is spoken in Swahili only when the original English line fits a dose or expiry template, using pre-made clips with the numbers taken from the original, never from the model. The check covers quantities only: it does not catch a wrongly translated word or a dropped "do not". Not run on a phone, so speed and memory of the 0.8B model on the iPhone 12 are unknown.
6. **Dawa zangu (my medicines).** After a read, "Hifadhi kwenye Dawa zangu" saves the photo and the OCR lines as read. Tapping a saved card reads it again with no OCR, so it should be instant and work offline. A caregiver can set times of day (morning, midday, evening, night) in setup, and a card shows "Sasa" when its time matches; nothing is worked out from the label. Saved medicines are stored on the device and excluded from iCloud backup (a small local Swift module sets the exclusion flag; Android Auto Backup is off). Unit-tested; the iCloud exclusion needs a new native build and has not been checked on a phone.

**In progress, not in this submission:**
- **Pharmacist send over Pears.** Built and self-tested on a server (VPS, Bare runtime) using a private bootstrap run by the pharmacist's phone on its hotspot, so no internet is needed in design. It has **not** been tried on two phones. It is **not usable in the app today**: no button on Home leads to it, and its native addons are not linked into the iOS build. The only protection on who receives the message is a 4-digit code; peer identity is not pinned yet (see Roadmap).

Printed Swahili label lines are shown but not read aloud (no Swahili voice runs on the phone) except through the Tafsiri templates above.

## Rules the product follows

- **It reads exactly what's written and never interprets a dose.** When it isn't sure it read something correctly, it says so and tells you to ask the pharmacist. It doesn't guess.
- **Nothing leaves the phone.** No cloud AI, no account, no analytics.
- **It works in airplane mode** once the models are downloaded.

## Hackathon entry

- **Track:** Offline AI apps (the overall prize is the main target).
- **Judged on:** real user value, meaningful QVAC integration, working implementation, usability, and a clear, reproducible offline demo.
- **Demo video script:** [docs/demo-script.md](docs/demo-script.md).

## Setup

Everything is in `mobile/`. Full steps, including the Xcode build, are in [mobile/README.md](mobile/README.md).

Fastest way to try it:

- **iPhone:** install the TestFlight build (link supplied with the submission). Needs iOS 17 or later on a physical iPhone; QVAC does not run in the simulator.
- **Android:** install the APK from the public releases repo, `veluvo-softwares/soma-nami-releases` (Android 12+, arm64). See "Tested devices" for what has and hasn't been run.
- Open the app on Wi-Fi once. It downloads the models (about 1.1 GB) and shows **Tayari** (ready). Then switch to airplane mode.

From source (Mac, Xcode, an iPhone, Node 24):

```bash
git clone https://github.com/veluvo-softwares/soma-nami
cd soma-nami/mobile
npm ci
npm run check                  # lint, typecheck, unit tests (what CI runs)
npx expo prebuild --clean      # generates ios/ and android/, links QVAC's native addons
npx expo start --dev-client    # leave running
open ios/SomaNami.xcworkspace  # pick the iPhone, Product > Scheme > Edit Scheme > Run > Release, Cmd+R
```

Use a Release build for the airplane-mode test: a Debug build loads its JavaScript from Metro. Don't use `expo run:ios` (fails on Xcode 27) and cancel Xcode's "Update to recommended settings"; both are explained in `mobile/README.md`.

## QVAC packages

| Package | Version |
|---|---|
| `@qvac/sdk` | 0.22.0 (exact) |
| `@qvac/fabric-ios`, `@qvac/fabric-android-arm64` | 0.22.0 |
| `@qvac/tts-ggml-ios`, `@qvac/tts-ggml-android-arm64` | 0.13.0 |
| `@qvac/asr-ggml-ios`, `@qvac/asr-ggml-android-arm64` | 0.10.0 |
| `react-native-bare-kit` | 0.16.0 |

Also: Expo SDK 54, React Native 0.81.5, React 19.1. QVAC plugins bundled (`mobile/qvac.config.json`): OCR, TTS, speech recognition, LLM completion.

## Models

Downloaded once, on Wi-Fi, by the app's first-run screen (`mobile/src/model-store/manifest.ts`). The reader stays locked until all are on the phone. No model file is committed to the repo.

| QVAC registry constant | Job | Size | Used by the app today? |
|---|---|---:|---|
| `OCR_CRAFT` | finds text in the photo | 83 MB | yes |
| `OCR_LATIN` | reads Latin-script text (so Swahili and English) | 15 MB | yes |
| `TTS_MULTILINGUAL_SUPERTONIC3_Q4_0` | English voice | 85 MB | yes |
| `WHISPER_SMALL_Q8_0` | hold-to-talk questions (Swahili) | 264 MB | yes (not yet run on a phone) |
| `TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M` | Tafsiri, English to Swahili | 672 MB | yes (not yet run on a phone) |

Total download: about 1.1 GB (1,120 MB, summed from the manifest). Qwen3 1.7B was tested in the spike as a question-answering model and dropped because it gave an unsafe dose answer; it is not downloaded. The OCR and TTS models come peer-to-peer over QVAC's registry (Hyperswarm); Whisper and TranslatePsy come over HTTPS from Hugging Face.

**Swahili speech.** Chatterbox multilingual (`TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0` + `TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0`) is the only Swahili-capable voice in QVAC's registry, and it runs 30 to 47 times slower than real time on a CPU, so it does not run on the phone. Every fixed Swahili phrase (prompts, hints, question read-backs, refusals and the Tafsiri dose and expiry pieces) was rendered with it ahead of time on a server through QVAC `textToSpeech` and ships in the app as a small audio clip in `mobile/assets/phrases/sw/`. To regenerate: `node mobile/scripts/phrases/generate.mjs`. These clips are covered by the build and tests; a Swahili speaker has not yet judged their pronunciation.

## Where QVAC is used

- `mobile/src/model-store/qvacClient.ts`: `getModelInfo`, `downloadAsset`, `cancel` (model presence and download).
- `mobile/src/reader/qvacReader.ts`: `loadModel` / `unloadModel` for OCR, the English voice and TranslatePsy, `ocr` on the photo (`canvasSize 1024`, `recognizerBatchSize 1`), `textToSpeech` per label line, and `translate` (English to Swahili, one line at a time) for Tafsiri.
- `mobile/src/reader/exclusiveModels.ts`: only one model is loaded at a time.
- `mobile/src/tafsiri/`: the Tafsiri flow, template speech and number check (plain code; the model call goes through `qvacReader.ts`).
- `mobile/src/listen/`: hold-to-talk. `expoRecorder.ts` records 16 kHz mono audio, and `whisper.ts` / `qvacListen.ts` load Whisper small through the one-model slot, transcribe in Swahili with the question list as the prompt, and unload it.
- `mobile/scripts/phrases/generate.mjs`: `textToSpeech` with Chatterbox, build-time only (not in the app).
- `mobile/app.json`, `mobile/qvac.config.json`, `mobile/plugins/withQvacCpuOnly.js`: the QVAC Expo plugin, bundled addons, and CPU-only execution on iOS (see below).
- `spike/`: the Node scripts used to test QVAC OCR, TTS, Whisper and Qwen on a server before the app was built. Results in [docs/spike-report.md](docs/spike-report.md).

QVAC runs on the CPU on iOS on purpose. QVAC's iOS build compiles its Metal shaders from source at each launch and iOS killed the shader compiler on the iPhone 12 (details and a draft upstream issue in [docs/qvac-metal-issue.md](docs/qvac-metal-issue.md)).

## Tested devices

| Device | OS | Result |
|---|---|---|
| iPhone 12 (4 GB) | iOS 26.6.1, built with Xcode 27.0 | Tested by hand 25 and 26 Oct (Release build, airplane mode): clean paracetamol and small-print ibuprofen labels were read end to end; a hard photo and a handwritten dose went to Not sure, the safe outcome. Models download and the app reports ready. |
| Any Android phone | Android 12+, arm64 | **Built, not tested on a physical device.** An APK is built on EAS and published to the releases repo, but no result from an Android phone has been recorded. Treat Android as untested. |

Not tested on a device: spoken month names, Ask (buttons and hold-to-talk), accessibility and setup, the OCR timeout, Tafsiri and Dawa zangu (including the iCloud exclusion) have unit and component tests, but have not been run on a phone, and VoiceOver has not been used with them. Pears has been self-tested on a server only. The Swahili clips have not been judged by ear.

## Memory and speed

Measured on the iPhone 12 in a Release build (Xcode memory gauge), 26 Oct:

- Peak **1.44 GB** during one read (OCR), back to about **531 MB** idle once the models are freed. The app was never killed.
- OCR takes about **22 s** per photo on the phone's CPU (828 x 1280 photo, `canvasSize 1024`).
- Ask with buttons loads no model, so it adds no model memory. Hold-to-talk loads Whisper small (264 MB file) for the transcription step only; its memory and speed on the iPhone 12 are **not measured**.
- Tafsiri loads TranslatePsy (672 MB file) for the translate step and unloads it straight after. Its memory and speed on the iPhone 12 are **not measured**.

On a one-core server, OCR took 78 s (spike report). Android memory has not been measured.

## Licences

| Component | Licence | Checked how |
|---|---|---|
| This repo | Apache-2.0 | `LICENSE` |
| `@qvac/sdk` | Apache-2.0 | package metadata |
| EasyOCR CRAFT and Latin models (`OCR_CRAFT`, `OCR_LATIN`) | Apache-2.0 | upstream repo, in the spike |
| Supertonic 3 | OpenRAIL-M (use restrictions apply; commercial use allowed) | upstream model card |
| Chatterbox multilingual (clips only) | MIT | upstream repo, in the spike; we ship its output, not the model |
| Whisper small | MIT | upstream repo, in the spike |
| Qwen3 1.7B (spike only, not in the app) | Apache-2.0 | upstream Hugging Face page, in the spike |
| TranslatePsy-AfriSLM 0.8B (Tether) | Apache-2.0 | Hugging Face model metadata for `qvac/TranslatePsy-AfriSLM-0.8B-Q4-GGUF`, checked 29 Oct |
| Atkinson Hyperlegible font | SIL Open Font License 1.1 | `mobile/assets/fonts/OFL.txt` |

Licences were read from upstream pages, not from the quantised copies in QVAC's registry. QVAC Genesis datasets (CC-BY-NC) are not used.

## What needs a network

- **First-run model download** (about 1.1 GB): needs the internet once. OCR and TTS models use QVAC's peer-to-peer registry; Whisper and TranslatePsy use huggingface.co.
- **Installing the app**: TestFlight or the GitHub releases page.
- **"Call my helper"** hands the saved number to the phone's dialler; that is a phone call, not an app network request.
- **Pears pharmacist send** (not usable in the app yet, see above) is designed to use a local Wi-Fi or hotspot link between two phones, not the internet.

Nothing else. Reading, speaking, framing hints, Not sure, Ask, Tafsiri and Dawa zangu are written to run with no connection, and the app has no account, analytics or cloud AI calls. The read path has been tested in airplane mode on the iPhone; Ask, Tafsiri and Dawa zangu have not yet been run in airplane mode on a phone.

## Built during the event

Everything in this repository was written from 24 October 2026 onward (first commit 24 Oct 2026). There was no earlier version of Soma Nami. Third-party work used:

- QVAC SDK and its model registry (Tether), Expo and React Native, `expo-camera`, `expo-audio`, `expo-image-picker` and the other packages in `mobile/package.json`.
- The models in the table above, from their upstream authors; the Pears worklet uses Hyperswarm and the Bare runtime (Holepunch) packages listed in `mobile/pears/package.json`.
- Atkinson Hyperlegible (Braille Institute), the bundled font.
- Test and spike fixtures are synthetic: invented generic medicine labels drawn by `spike/make_images.py`, with handwriting-style fonts (OFL / Apache-2.0) standing in for handwriting. No real prescription or person's data is in the repo.

The code, Swahili phrase text, matching rules and tests were written during the event, with AI coding assistants doing much of the implementation.

## Roadmap

Next steps: checking hold-to-talk, Tafsiri, Dawa zangu and Ask on a phone (and switching to Whisper base, about 3x faster, if Whisper small is too slow on the CPU); finishing the pharmacist hand-off over Pears (add an entry button on Home, link the native addons into the iOS and Android builds, check it on two phones in airplane mode, and **pin the peer's identity** so the 4-digit code isn't the only protection). Beyond that: Kikuyu. English to Kikuyu translation models exist (C-elo Labs, DeepSahel), but there is no open, offline Kikuyu voice yet, which is the blocker. See [docs/scope.md](docs/scope.md) section 9.

## License

Apache-2.0. See [LICENSE](LICENSE).
