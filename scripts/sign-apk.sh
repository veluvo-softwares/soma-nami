#!/usr/bin/env bash
# Re-signs an APK with the release keystore when one is configured, otherwise
# leaves Gradle's debug signature in place. Prints "release" or "debug" (the
# key the APK ends up signed with) as the last line of stdout.
#
#   scripts/sign-apk.sh <apk>
#
# Reads the keystore from the environment (Actions secrets in CI):
#   ANDROID_KEYSTORE_BASE64    the .jks / .keystore file, base64-encoded
#   ANDROID_KEYSTORE_PASSWORD  the keystore's password
#   ANDROID_KEY_ALIAS          the key's alias in the keystore
#   ANDROID_KEY_PASSWORD       the key's password (often the keystore's)
# None set: debug. All set: release. Some set: fails, since a half-configured
# key is a mistake, not a choice.
#
# Needs apksigner from the Android SDK build-tools ($ANDROID_HOME), or set
# APKSIGNER to its path.
set -euo pipefail

apk="${1:?usage: sign-apk.sh <apk>}"
[ -f "$apk" ] || { echo "sign-apk: no such file: $apk" >&2; exit 1; }

vars=(ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD)
set_vars=()
missing=()
for v in "${vars[@]}"; do
  if [ -n "${!v:-}" ]; then set_vars+=("$v"); else missing+=("$v"); fi
done

if [ "${#set_vars[@]}" -eq 0 ]; then
  echo "sign-apk: no release keystore configured, keeping the debug signature." >&2
  echo debug
  exit 0
fi
if [ "${#missing[@]}" -gt 0 ]; then
  echo "sign-apk: release keystore is half configured. Set all of ${vars[*]} or none; missing: ${missing[*]}" >&2
  exit 1
fi

if [ -z "${APKSIGNER:-}" ]; then
  bt="$(ls -d "${ANDROID_HOME:?ANDROID_HOME is not set}"/build-tools/* 2>/dev/null | sort -V | tail -n 1)"
  APKSIGNER="$bt/apksigner"
fi
[ -x "$APKSIGNER" ] || { echo "sign-apk: apksigner not found at $APKSIGNER" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
ks="$work/release.keystore"
printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$ks" ||
  { echo "sign-apk: ANDROID_KEYSTORE_BASE64 is not valid base64" >&2; exit 1; }

# apksigner drops the existing (debug) signatures and writes v1-v3 for the new
# key. Passwords are read from the environment, never the command line.
"$APKSIGNER" sign \
  --ks "$ks" \
  --ks-key-alias "$ANDROID_KEY_ALIAS" \
  --ks-pass env:ANDROID_KEYSTORE_PASSWORD \
  --key-pass env:ANDROID_KEY_PASSWORD \
  --out "$work/signed.apk" \
  "$apk" >&2
"$APKSIGNER" verify --print-certs "$work/signed.apk" | grep -E '^Signer #1 certificate (DN|SHA-256)' >&2
mv "$work/signed.apk" "$apk"
echo release
