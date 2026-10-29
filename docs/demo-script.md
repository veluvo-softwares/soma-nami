# Soma Nami: demo video script

Follows [scope.md](scope.md) section 7. Device: Wesley's iPhone 12, Release build from TestFlight or Xcode, models already downloaded, **airplane mode on for the whole recording**. Target length: 2 to 3 minutes. Screen-record the phone and keep the status bar visible so the airplane icon shows.

Each step says whether it has been **tested on the phone** or **not yet**. Record only what works when you try it; if a step fails on the day, cut it. Don't narrate anything the app didn't do.

## Props

- A printed generic paracetamol label (`spike/data/print` has the synthetic ones; print one flat on plain paper, no names).
- A label with no food instruction, for the refusal step.
- A scrap with a handwritten "2 bd" on an envelope (invented, no real person's data).
- Good light, a table, the phone in your hand.

## Script

| # | On screen | Say | Tested |
|---|---|---|---|
| 0 | Title card: Soma Nami, "Read with me", AI Yako, Offline AI apps | "Millions of older people can't read the label on their own medicine. Soma Nami reads it to them, with no internet." | n/a |
| 1 | Control Centre: airplane mode on, Wi-Fi off. Open the app. | "Airplane mode is on. Everything you'll see runs on this phone, with QVAC." The app speaks its Swahili opening line from a pre-made clip. | Read path tested in airplane mode on the iPhone 12 (26 Oct). Home screen line: tested. |
| 2 | Home, then Aiming: point at the paracetamol label and tap anywhere. Wait about 20 seconds on the processing screen. | "Tap anywhere to take the photo. QVAC's OCR reads it on the phone. It takes about twenty seconds." | Tested: OCR about 22 s on the phone. |
| 3 | Reading screen: the label text fills the screen, the spoken line highlighted. It reads the name, the dose, the expiry and the warnings; pack size and storage sit under More details. | "It reads only what matters, exactly as printed, nothing added: the medicine, how to take it, the expiry and the warnings. The expiry is said with the month name." | Reading and highlight: tested. Spoken month names: **not yet run on a phone**; check it before recording and drop this sentence if the voice says "8 slash 2028". |
| 4 | Tap **Uliza swali** ("Ask a question", always at the bottom of the Reading screen), then tap the question about how many to take. | "I ask about this label. The app repeats my question, then reads the exact line from the label and shows the quote. No AI makes up an answer: it is the label's own words." | Ask buttons: run on the phone 29 Oct (build 3): the expiry question worked, but the dose question on the paracetamol label was refused; card D fixes this, so re-check on the newest build before recording. Use the buttons, or optionally hold the microphone and say "Nimeze ngapi?" (hold-to-talk with Whisper on the phone, #26). Use the voice version only if it works in your off-camera run and answers in under about 30 s; otherwise keep to the buttons. |
| 5 | Ask something the label doesn't say (the food question on the label without a food line). | "If the label doesn't say, the app says so and sends me to the pharmacist. It never guesses a dose." The voice says "Lebo haisemi. Muulize mfamasia." | **Not yet run on a phone.** |
| 5b | Optional: on a label with a dose line ("Take 2 tablets 3 times a day for 5 days"), open **Zaidi** and tap **Tafsiri kwa Kiswahili**. | "It can translate to Swahili on the phone. Before showing it, the app checks every number against the label, and if one differs it refuses." Show the translation labelled as a translation, and the spoken Swahili if the line fits the template. | Tafsiri: run on the phone 29 Oct (build 3): about 90 s for a nine-line label, so cut the wait in the edit. The dose line translated correctly. Don't claim it translates anything accurately: only quantities are checked. |
| 5c | Optional: open **Zaidi**, tap **Hifadhi kwenye Dawa zangu**, go Home, open **Dawa zangu**, tap the card. | "A caregiver can save a medicine. Tap it later and it reads again with no photo and no wait." | Saving and the Dawa zangu list: run on the phone 29 Oct (build 3); tapping the card to replay not yet. Don't mention backup unless you've confirmed it on a new build. |
| 6 | Photograph the handwritten "2 bd" envelope. | "Handwriting is where mistakes hurt most. When it isn't sure, it stops." The Not sure screen appears: "Sitakisia dozi. Muulize mfamasia au daktari." | Handwritten dose to Not sure: tested on the phone 25 Oct (before the C6 screen redesign, so re-check the screen). |
| 7 | Optional: Mipangilio, switch to English, then back. | "A caregiver can set it up once: language, voice speed, a helper's number." | Setup screen: seen on the phone 29 Oct (build 3); the language buttons split words there, fixed in #31, so re-check. |
| 8 | Close: the airplane icon again, then the repo URL. | "Reads exactly what's written, says when it isn't sure, nothing leaves the phone. Built this week on QVAC." | n/a |

## Left out on purpose

The app does **not** do these yet, so the video must not show or claim them: the pharmacist hand-off over Pears (built and self-tested on a server only; not reachable from Home, not tried on two phones, peer identity not pinned), and anything on Android (not tested). Mention them only as "next" in the closing line.

## Claims that must stay true

- "Nothing leaves the phone" and "no internet": true for read, Ask and Not sure by design; recorded in airplane mode.
- "QVAC": OCR, the English voice, the Tafsiri translation and (if shown) the hold-to-talk transcription with Whisper run through QVAC on the phone. The Swahili phrases are QVAC-made (Chatterbox) but were rendered on a server ahead of time, so don't say Swahili is generated live on the phone.
- Don't say the app "understands Swahili speech". With hold-to-talk it matches what you say to a fixed list of questions; anything else gets "Sijaelewa".
- Tafsiri: say the app checks numbers, not that the translation is correct.
- Say "about twenty seconds" for OCR, not "instant".

## Before you record

1. Install the newest build from main (through #29; check which PRs are in it) and let the app finish the model download on Wi-Fi (about 1.1 GB, until Tayari).
2. Run steps 2 to 7, plus 5b and 5c if you will use them, once off camera, in airplane mode.
3. Cut or reword any step that doesn't behave as described above.
