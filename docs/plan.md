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
| C4 | `t_ad242ab0` | Home, Aiming, Reading: camera → OCR → read aloud | C2, C3 | Bond | in review: code, tests and 25 Swahili clips done; needs the C4a phone test | `feat/c4-read-aloud`, #11 |
| C4a | (block on C4) | iOS hand-off: read-aloud on the iPhone, in airplane mode (Tue 27 Oct) | C4, C3a | Wesley | ready for Wesley: steps on the C4 card and in PR #11 | |
| C5 | `t_99e45430` | Ask: hold-to-talk, fixed questions, quotes the line, refuses when unsure | C4 | Bond | todo | |
| C6 | `t_cebb50ba` | Accessibility, language, Not sure, caregiver setup, theme | C4 | Bond | todo | |
| C10 | `t_c473c258` | Distribution: iOS via EAS to TestFlight, Android APK to the public releases repo | C3 | Bond, Wesley's accounts | in progress: `eas.json`, Info.plist strings, APK publish job and releases README merged (#10). 26 Oct: Expo project `@mrnyamu/soma-nami`, App Store Connect app (ascAppId 6826935644) and Expo-managed iOS credentials set up by Wesley; egress allowed; IDs committed (#13). First EAS build 0.1.0 (1) submitted to App Store Connect 26 Oct (see the build log). Left: TestFlight testers (Wesley), and the first Android release on a `v*` tag (releases repo and RELEASES_TOKEN ready 26 Oct; EAS Android profile and tag workflow in #17, verification build `adf23352`) | `feat/c10-distribution`, `chore/c10-eas-ids`, `docs/c10-first-eas-build` |
| C11 | `t_cb8e5f17` | Tafsiri: English → Swahili with the number check | C2, C4 | Bond | todo | |
| C12 | (Wesley's checklist) | Android real-phone test at the Wed 28 Oct offline check (borrowed phone) | C4, C10 | Wesley | todo | |
| C9 | `t_80394eb8` | Dawa zangu: saved medicines with caregiver-set times | C4, C6 | Bond | todo (after C5, C6, C11) | |
| C7 | `t_3605b8f3` | Stretch: pharmacist send over Pears | C4, C5, C6 working offline | Bond | todo | |
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

### C4a iOS hand-off: read-aloud on the iPhone
C4 blocks for Wesley: install the latest TestFlight build (or build locally), then a scripted test in airplane mode with the synthetic labels in `spike/fixtures` printed out. Report: works or not, time to first spoken word, crashes, RAM.

### C5 Ask
Screen 4. Hold-to-talk is the main input (decided 24 Oct). Whisper's Swahili transcript is matched with fuzzy, character-level matching against a fixed list of questions ("saa ngapi", "mara ngapi", "nimeze ngapi", "na chakula", "ni dawa gani", "soma tena"). The app repeats the matched question back from a pre-made clip ("Umeuliza: ..."), then reads the label line that answers it exactly as printed, with the quote on screen. No match: "Sijaelewa, jaribu tena". The label doesn't say: "Lebo haisemi. Muulize mfamasia." The questions are always shown as large buttons too. The model never answers a dose question; if Qwen is used at all, only to pick which label line answers a matched question. Unit tests for the matcher on misspelled transcripts, for refusal cases, and for numbers in answers matching the source exactly.

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

### C12 Android real-phone test
At the Wed 28 Oct offline check, on a borrowed Android 12+ arm64 phone: install the latest APK from the releases repo, download models on Wi-Fi, then the C4a script in airplane mode. Record the phone model, Android version, RAM and results for the README.

### C7 Pharmacist send over Pears (stretch)
Only after C4–C6 work offline. First confirm how two phones find each other with no internet; write the finding on the card before building.

### C8 Submission pack
README sections the rules require, stating **both platforms honestly with the devices each was tested on** (iPhone 12 and iOS version from C3a/C4a; Android from C12, or "built, not tested on a physical device" if C12 fails), and where to get each build (TestFlight link, releases repo). Demo video script following scope.md section 7. Roadmap section: Kikuyu (see scope.md section 9). Wesley submits.
