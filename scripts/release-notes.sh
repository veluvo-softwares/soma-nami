#!/usr/bin/env bash
# Writes the release notes for an Android tester APK to stdout, as Markdown.
#
#   scripts/release-notes.sh <tag> [commit]
#
# "What's new" is the annotated tag's message when there is one, otherwise
# the commit subjects since the previous v* tag (the last 20 if there is no
# earlier tag). Used by .github/workflows/android-release.yml when a v* tag is
# pushed; the notes are published to the public releases repo, so they must
# never contain anything but version, commit and change summaries.
set -euo pipefail

tag="${1:?usage: release-notes.sh <tag> [commit]}"
ref="${2:-$tag}"
commit="$(git rev-parse --short=7 "$ref^{commit}")"

whats_new=""
if [ "$(git cat-file -t "$tag")" = tag ]; then
  # %(contents) without a signature block, if the tag is signed.
  whats_new="$(git tag -l --format='%(contents)' "$tag" | sed '/^-----BEGIN PGP SIGNATURE-----$/,$d')"
fi
if [ -z "$whats_new" ]; then
  prev="$(git describe --tags --abbrev=0 --match 'v*' "$tag^" 2>/dev/null || true)"
  if [ -n "$prev" ]; then
    range="$prev..$tag"
  else
    range="$tag"
  fi
  whats_new="$(git log --no-merges --format='- %s' -n 20 "$range")"
  [ -n "$whats_new" ] || whats_new="- No changes since $prev."
fi

cat <<EOF
Soma Nami ${tag} for Android testers.

- **Version:** ${tag}
- **Commit:** ${commit}
- **Phone:** Android 12 or newer, 64-bit ARM (arm64-v8a) only.

## What's new

${whats_new}

## Before you start

- On first launch the app downloads its AI models **once** (more than 1 GB). Connect to Wi-Fi and keep the app open until it says *Tayari*.
- After that everything runs on the phone, with no internet, airplane mode included. Nothing you photograph or say leaves the phone.
- This is a tester build, not a Play Store app. Signed with the EAS-managed key. See the README in this repository for how to install it.
EOF
