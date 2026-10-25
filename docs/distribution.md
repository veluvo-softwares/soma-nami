# Distribution (C10): egress hosts and Wesley's checklist

Card C10 (`t_c473c258`). How to build and release is in [mobile/README.md](../mobile/README.md); the card row and the iOS build log are in [plan.md](plan.md). This file has two things: the hosts the Bond VPS must reach to run EAS, and the steps only Wesley can do. Checked on Mon 26 Oct 2026 with eas-cli 25.3.0 on the VPS sandbox.

## 1. Egress allowlist (Bond VPS)

The sandbox sends all HTTPS through the egress proxy. "Reachable" below means a request through the proxy got an HTTP answer on 26 Oct; "blocked" means the proxy refused the connection.

### Needed

| Host | Why | How I know | Now |
|---|---|---|---|
| `registry.npmjs.org` | `npm i -g eas-cli` (or `npx eas-cli`) downloads the CLI and its dependencies. The CLI's update check (`@expo/plugin-warn-if-update-available`) also asks this registry for the latest version, at most every 12 hours. | A clean `npm i eas-cli@latest` resolved all 527 packages from this one host (`package-lock.json`). The update-check registry default is in the plugin's `check-update.js`. | reachable |
| `api.expo.dev` | Everything the CLI does with an `EXPO_TOKEN`: `eas whoami`, project lookup, build and submit creation, credentials, build status. GraphQL at `/graphql` and REST at `/v2`. | `getExpoApiBaseUrl()` in `eas-cli/build/api.js`. A debug run of `eas whoami` with a dummy token contacted only this host and got "The bearer token is invalid" back from it. | reachable |
| `storage.googleapis.com` | `eas build` packs the project and uploads the tarball to a pre-signed URL; build log files are served from signed URLs too. | The URL is handed out by `api.expo.dev` at run time (`uploads.js`, `createUploadSessionAsync`), so it isn't in the CLI source. The first build on 26 Oct (`9e90c660`) uploaded with this host allowed. Expo picks the storage host server-side, so if a future upload fails, the error names the new host. | reachable |

### Useful, not needed

| Host | Why | Now |
|---|---|---|
| `expo.dev` | Build and submission page links the CLI prints, and the browser login flow (`expoBrowserAuthFlowLauncher.js`). With `EXPO_TOKEN` the CLI makes no requests to it; keep it allowed so Bond can open the build pages. | reachable |
| `api.appstoreconnect.apple.com` | Only for the best-effort TestFlight internal-group setup at the end of `eas submit` (`submit/ios/ensureTestFlightSetup.js`, through `@expo/apple-utils`). Without it the CLI skips that step and the submit still finishes; this is what happened on 26 Oct. The upload to Apple itself runs on Expo's servers, not the VPS. Testers are added in App Store Connect instead (checklist item 5). Do not allow unless we want the CLI to manage TestFlight groups. | blocked |

### Not needed (checked)

| Host | Why not |
|---|---|
| `cdp.expo.dev` | EAS CLI analytics (RudderStack). The CLI turns analytics off by itself when `https_proxy` is set, which it is on the VPS (`AnalyticsManager.js`). `eas.json` also sets `EXPO_NO_TELEMETRY=1` for builds. |
| Sentry (`*.sentry.io`) | The CLI only enables Sentry when `EAS_CLI_SENTRY_DSN` is set (`build/sentry.js`); it isn't. |
| `u.expo.dev` | EAS Update manifests. We don't use EAS Update. |
| `idmsa.apple.com`, `appstoreconnect.apple.com`, `developer.apple.com` | Apple ID login, for interactive `eas credentials` on a Mac. Wesley does that on his Mac (item 2); the VPS never logs in to Apple. |
| `exp.host` | Old Expo API host; not referenced by the CLI's network code. |

**Allowlist request: none outstanding.** `registry.npmjs.org`, `api.expo.dev`, `expo.dev` and `storage.googleapis.com` are allowed and enough for `eas whoami`, `eas build` and `eas submit`. `api.appstoreconnect.apple.com` is optional, Wesley's call.

Not confirmed on the VPS: an authenticated `eas build` run with debug output in this session, because no `EXPO_TOKEN` is set in the sandbox's environment today (see item 3). The 26 Oct build and submit are the evidence for the build path.

## 2. Wesley's checklist

Status as of Mon 26 Oct.

1. **Bundle id, app name, App Store Connect app record created.** Done 26 Oct: app `ascAppId` 6826935644, in `eas.json` (#13).
2. **`npm i -g eas-cli`, `eas login`, `eas credentials -p ios` in the repo**, letting Expo manage credentials and adding an App Store Connect API key. Done 26 Oct: Expo project `@mrnyamu/soma-nami`, Expo-managed iOS credentials. Whether an App Store Connect API key was added isn't visible from the VPS; `eas submit` on 26 Oct finished, which needs one.
3. **`EXPO_TOKEN` from expo.dev › Access tokens put in `~/.hermes/.env` on the VPS.** Worked on 26 Oct (the first build ran). Today the token is not in this worker's environment, so check that it is still in `~/.hermes/.env` on the VPS and that worker sessions load it. Bond needs it for every later build.
4. **Create public repo `veluvo-softwares/soma-nami-releases`** and a fine-grained token (Contents read & write on that repo only) saved as Actions secret `RELEASES_TOKEN` in `soma-nami`. **Not done:** the repo doesn't exist yet. Bond's token can't read Actions secrets, so tell Bond when `RELEASES_TOKEN` is set. Then push a `v*` tag to publish the first APK. This blocks the Android APK for the Wed 28 Oct borrowed-phone test (C12).
5. **Add TestFlight testers.** Internal testers get builds immediately. External testers need Beta App Review (about 1 day), so **the first external build must be submitted by Wed 28 Oct.** Not known from the VPS (Apple's API is blocked); Wesley confirms. Build 0.1.0 (1) is already in App Store Connect, so in App Store Connect › TestFlight: add internal testers, create an external group, fill in Test Information (what to test, feedback email, contact), and submit build 1 for Beta App Review now. After the first approval, later builds of the same version usually go through review much faster.

**Deadline risk.** The 28 Oct external-tester date is at risk only if item 5 waits. Build 1 can go to Beta App Review today; review takes about a day, so submitting by Tue 27 Oct leaves room for one rejection. Waiting for the C4 read-aloud build before the first review submission would put Wed at risk.
