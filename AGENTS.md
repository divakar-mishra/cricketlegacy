# Cricket Legacy project instructions

For any product, gameplay, UI, economy, persistence, commerce, test or build work,
read and follow `.agents/skills/cricket-legacy/SKILL.md` before acting. It routes
to the current approved product rules and source-backed references.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Mandatory public-release version discipline (owner instruction, 25 October 2026)

Never reuse the previous public version for a new public update just because EAS
auto-increments versionCode. Before packaging, establish the last published
public version from owner/Console evidence, explicitly choose the next version
(normally the next patch unless the owner requests otherwise), and update
`android-release.json`, `app.json`, `android/app/build.gradle`, `package.json`
and the lockfile together. Keep the existing EAS remote build counter authority.
Run `npm run check:android-version` and its negative-control regression tests.
Production EAS pre-install and direct Gradle release builds enforce the gate.
After download, validate the ACTUAL signed AAB manifest against the release
target and minimum versionCode. File names/Play release names are not evidence.
Do not call an artifact ready or update the latest pointer until manifest,
signature and production-flag verification pass. A new public release advances
the target/previous-version record; rebuilding the same release candidate may
retain its approved public target but must use a fresh internal code. Never
rename/relabel an old AAB as a version correction. Preserve old artifacts with
clear superseded warnings. iOS public version must likewise match its approved
App Store Connect version; do not infer an iOS submission from an Android bump.

# Owner's living delivery handbook

After relevant build, release, provider configuration, website, privacy, backend
or QA work, update `docs/how-to/` and mirror its three handbook files to
`/Users/divakarmishra/Desktop/HOW TO` when filesystem permissions allow.
The owner requested this ongoing record on 21 October 2026. Preserve unrelated
files there. Record evidence and distinguish verified, owner-reported, assumed
and pending states; never include secrets or claim an unobserved deployment.
If the desktop mirror cannot be updated, retain the repository update and report
that the mirror is stale. This is task-time maintenance, not background polling.
