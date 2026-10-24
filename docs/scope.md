# Soma Nami: technical scope

Card C1. Rules: [hackathon.md](hackathon.md). Written 24 Oct 2026.

Tags: **[V]** verified on the VPS or from a cited source, **[A]** assumption to be tested in the C2 spike or on Wesley's phone.

## 1. Decisions at a glance

| Job | Primary choice | Size | Swahili | Licence | Fallback |
|---|---|---:|---|---|---|
| OCR, printed text | `OCR_LATIN` + `OCR_CRAFT` (EasyOCR detector and Latin recogniser, GGML) | 15 MB + 83 MB | Latin script, so yes for reading [A] | Apache-2.0 (EasyOCR) [A] | `OCR_DOCTR` (12 MB) |
| OCR, hard cases (handwriting, curved boxes) | `OCR_0_6B_MULTIMODAL_Q4_K_M` (LightOnOCR-2, vision LLM) | 397 MB + 819 MB mmproj | n/a | to check in C2 | none; we say "can't read this, ask the pharmacist" |
| Read aloud, English | `TTS_MULTILINGUAL_SUPERTONIC3_Q4_0` | 85 MB | **No** [V] | OpenRAIL-M [V] | Supertonic 3 Q8 (127 MB) |
| Read aloud, Swahili | `TTS_T3_MULTILINGUAL_CHATTERBOX_Q4_0` + `TTS_S3GEN_MULTILINGUAL_CHATTERBOX_Q4_0` | 345 MB + 788 MB | Yes, `sw` is on the supported list [V] | MIT (upstream Chatterbox) [A] | Android system TTS for Swahili (not QVAC); go/no-go in C2 |
| Grounded Q&A | `QWEN3_1_7B_INST_Q4` | 1,057 MB | weak to fair [A] | Apache-2.0 | `QWEN3_600M_INST_Q4` (382 MB) |
| Swahili ↔ English (only if Wesley approves, see §6) | `TRANSLATEPSY_AFRISLM_0_8B_TRANSLATION_Q4_K_M` | 672 MB | Yes [V] | Apache-2.0 [V] | none |
| Voice questions (bonus) | `WHISPER_SMALL_Q8_0` | 264 MB | Whisper's own Swahili results are weak [A] | MIT | `WHISPER_BASE_Q8_0` (82 MB); typed questions |

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
- **Fallback if P2P fails** (on the phone, or on the Node NBO Wi-Fi): any model can also be loaded from a local file path. For the demo we can pre-stage `.gguf` files with `adb push` and load them by path [A, to test in C3].
- **Demo rule:** download every model once, on Wi-Fi, before switching to airplane mode. The app shows a "models ready" screen and refuses to start a read until they are present.

## 4. Expo dev build

From the QVAC docs ([JS/TS SDK](https://docs.qvac.tether.io/sdk/js-ts-sdk/), [system requirements](https://docs.qvac.tether.io/sdk/system-requirements/)) [V]:

- Expo SDK ≥ 54, dev build (not managed): `npx expo prebuild`, then `npx expo run:android --device`.
- `app.json` plugins: `expo-build-properties` with `android.minSdkVersion: 29`, and `@qvac/sdk/expo-plugin`.
- Android 12+ on arm64. Vulkan is used where available, plus OpenCL on Adreno 700+. **No emulators**: a physical device is required.
- On the VPS, CI can run lint, typecheck and unit tests. Building the APK needs the Android SDK and more RAM than the VPS sandbox comfortably has, so the APK is built on GitHub Actions or on Wesley's machine (C3 decides).

## 5. Memory budget (4 GB Android phone)

Assume about 1.5 GB is usable by our app after Android and other apps [A]. Models are loaded **one at a time** and unloaded between steps:

| Step | Loaded models | Approx. RAM |
|---|---|---:|
| Read | OCR (CRAFT + Latin) | ~0.2 GB |
| Speak (English) | Supertonic 3 Q4 | ~0.2 GB |
| Speak (Swahili) | Chatterbox mtl Q4 (T3 + S3Gen) | ~1.3 GB [A], tight |
| Ask | Qwen3 1.7B Q4, 2k context | ~1.3 GB [A]; drop to 0.6B if the phone struggles |
| Voice question | Whisper small Q8 | ~0.4 GB |

Total disk for the full set (without LightOnOCR or AfriSLM) is about 2.6 GB. A 6 GB phone gives real headroom. **Ask Wesley which phone he will demo on.**

## 6. Product risks that the scope exposes

1. **Translation conflicts with "read exactly what's written".** Most packaging in Kenya is printed in English. Reading it aloud in Swahili means translating it, and a translated dose is an interpretation. Proposal: Swahili mode reads the app's own interface and fixed phrases in Swahili, reads label text **verbatim** in its original language, and offers translation only as an explicitly labelled "tafsiri" (translation) with every number checked against the source. **Needs Wesley's decision.**
2. **Handwriting ("1×3", "2 bd").** EasyOCR is not built for handwriting. The rule is: if OCR confidence on a dose-like line is below threshold, the app says it can't read it and to ask the pharmacist. That is a product feature, not a failure. The C7 Pears hand-off is the real fix.
3. **Swahili TTS weight.** If Chatterbox is too slow or too large on the phone, the fallback is Android's built-in Swahili voice for speech, while QVAC still does OCR and Q&A. That weakens the "meaningful QVAC" story on one feature only.
4. **SDK churn.** 0.x with fast releases. Pin to 0.22.0 and do not upgrade during the week.

## 7. Offline demo plan

1. Show airplane mode switched on, on camera.
2. Point the camera at a generic, printed medicine box (synthetic label, no names). The text appears in large type and is read aloud.
3. Ask "How many times a day?" (typed, or spoken if ASR passes). The answer quotes the exact line from the label.
4. Ask something the label doesn't say ("Can I take it with alcohol?"). The app says the label doesn't say and to ask the pharmacist.
5. Show a handwritten "2 bd" envelope. The app flags low confidence and tells the user to ask the pharmacist.
6. Switch to Swahili and repeat step 2.
7. Stretch: the pharmacist's phone sends the instruction to the patient's phone over Pears, still in airplane mode with local Wi-Fi or Bluetooth.

## 8. Licences

| Model | Licence | Status |
|---|---|---|
| QVAC SDK | Apache-2.0 | [V] |
| Supertonic 3 | OpenRAIL-M (use restrictions, commercial use allowed) | [V] |
| Chatterbox multilingual | MIT upstream | [A] check in C2 |
| EasyOCR models | Apache-2.0 upstream | [A] check in C2 |
| LightOnOCR-2 | unknown | check in C2 before use |
| Qwen3 | Apache-2.0 | [A] check in C2 |
| TranslatePsy-AfriSLM | Apache-2.0 | [V] |
| Whisper | MIT | [A] |
| QVAC Genesis datasets | CC-BY-NC 4.0, **not used** | [V] |

## 9. What C2 must answer

1. EasyOCR accuracy on printed medicine packaging (our own synthetic photos), and its confidence scores on handwriting.
2. Chatterbox Swahili quality and speed on 4 vCPUs; Supertonic 3 English quality. Wesley listens to the audio.
3. Grounded Q&A with Qwen3 1.7B vs 0.6B: does it quote, and does it refuse?
4. Whisper small vs base on a few Swahili clips.
5. Peak RAM for each step, as a stand-in for the phone budget.
