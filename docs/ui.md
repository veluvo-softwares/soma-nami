# Soma Nami: UI

Rules: [hackathon.md](hackathon.md). Scope: [scope.md](scope.md). Written 24 Oct 2026 from Wesley's brief; updated 25 Oct (iPhone 12, hold-to-talk, photo-then-guide aiming). Cards C4, C5, C6, C9 and C11 build to this file. Mockups: Wesley's design canvas "Soma Nami UI concepts" (attached to the cards as `soma-nami-mockups.tar.gz`).

## Who we design for

An older adult with poor eyesight who reads little. Often a caregiver sets the phone up once and then hands it over. Design for someone who can't read the screen at all, then make the screen as easy to read as we can for someone who can read a little.

## Rules

1. **One job per screen.** No menus, no tabs, no hamburger.
2. **The voice speaks first; the text backs it up.** Every screen speaks a short Swahili line when it opens, and every button speaks its name when pressed. These fixed Swahili lines are pre-generated audio clips (scope.md §6), so they play instantly.
3. **Type:** Atkinson Hyperlegible (SIL Open Font License, bundled in the app, no network). Body text at least 20 px; headings 30–52 px. Respect the system text size on top of that, never below it.
4. **Colour (dark theme, default):**

   | Role | Colour | Text on it |
   |---|---|---|
   | Background | `#0E0E0E` | white `#FFFFFF` |
   | Main action | yellow `#FFD60A` | black |
   | Ask | blue `#8EC9FF` | black |
   | Not sure | orange `#FF9F43` | black |

   Colour is never the only signal: every state also has an icon and a word.
5. **Touch targets at least 88 px** (pt on iOS, dp on Android) in both directions, with at least 16 px between targets.
6. **Every button** has an icon, a Swahili word, and a small English line under it (for example **Soma tena** / *Read again*).
7. **VoiceOver and TalkBack:** every control has an accessibility label (Swahili, with the English line as the hint), a role, and a logical focus order. When a screen reader is on, the app does not talk over it: our own speech is paused while the screen reader is speaking, and screen-opening lines are sent as accessibility announcements instead of app speech. (Test on the iPhone with VoiceOver in C6.)
8. **Theme is a setup option.** Dark is the default; a light theme (near-black text on off-white, same accent colours with dark text) is offered in caregiver setup, because some low-vision users, especially with cataracts, prefer dark text on light. Which is better for our users is an open question to test with a real user.
9. **Language of the interface** is Swahili by default, English as a setup option. This only changes the app's own words. Label text is always shown and read exactly as printed (see Reading).

## Screens

### 1. Home
- Almost the whole screen is one yellow button: camera icon, **Gusa kusoma** / *Tap to read*.
- Below it: a link **Dawa zangu** / *My medicines*, and the line **Inafanya kazi bila intaneti** / *Works without internet*.
- If models are not downloaded yet, the big button is replaced by "Mipangilio haijakamilika" / *Setup not finished* and sends the user to caregiver setup.
- Voice on open: "Gusa popote kusoma." (Tap anywhere to read.)

### 2. Aiming
- Live camera with a frame drawn on it. **Tapping anywhere** on the preview takes the photo. No small shutter button.
- After each photo, the app checks where the text sits and speaks one hint: "Sogeza kushoto kidogo" (move a little left), "Sogeza mbali kidogo" (move a bit further away), "Washa taa / tafuta mwanga" (more light), or "Shikilia hapo" (hold still), then waits for the next tap.
- When the text is well framed, go straight to Reading.
- Live auto-capture (no tap) only if the text detector runs about once a second on the iPhone; see scope.md §6.

### 3. Reading
- Chip at the top: **Kiingereza · inasomwa kama ilivyoandikwa** / *English · read exactly as printed* (the chip names the label's detected language).
- The label lines in large type. The line being spoken is highlighted in yellow and kept on screen (auto-scroll).
- Lines OCR is unsure about are shown with an orange outline and read as "Mstari huu sijaweza kuusoma vizuri" (I couldn't read this line clearly). Never guessed.
- Buttons:
  - **Tafsiri kwa Kiswahili** / *Translate, numbers checked*. Opens the translation (C11). If any number, unit or frequency word in the translation differs from the original, the app shows the original line and says "Tafsiri hii si salama. Soma ya asili au muulize mfamasia." (This translation isn't safe. Use the original or ask the pharmacist.)
  - **Soma tena** / *Read again*.
  - **Polepole** / *Slower*.
  - Large blue **Uliza swali** / *Ask a question*.
- If too much of the label is unreadable, go to Not sure instead.

### 4. Ask
- A hold-to-talk mic button, about 220 px, blue: the main way to ask (decided 24 Oct).
- What's heard is matched against a fixed list of questions ("Hii ni ya saa ngapi?", "Nimeze ngapi?", "Mara ngapi kwa siku?", "Nile na chakula?", "Ni dawa gani?"). The app repeats the matched question back ("Umeuliza: ...") before answering. If nothing matches: "Sijaelewa, jaribu tena" (I didn't understand, try again).
- The same questions are always shown as large buttons below the mic, for VoiceOver users and noisy rooms.
- The question and the answer are shown in large type and the answer is spoken.
- The answer quotes the exact label line it came from, shown as a quoted block under the answer.
- When the label doesn't say, the answer is "Lebo haisemi. Muulize mfamasia." (The label doesn't say. Ask the pharmacist.)
- Button **Rudi kwa lebo** / *Back to the label*.

### 5. Not sure
- Orange icon. Heading **Sijaweza kusoma vizuri** / *I couldn't read this clearly*, with the line "Sitakisia dozi." (I won't guess a dose.)
- **Muulize mfamasia au daktari** / *Ask your pharmacist or doctor*.
- Buttons: **Jaribu tena** / *Try again* (the voice adds "with more light": "Jaribu tena mahali penye mwanga zaidi") and **Mpigie msaidizi** / *Call my helper* (dials the number from setup; hidden if none was set).

### 6. Dawa zangu (My medicines)
- Saved medicines as large photo cards (the photo the user took), each with the time of day: **asubuhi / jioni / usiku** (morning / evening / night).
- The medicine due now is outlined in yellow.
- Items sent by the pharmacist (C7) carry the badge **Kutoka kwa mfamasia** / *From the pharmacist*.
- Tapping a card opens Reading for that saved label, replayed from storage without running OCR again.
- **The time of day is set by the caregiver, not inferred from the label.** Turning "1×3" into "asubuhi, mchana, jioni" is interpreting a dose, which product rule 1 forbids. See scope.md section 6.

### 7. Caregiver setup (done once)
- Language: **Kiswahili / English**.
- Voice speed: **Polepole / Kawaida / Haraka** (slow / normal / fast).
- Theme: **Giza / Mwanga** (dark / light).
- The helper's phone number (stored only on the phone).
- Models status: each model with downloaded / not downloaded and its size, and one "Pakua" (download) button. Must be done on Wi-Fi before going offline.
- **Tayari** / *Done*.

## Open questions to test with a real user
1. Dark vs light theme.
2. Whether auto-capture guidance is understood, or a tap-anywhere capture is simpler.
3. Voice speed default.
