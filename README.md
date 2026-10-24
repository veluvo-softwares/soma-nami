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

## What it does

1. **Read aloud.** Camera → text recognition → speech, in Swahili or English.
2. **Ask about it.** "Hii ni ya saa ngapi?" ("What time is this one for?"), answered from the text on the label and nowhere else.
3. **From the pharmacist (stretch goal).** The chemist types the instruction once and it goes to the patient's phone, device to device with Pears, with no internet and no handwriting to misread.

## Rules the product follows

- **It reads exactly what's written and never interprets a dose.** When it isn't sure it read something correctly, it says so and tells you to ask the pharmacist. It doesn't guess.
- **Nothing leaves the phone.** No cloud AI, no account, no analytics.
- **It works in airplane mode.** Models are downloaded once, ahead of time.

## Hackathon entry

- **Track:** Offline AI apps (the overall prize is the main target).
- **Judged on:** real user value, meaningful QVAC integration, working implementation, usability, and a clear, reproducible offline demo.
- **Status:** technical scope in progress. Setup instructions, the QVAC integration details, device and memory requirements, and the list of features that need a network will be added here as they're built.

## Built during the event

Everything in this repository was written from 24 October 2026 onward. Existing code and third-party work we use will be listed here.

## License

Apache-2.0. See [LICENSE](LICENSE).
