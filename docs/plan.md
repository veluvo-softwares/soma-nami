# Soma Nami: card plan

Rules for every card: [hackathon.md](hackathon.md). Scope: [scope.md](scope.md). UI: [ui.md](ui.md). One branch and one PR per card. At most 2 cards in progress at once.

The live status is on the `soma-nami` Kanban board; the board wins over this file. Each card's worker updates its row here when the card closes. Each card clones the repo into `/workspace/soma-nami-<card>` so parallel workers never share a working tree.

**Platforms (decided 24 Oct):** iOS first. Wesley develops and demos on his **iPhone 12** (4 GB RAM, iOS 17+). He has a paid Apple Developer account: iOS builds are made with **EAS Build** on Expo's servers, triggered by Bond, and go to testers through **TestFlight** (C10). The Android APK is built with **EAS Build** on a version tag (decided 26 Oct; the GitHub Actions Gradle build was unreliable) and published to a separate **public releases repo** (C10), for judges and Android testers. Nobody on the team owns an Android phone, so the first real Android test is a borrowed phone at the Wed 28 Oct offline check (C12).

Hand-offs to Wesley (C3a, C4a, C12) are not separate board cards: the Bond card they follow blocks with exact steps, and Wesley reports back on it.

| Card | Board id | Title | Depends on | Who | Status | Branch / PR |
|---|---|---|---|---|---|---|
| C1 | `t_3d199e48` | Technical scope → `docs/scope.md` | none | Bond | done | `docs/scope`, #2 |
| C2 | `t_250daa6d` | VPS spike: OCR, TTS, Q&A, ASR, TranslatePsy; go/no-go by Sun 25 Oct 21:00 | C1 | Bond | done 25 Oct: overall GO, see [spike-report.md](spike-report.md) | `feat/c2-spike`, #8 |
| C3 | `t_22903510` | Expo dev-build + QVAC app scaffold, CI, Android APK job | C1 | Bond | done: #7 merged (CI and APK build green); iOS run steps switched to Xcode | `feat/c3-app-scaffold`, #7; `docs/c3-xcode-run-steps` |
| C3a | (block on C3 or C10) | iOS hand-off: first build on Wesley's iPhone | C3 | Wesley | done 25 Oct: iPhone 12, iOS 26.6.1, Xcode 27.0. Launches dark in Atkinson Hyperlegible; all 5 models (1.5 GB) download and it shows Tayari; memory 385.9 MB peak, 376.6 MB steady (no model loaded, so OCR's peak is checked in C4); no prebuild error. `expo run:ios` fails on Xcode 27, so it was built from Xcode | |
| C3b | none | Android APK on an arm64 emulator on Wesley's Mac (record what happens) | C3 | Wesley | optional | |
| C4 | `t_ad242ab0` | Home, Aiming, Reading: camera → OCR → read aloud | C2, C3 | Bond | in review: C4a done 25–26 Oct; fixes from it in #11 (CPU-only QVAC, clip skip, framing on the main block, details not spoken, Xcode 27 build); second Release read passed 26 Oct (OCR ~22 s, peak 1.44 GB, offline works); rebased on main, ready for Wesley to merge | `feat/c4-read-aloud`, #11 |
| C4a | (block on C4) | iOS hand-off: read-aloud on the iPhone, in airplane mode (Tue 27 Oct) | C4, C3a | Wesley | first run done 25–26 Oct (results under C4); second Release read after the #11 fixes | |
| C5 | `t_99e45430` | Ask: hold-to-talk, fixed questions, quotes the line, refuses when unsure | C4 | Bond | in review: engine, Ask screen and clips built; the microphone + Whisper wiring is not (see C5 details) | `feat/c5-ask`, PR |
| C5b | `t_ef69a490` | Hold-to-talk: real `ListenService` (expo-audio mic + QVAC Whisper small) for the Ask screen | C5 (#21) | Bond | in review: built and unit tested; needs the iPhone test (Release, airplane mode) | `feat/c5b-listen`, #26 |
| C6 | `t_cebb50ba` | Accessibility, language, Not sure, caregiver setup, theme | C4 | Bond | in review: VoiceOver label+hint on every control (Swahili/English swap), Kiswahili/English toggle, caregiver setup screen (language, voice speed, theme, helper number, models), Not sure with "Mpigie msaidizi"; 265 tests, lint and typecheck pass locally; label text untouched, translation is C11 | `feat/c6-accessibility-language` |
| C10 | `t_c473c258` | Distribution: iOS via EAS to TestFlight, Android APK to the public releases repo | C3 | Bond, Wesley's accounts | in progress: `eas.json`, Info.plist strings, APK publish job and releases README merged (#10). 26 Oct: Expo project `@mrnyamu/soma-nami`, App Store Connect app (ascAppId 6826935644) and Expo-managed iOS credentials set up by Wesley; egress allowed; IDs committed (#13). First EAS build 0.1.0 (1) submitted to App Store Connect 26 Oct (see the build log). Left: TestFlight testers (Wesley), and the first Android release on a `v*` tag (releases repo and RELEASES_TOKEN ready 26 Oct; EAS Android profile and tag workflow in #17, verification build `adf23352`) | `feat/c10-distribution`, `chore/c10-eas-ids`, `docs/c10-first-eas-build` |
| C11 | `t_cb8e5f17` | Tafsiri: English → Swahili with the number check | C2, C4 | Bond | done 29 Oct: #25 merged; not tried on the iPhone yet (C11a below) | `feat/c11-tafsiri` |
| — | `t_781bfd28` | Drop Qwen3 1.7B from the model download list (nothing loads it; −1.06 GB) | C11 | Bond | in review 29 Oct: manifest, qvacClient, tests and docs updated; root README change is a comment on #23 (C8). For build 3 | `chore/drop-qwen` |
| C12 | (Wesley's checklist) | Android real-phone test at the Wed 28 Oct offline check (borrowed phone) | C4, C10 | Wesley | todo | |
| C9 | `t_80394eb8` | Dawa zangu: saved medicines with caregiver-set times | C4, C6 | Bond | in review 29 Oct: save after a read, photo cards, replay from storage with no OCR, "Sasa" for caregiver-set times, times and delete in setup. Stacked on C6 (#22): merge #22 first, then rebase this onto main. Not yet checked on the phone | `feat/c9-dawa-zangu` |
| C9a | `t_2ae80fa0` | Keep saved medicines and settings out of iCloud backup | C9 | Bond | in review 29 Oct, on the C9 branch (#27): all saved data in one `local-only/` folder flagged NSURLIsExcludedFromBackupKey by a small local native module (expo-file-system 19.0.24 has no such API); old Documents files moved once; Android Auto Backup off. Needs a new dev build; not yet checked on the phone | `feat/c9-dawa-zangu` |
| C7 | `t_3605b8f3` | Stretch: pharmacist send over Pears | C4, C5, C6 working offline | Bond | in review: private-bootstrap design proven on the VPS under Bare, worklet + app side + screens built and tested; not on Home yet, native addons not linked, no two-phone check yet (see card details) | `feat/c7-pears-send` |
| C8 | `t_55dd85be` | Submission pack: README (both platforms, tested devices) and demo video script | C4a, C5, C6, C11, C12 | Bond prepares, Wesley submits | todo | |

Priority order after C4: C5, C6, C11, then C9, then C7. C9 and C7 are cut first if Thursday looks tight. C10 runs alongside C4 so TestFlight is ready for the Tuesday milestone.

Card numbers changed on 25 Oct: Dawa zangu is now C9 and Tafsiri C11 (they were C10 and C9 in an earlier draft), and the Android phone test is C12.

## Card details

### C1 Technical scope
Done in PR #2.

### C2 VPS spike
Run QVAC in Node on the VPS. Output: `spike/` scripts, `docs/spike-report.md` with numbers, audio attached to the card, a go/no-go per capability by **Sun 25 Oct 21:00 EAT**.
1. OCR (`OCR_LATIN` + `OCR_CRAFT`) on synthetic photos of printed generic medicine packaging and self-made handwritten "1×3" / "2 bd" labels: accuracy and confidence scores.
2. TTS: English with Supertonic 3; Swahili with Chatterbox multilingual Q4. Time, peak RAM, WAVs for Wesley to listen to. Run Chatterbox with more threads too, if the sandbox allows (the first run used one).
3. Grounded Q&A, Qwen3 1.7B vs 0.6B: quotes the line, refuses at least 5 cases the label doesn't cover.
4. Whisper small vs base on a few Swahili clips, judged for matching a fixed list of questions (C5), not open transcription.
5. TranslatePsy-AfriSLM 0.8B Q4 (2B Q4 as the option): 20 synthetic label lines with doses and frequencies, English → Swahili. Report every case where a number, unit or frequency changed or went missing.
6. Can the same TranslatePsy model answer label questions ("Hii ni ya saa ngapi?") grounded in the label text? If yes, one model does both jobs and we save memory.
7. Memory: peak RAM per step, what drives the OCR step's 3.3 GB peak, and whether each step fits an iPhone 12.
8. Whether the OCR, TTS, Whisper and LLM addons in `@qvac/sdk` 0.22.0 all ship for iOS.
9. Does iOS have a built-in Swahili system voice? (Wesley checks on his iPhone: Settings → Accessibility → Spoken Content → Voices.)

### C3 App scaffold
Expo SDK 54+ dev build (not managed), TypeScript, `@qvac/sdk` pinned at 0.22.0 with its Expo plugin (JSON config; `installMissingPrebuilds` if prebuild reports missing binaries). iOS deployment target 17.0; Android `minSdkVersion` 31 and arm64 only (QVAC needs Android 12+ arm64; raised from 29 on 26 Oct). ESLint, typecheck, Jest. GitHub Actions on Linux: lint, typecheck and tests on every PR, and, until 26 Oct, an arm64 Gradle APK job on version tags (`v*`); C10 moved the release APK to EAS Build. No macOS jobs: macOS minutes on a private repo cost money. Models screen that downloads all models once and blocks reads until they are present. Atkinson Hyperlegible bundled.

### C3a iOS hand-off: first build
Once C10 has the EAS pipeline, Wesley installs the first build from TestFlight. If C10 isn't ready in time for Tuesday, the fallback is a local build on his Mac: `git pull && cd mobile && npm ci && npx expo prebuild`, then `npx expo start --dev-client`, open `ios/SomaNami.xcworkspace`, pick the iPhone and press Cmd+R, signed with his developer team (not `npx expo run:ios`, which fails on Xcode 27; see mobile/README.md). Every iOS hand-off, including C4a, uses these Xcode steps. Report back: iOS version, does it launch, do the models download, RAM in Xcode's debug gauge.

### C3b Android emulator check (optional)
Wesley runs the CI APK on an arm64 Android emulator (Android 12+ image) on his Mac. QVAC documents physical devices only, so this may fail; record exactly what happens, with logs. It blocks nothing.

### C4 Home, Aiming, Reading
Screens 1–3 of [ui.md](ui.md). Tap anywhere to take the photo, then spoken guidance from where the text sits in that photo ("Sogeza kushoto kidogo", closer, more light) and try again; live auto-capture only if the phone runs the detector fast enough (see scope.md §6). QVAC OCR on device, label lines in large type with the spoken line highlighted. Label text is read in its printed language: English with Supertonic. Every fixed Swahili phrase (prompts, hints, not-sure lines, read-backs) is generated ahead of time with Chatterbox on the VPS and shipped as audio; the generator script lives in the repo. Low-confidence lines are marked and read as "I couldn't read this line". Works in airplane mode. Tests for the OCR result → display/speech pipeline. Target: on the iPhone by Tue 27 Oct; airplane-mode build Tue night.

Built (PR #11, 25 Oct), details in `mobile/README.md` → Reading:
- Photo from the camera (tap anywhere) or the library (**Chagua picha**), shrunk to 1280 px, OCR with the spike's low-memory settings (`canvasSize 1024`, `recognizerBatchSize 1`). One model loaded at a time: OCR is unloaded before Supertonic loads.
- After each photo: read it; or a spoken hint (left, right, up, down, further, closer, no text) with **Soma hii** to read what was found anyway; or Not sure (screen 5, minimal; C6 finishes it).
- Decisions made in the card, to check on the phone: (1) an unsure line's OCR text is **not shown**, only an orange "Mstari huu sijaweza kuusoma vizuri" box, because showing a misread dose is a guess; (2) a short page with a number on it, or dosing shorthand (`bd`, `tds`, `nocte`, `1x3`), goes to Not sure: on the real OCR fixture "Tab 1 tds" came back as "Tab 4 tds" at confidence 0.55, above the gate; (3) Swahili label lines are shown but not spoken (no Swahili voice on the phone), with one clip saying they're on screen.
- 25 Swahili clips rendered with Chatterbox on the VPS (`mobile/scripts/phrases/generate.mjs`), AAC, ~10 kB each. Wesley to judge them by ear in C4a.
- Not verified on the VPS: anything native (camera, QVAC on the A14, audio playback, memory, speed). That is C4a.

C4a results (Wesley, 25–26 Oct, iPhone 12, iOS 26.6.1, Xcode 27.0): the clean paracetamol label read end to end; ORS clean → hint, ORS hard → Not sure, handwritten h5 → Not sure (all correct except the hint); OCR 49–51 s per 828×1280 photo on the CPU; memory peak 1.64–1.69 GB during OCR, ~850 MB after, never killed; Release in airplane mode works (OCR, Supertonic and the clips all offline). Fixed in PR #11 after that (26 Oct):
- **Metal**: QVAC's iOS build (`@qvac/fabric-ios` 0.22.0, and 0.23.1) only has the shaders as source and compiles all 21 libraries in parallel at launch; iOS kills `MTLCompilerService` (~500 MB vs a 100 MB limit). There is no way to ship a precompiled metallib with this SDK. The app now runs QVAC on the CPU on purpose (`GGML_METAL_DEVICES=0`, `plugins/withQvacCpuOnly.js`) so the four failed compiles per launch stop. OCR also never asked for Metal (`backendDevice` defaults to `cpu`). Draft upstream issue for Wesley: `docs/qvac-metal-issue.md` (not filed). OCR speed stays CPU-bound; detection is ~85–90 % of the time on the VPS, so `canvasSize` is the lever.
- A Swahili clip that fails to load or play is skipped; the English lines are still read.
- The framing hint uses only the main block of text, so stray text at the photo's edges doesn't trigger it.
- Batch / lot, manufacturing dates, barcodes and the maker's name and address aren't spoken; they're shown under More details. The expiry date is always spoken.
- Xcode 27: pods raised to iOS 17.0 (SDWebImage's resource bundle was 9.0) and `ENABLE_USER_SCRIPT_SANDBOXING = NO`, both in `plugins/withIosBuildFixes.js`. Testers cancel Xcode's "Update to recommended settings".
- Still open: printed Swahili label lines aren't read aloud (undecided). OCR timeout and deskew: see C4 follow-ups below.

C4a second run (Wesley, 26 Oct, iPhone 12, iOS 26.6.1, PR #11 at `d52a84c`, CPU-only QVAC):
- Release, Xcode attached, network on: clean paracetamol label → read (OCR 21.9 s, 828×1280, 24 blocks, 11 lines); hard paracetamol photo → Not sure (22.2 s, 13 lines), the safe outcome.
- Memory: peak 1.44 GB during a read, back to ~531 MB idle (models are freed after a read). No kill. (Debug peaked at 1.64 GB and idled at ~1.62 GB.)
- Release, airplane mode, launched from the home screen without Xcode: clean paracetamol and small-print ibuprofen both read. Offline works. An earlier hang on switching to airplane mode was the Xcode debugger losing the phone, not the app.
- OCR is ~22 s per photo on the phone (the VPS takes 78 s on one thread), so `canvasSize` stays at **1024** (Wesley, 26 Oct); 768 would misread small print ("1 OF 2").
- Console `fopen failed for data file: errno = 2` lines: written by Apple's `libCoreFSCache.dylib` (the graphics shader cache) on first use. Not an app, QVAC or model file: no QVAC binary or package in `node_modules` contains the string. Harmless, nothing to ship or fix.
- Not yet checked: the spoken expiry line and the More details split (check in the TestFlight build); Polepole / Rudi.

C4 follow-ups (`feat/c4-ocr-timeout-deskew`):
- OCR timeout: `recognize()` gives up after 120 s (`OCR_TIMEOUT_MS`; a read is ~22 s on the iPhone 12, ~50 s in Debug). `ExclusiveModels.use` takes `timeoutMs`; on timeout it rejects with `JobTimeoutError`, unloads the OCR model (waits at most 10 s, then abandons it so the voice queued behind is not stuck), and drops the engine's late result or error. The next read loads a fresh model. ReadFlow already turns any OCR error into the `error` clip and back to the camera. Tested in `exclusiveModels.test.ts` and `ReadFlow.test.tsx`.
- Deskew: **not shipped.** Measured on the VPS (`spike/deskew_eval.mjs`, `spike/deskew.py`, results in `spike/results/deskew_eval.json`). A projection-profile angle estimate costs ~100 ms and needs no second OCR pass, so it would not double the time. But it doesn't help reliably: p4_ors_sw_hard (-11.75°) CER 0.386 → 0.293 and still flagged Not sure; p1_paracetamol_hard CER 0.252 → 0.278; p5_ibuprofen_small_hard CER 0.028 → 0.092 and it stopped being flagged while reading worse (the unsafe direction); p2 and p3 unchanged. Not sure on a badly tilted photo is the safe outcome, so it stays. Possible later: rotate only past ~8°, tested on more than one tilted photo (only one here).

### C4a iOS hand-off: read-aloud on the iPhone
C4 blocks for Wesley: install the latest TestFlight build (or build locally), then a scripted test in airplane mode with the synthetic labels in `spike/fixtures` printed out. Report: works or not, time to first spoken word, crashes, RAM.

### C5 Ask
Screen 4. Hold-to-talk is the main input (decided 24 Oct). Whisper's Swahili transcript is matched with fuzzy, character-level matching against a fixed list of questions ("saa ngapi", "mara ngapi", "nimeze ngapi", "na chakula", "ni dawa gani", "soma tena"). The app repeats the matched question back from a pre-made clip ("Umeuliza: ..."), then reads the label line that answers it exactly as printed, with the quote on screen. No match: "Sijaelewa, jaribu tena". The label doesn't say: "Lebo haisemi. Muulize mfamasia." The questions are always shown as large buttons too. The model never answers a dose question; if Qwen is used at all, only to pick which label line answers a matched question. Unit tests for the matcher on misspelled transcripts, for refusal cases, and for numbers in answers matching the source exactly.

Built (28 Oct, `feat/c5-ask`), code in `mobile/src/ask/` and `screens/read/AskScreen.tsx`:
- **No model writes an answer.** `answer.ts` picks the label line(s) by pattern (time of day, how often, how much per dose, food, name, expiry) and returns them quoted exactly as OCR read them; what is spoken is that line (batch codes cut out, as in Reading). Qwen is not used at all, so it cannot invent or compute a number. Since 29 Oct (`t_781bfd28`, `chore/drop-qwen`) it is not downloaded either: the models screen lists OCR, Supertonic, Whisper small and TranslatePsy, ≈1.1 GB instead of ≈2.2 GB. Build 3 should include this.
- **Refuses** (pharmacist clip, no label text): the label doesn't say; the line that would answer is below the OCR gate, or, for a dose/time question that found nothing, any line was unreadable (the answer may be in it); more than half the label unreadable; two lines with different numbers (conflict). A ceiling line ("do not take more than 8") and a strength line ("each tablet contains 500 mg") are not taken as the dose. Alcohol, children, pregnancy, allergy, missed-dose words go to the pharmacist whatever the matcher thinks.
- **Matcher** (`match.ts`) uses the spike's settings (min similarity 0.5, margin 0.15, spaces dropped). Tests use Whisper small's real spike transcripts ("Hini dawagani?" → which medicine) and off-list ones (must not match).
- **Ask screen**: mic (only when a `listen` service is wired), the seven questions as large blue buttons, the question repeated back from a clip, the dashed "Lebo inasema" quote, "Rudi kwa lebo". Soma tena returns to the label, which reads again. Reached from a new **Uliza swali** button on Reading. 14 new Swahili clips rendered on the VPS.
- **Not built, needs the phone** (now C5b): `ListenService` (record with expo-audio, 16 kHz WAV, Whisper small via QVAC, mic permission string in Info.plist, model load/unload next to OCR so memory stays under the iPhone 12's limit). The screen and its tests use a fake. Until it is wired the app shows the buttons only. This needs a device test (C4a-style), so it is a follow-up card.
- The Swahili clip texts and the pattern lists are English/Swahili guesses from synthetic labels. Real labels will have wording we haven't seen; the safe failure is a refusal.

### C5b Hold-to-talk (ListenService)
Built 29 Oct (`feat/c5b-listen`, on top of #21), code in `mobile/src/listen/`:
- **Record** (`expoRecorder.ts`): expo-audio straight to a 16 kHz mono 16-bit linear-PCM WAV on iOS, one recorder per press, released and the audio session put back to playback on every way out. The recording is deleted as soon as it is read: the user's voice is never kept. iOS only; Android keeps the buttons (its recorder can't write linear PCM).
- **Convert** (`pcm.ts`): parse the WAV chunk by chunk (iOS adds a padding chunk), downmix and resample if iOS hands back something else, and write raw s16le to a `.pcm` file. The SDK would send a `.wav` through FFmpeg, which the app doesn't bundle (`includeAudioDecoder: false`).
- **Transcribe** (`whisper.ts`, `qvacListen.ts`, `reader/qvacReader.ts`): Whisper small Q8 from the phone's cache only, through the same one-model-at-a-time slot as OCR and the voice (`exclusiveModels.ts` job `asr`), so OCR and Supertonic are unloaded before Whisper loads, and Whisper is unloaded before the transcript is returned. Swahili, greedy, temperature 0, CPU, 4 threads, prompted with the full form of every list question (the C2 spike's "prompted" mode, set at load as `initial_prompt` instead of per call, which would make the SDK reload the model). Logs `[soma] asr load <ms>` and `[soma] asr <ms>, <ms> of audio` (load + transcribe + unload).
- **Exits** (`holdToTalk.ts`, Ask screen): under 0.5 s → "Sijaelewa, jaribu tena" without loading Whisper; mic permission refused → the mic is hidden for the visit, a note says to allow it in Settings, the buttons work; Whisper not downloaded → same, before the mic is asked for; recording or Whisper error → "Sikuweza kusikia. Tumia vitufe.", mic usable again; screen left while recording, while Whisper loads (load cancelled) or mid-transcription (Whisper cancelled) → the mic is switched off and Whisper unloaded, nothing is said. The transcript only goes to `ask/match.ts`, unchanged.
- **Open**: speed and memory on the iPhone 12 on CPU. The spike measured Whisper small at 28 s warm load and ~15 CPU-s per question on one x86 core, so expect tens of seconds between letting go and the answer. If it is too slow, swap in Whisper base (3.3× faster, less Swahili headroom) and tighten the matcher (spike report §5). The mic-off notes are text only; the spoken part reuses the existing "Tumia vitufe" clip.

### C6 Accessibility, language and setup
Screens 5 and 7. VoiceOver (and TalkBack) labels on every control, 88 pt targets, Swahili/English interface, Not sure screen, caregiver setup (language, voice speed, theme, helper's number, models status). Label text is read verbatim; translation is C11. Swahili speech comes from the pre-made clips (C4).

### C9 Dawa zangu
Screen 6. Saved labels as photo cards; tapping one reads the saved text again from storage, without running OCR again. Time of day (asubuhi / mchana / jioni / usiku) **set by the caregiver**, never inferred from the label; the one due now outlined in yellow. Stored only on the phone.

### C10 Distribution
iOS: `eas.json`, `eas build -p ios` and `eas submit` to TestFlight, run on Expo's servers and triggered by Bond with an `EXPO_TOKEN`. Wesley sets up the Apple credentials once with `eas credentials` on his Mac; no Apple keys on the VPS or in the repo. Stays on Expo's free plan. Android (since 26 Oct): on a version tag, `android-release.yml` builds the APK on EAS with the `release-apk` profile (arm64, minSdk 31, EAS-managed keystore) and publishes a GitHub Release to the public releases repo Wesley creates, using a token scoped to that repo only. The Gradle job in `android-apk.yml` is a manual fallback, off the release path. TestFlight's Beta App Review for external testers takes about a day, so the first external build goes in by Wed 28 Oct.

How to run both is in `mobile/README.md` (iOS: TestFlight through EAS Build; Android APK). EAS Build from the Bond VPS needs `api.expo.dev`, `expo.dev` and `storage.googleapis.com` (project upload and build logs) on the egress allowlist; `registry.npmjs.org` is already there. Creating the Android keystore from the VPS (once, on the first Android build) also needs `keystore.expo.dev`, because the sandbox has no `keytool`; it is not on the allowlist (403 on 26 Oct). Wesley created that keystore from his Mac instead (26 Oct, `soma-nami-release`), so the host isn't needed. Downloading a finished build's APK from the VPS needs `wf-artifacts.eascdn.net` (where expo.dev's artifact link redirects); it is not on the allowlist either (403 on 26 Oct). The tag workflow downloads it on GitHub's runner, so only checks from the VPS need it.

**EAS build log.** Expo's free plan allows only a few iOS builds a month, so every build is logged here.

| Date | Profile | Commit | Why | Result |
|---|---|---|---|---|
| 26 Oct 01:44 EAT | production (store) | `0442058` | First build to prove the pipeline: C3 scaffold plus the app icon (#12). C4 (#11) not merged yet, so no read-aloud in it | Build `9e90c660` finished in ~3 min, 0.1.0 (1). Submitted to App Store Connect with `eas submit` (submission `dbd33827`, finished). The CLI's TestFlight group setup was skipped because Apple's API is not on the sandbox egress list; testers are added in App Store Connect |
| 26 Oct 13:39 EAT | release-apk (Android APK, internal) | `91726d8` | One verification build of the C10 Android profile before merging #17 (no tag, nothing published) | Build `adf23352` finished, 0.1.0 (versionCode 3), signed with the EAS-managed keystore `soma-nami-release`; Gradle `assembleRelease` 5m 27s, APK 317 MB. The log shows minSdk 31 and `reactNativeArchitectures` arm64-v8a (the app's `ndk.abiFilters`). The APK itself could not be downloaded from the VPS (`wf-artifacts.eascdn.net` 403), so its `lib/` and manifest were not inspected directly |

### C11 Tafsiri
"Tafsiri kwa Kiswahili" on the Reading screen. TranslatePsy-AfriSLM 0.8B Q4 (2B if C2 shows 0.8B is weak and memory allows). Every number, unit and frequency word in the translation is checked against the original (`spike/numbers.mjs` is the starting point); on any difference, show the original and say the translation isn't safe. The translation is shown on screen; it's spoken only if Chatterbox is fast enough on the phone. Unit tests for the check.

Built (C11, 28 Oct), details in `mobile/README.md` → Tafsiri:
- **Flow:** the button translates every confident English line, one at a time, then checks it against its own original. Safe: shown under the original, labelled as a translation. Unsafe or model failure: the original only, plus the pre-made "Tafsiri hii si salama" clip. The model (672 MB, added to the models screen, total then ≈2.2 GB; ≈1.1 GB since Qwen was dropped on 29 Oct) is loaded for this step and released straight after. Leaving the screen drops the result.
- **Number check:** the C2 `spike/numbers.mjs` rewritten in TypeScript (`mobile/src/tafsiri/numberCheck.ts`), now reading Swahili number words (so "kidonge kimoja" is 1), fractions, months, and before/after/with meals. 109 tests, including all 20 real C2 translations and the cases where a number changed or went missing.
- **Speech (Wesley, 26 Oct):** no AVSpeechSynthesizer and no live Chatterbox. A line is spoken only if the original English fits a template (count + form + frequency + duration, or expiry), from pre-generated clips with numbers taken from the original. Tests cover every count 1-10, fractions, every frequency and duration, and the refusal paths.
- **Decision to check:** `kidonge` is accepted for a capsule or a tablet (it means pill); the C2 report listed "capsule became kidonge" as a meaning change the check can't catch. If Wesley wants capsules to be strict, the translator output "kidonge" would be refused.
- **Known gaps:** negation ("do not") and non-numeric words are not checked; the model can still mistranslate a word, only quantities are guaranteed. A spoken year isn't re-read by the check (the clips are built from the original, so it can't drift). The 0.8B model's memory and speed on the iPhone 12 are not measured (VPS only).

### C11a iPhone check (Wesley)
On the iPhone 12, Release, a label with a dose line and an expiry: tap Tafsiri, note the time, the peak memory in Xcode's gauge, that the dose line is spoken in Swahili from the clips, and that the original is read again afterwards. Also try a label with a dose that doesn't fit ("Take 1 tablet every 8 hours"): it must be shown, not spoken.

### C12 Android real-phone test
At the Wed 28 Oct offline check, on a borrowed Android 12+ arm64 phone: install the latest APK from the releases repo, download models on Wi-Fi, then the C4a script in airplane mode. Record the phone model, Android version, RAM and results for the README.

### C7 Pharmacist send over Pears (stretch)
Only after C4–C6 work offline. First confirm how two phones find each other with no internet; write the finding on the card before building.

Finding (29 Oct, written on the card first): Hyperswarm only finds peers through bootstrap nodes, and the default ones are on the internet. With a **private bootstrap node run by the pharmacist's phone** on its Wi-Fi/hotspot address, two Hyperswarm instances connected and exchanged a message in ~100 ms under the Bare runtime on the VPS, on loopback and on a non-loopback address, with the default bootstrap never contacted. The VPS was not cut off from the internet, so the real proof is two phones in airplane mode on one hotspot. The QVAC SDK 0.22.0 exposes no swarm API to the app, so the app starts its own Bare worklet through `react-native-bare-kit`, which it already depends on.

Built (PR for `feat/c7-pears-send`; details in `mobile/README.md` → Pharmacist send): the worklet core with a Bare self-test, the app-side protocol/link/reducers, and the pharmacist and patient screens, 51 new Jest tests. The instruction is shown and read aloud exactly as typed; it is not translated. **Not done:** the entry button on Home (waits for C6's shell), linking the native addons into the iOS/Android build, the iOS local-network permission string, and the two-phone check. Those need a new EAS build and Wesley's phones, so they are a hand-off; see the PR.

### C8 Submission pack
README sections the rules require, stating **both platforms honestly with the devices each was tested on** (iPhone 12 and iOS version from C3a/C4a; Android from C12, or "built, not tested on a physical device" if C12 fails), and where to get each build (TestFlight link, releases repo). Demo video script following scope.md section 7. Roadmap section: Kikuyu (see scope.md section 9). Wesley submits.
