# Soma Nami for Android (tester builds)

Soma Nami reads printed text aloud: point the phone's camera at a medicine box, a letter or a notice and it reads it to you in Swahili or English. You can then ask a question about what it read. It runs entirely on the phone.

This repository only holds the Android app files (APKs) for testers and judges. There is no source code here.

## Which phone

- Android **12 or newer**.
- A **64-bit ARM** phone (arm64-v8a). Almost every Android phone sold since 2019 is one. The app will not install on older 32-bit phones or on x86 emulators.
- About **2 GB of free storage**: the app plus its AI models.

## Install

1. On the phone, open the [latest release](../../releases/latest) and tap the file ending in `.apk` under **Assets** to download it.
2. Open the downloaded file (from the notification, or from the **Files** / **Downloads** app).
3. Android asks whether to allow installs from this source: tap **Settings**, turn on **Allow from this source** for the app you used (for example Chrome or Files), then go back.
4. Tap **Install**. If Play Protect warns that it doesn't recognise the app, tap **More details → Install anyway**. That warning appears because this is a tester build that isn't on the Play Store.
5. When you're done installing, you can turn **Allow from this source** off again.

To update, install the newer APK the same way; it replaces the old one and keeps the downloaded models.

## First launch: download the models once

The first time you open Soma Nami it downloads its AI models (more than 1 GB). **Use Wi-Fi** and keep the app open until it says **Tayari** (ready).

After that, **everything runs offline**: reading, speaking and answering questions all happen on the phone, in airplane mode too. Nothing you photograph or say is sent anywhere, and there is no account.

## About these builds

- Each release is built automatically from a version tag of the app. The release notes list the version, the commit it was built from and what changed.
- These are tester builds signed with a debug key, not Play Store releases. Install them only from this repository's Releases page.
- Soma Nami reads exactly what is printed and never interprets a dose. When it isn't sure, it says so: ask your pharmacist.
