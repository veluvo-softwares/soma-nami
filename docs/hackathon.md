# AI Yako hackathon: rules and our brief

Every worker on Soma Nami reads this file before starting a card. If anything here conflicts with a card body, this file wins; flag the conflict on the card.

Sources: the DoraHacks event page (https://dorahacks.io/hackathon/ai-yako/detail), its Tracks tab (https://dorahacks.io/hackathon/ai-yako/tracks), the Luma page (https://luma.com/tv34ngtp), and Wesley's reading of the Judging and Prizes sections on 24 Oct 2026. All times are East Africa Time (EAT, UTC+3).

## The event

- **Name:** AI Yako: Own Your AI, a QVAC hackathon hosted by Tether with Node NBO, Nairobi.
- **Dates:** kickoff Sat 24 Oct 09:00, build week 25 to 29 Oct, mid-week offline check Wed 28 Oct, **submission deadline Fri 30 Oct 17:00 EAT** (14:00 UTC), demo day Sat 31 Oct.
- **Portal:** DoraHacks is the only official submission and judging portal. A Luma RSVP does not submit a project.
- **Prizes (USDt):** Overall winner 1,500. Track prizes: Offline AI apps 700, Cloud to Pocket 900, Agentic finance with WDK 400.

## Tracks

1. **Offline AI apps.** A useful QVAC app whose core AI feature runs on-device, without cloud inference. Show a real-world need, working code, setup instructions and an internet-off demo. Translation, speech, local search and assistants are welcome. **This is our track.**
2. Cloud to Pocket. Move an existing cloud AI workload onto a device and report quality, speed, memory and privacy trade-offs.
3. Agentic finance with WDK. QVAC plus Tether's Wallet Development Kit; WDK is mandatory there.

QVAC must be used meaningfully in every entry. Pears is welcome for device-to-device features.

## How it is judged

- Real user value.
- Meaningful QVAC integration.
- Working implementation.
- Usability.
- Clarity and reproducibility of the offline demo.

Revenue and business model are not scored. Every project is judged with the internet switched off: if it needs a connection, it does not place.

## What must be submitted

One submission per team, as a DoraHacks Build with all team members added. It must include:

- A clear description of the problem, who needs the solution, and the track.
- A source repository (GitHub) with setup instructions, dependencies, and a clear note on what was built during the event. Disclose any existing code and third-party work.
- A short demo video showing the working product and its core AI feature **with the internet disconnected**.
- Repository and video links that judges can open.
- A working demo on a physical device for demo day.

Our README must also cover: QVAC package versions, the models used and how to download them, the files where QVAC is called, test device and OS, memory use, model licences, and the list of features that need a network.

## Our entry: Soma Nami

Offline reader. Point the camera at a medicine box, letter or notice; it reads the text aloud in Swahili or English. The user can then ask questions, answered only from that text.

- **Main user:** older adults with failing eyesight who take several medicines a day, and their caregivers.
- **Stretch goal:** the pharmacist sends the dosing instruction to the patient's phone over Pears.
- **Track:** Offline AI apps. **Target:** the Overall prize.

### Product rules (non-negotiable)

1. It reads exactly what is written and never interprets a dose.
2. When it is not sure, it says so and tells the user to ask the pharmacist.
3. Nothing leaves the phone. No cloud AI, no account, no analytics.
4. It works in airplane mode. Models are downloaded once, ahead of time.

## Milestones

| When | Milestone | Owner |
|---|---|---|
| Sun 25 Oct, 21:00 | Spike verdict: go/no-go on OCR, Swahili TTS, grounded Q&A, Swahili ASR, TranslatePsy | Bond |
| Tue 27 Oct | Core read-aloud working on Wesley's iPhone | Wesley (device), Bond (code) |
| Tue 27 Oct, night | Airplane-mode build ready | Bond |
| Wed 28 Oct | Offline check at Node NBO | Wesley |
| Fri 30 Oct, 12:00 | Ready to submit | Bond prepares, Wesley submits |

## Working rules

- One branch and one PR per card. PRs may be merged into `main` once CI passes.
- Conventional Commits. No `Co-Authored-By` or "Generated with" footers. Commit only with a GitHub noreply address.
- Never commit real people's data: synthetic labels and generic product packaging only, never a prescription with a name on it.
- Large model files are never committed. Document how to download them.
- When something needs a physical phone or Wesley, block the card with exact instructions (what to run, what to report back), and alert Wesley on Telegram straight away if it threatens a milestone.
- `/srv/bond-media/projects` is read-only for agents. Keep everything in this repo or in card attachments.

### Only Wesley does these

- Make the repository public.
- Submit on DoraHacks.
- Register, post or announce anything publicly.
- Spend money.

## Cards

The live card status is in [plan.md](plan.md).
