# QA-only elite-rating capture set

Captured on the Android emulator from the internal `qa` APK (v1.0.8, build 8), not the Play Store AAB. The APK was installed over the existing app without clearing user data. Both fixtures were imported through Settings → QA Tools → Load isolated QA capture save into new slots; previous saves were left untouched.

## Player Career

- `player/player-01-home.png` — Career home
- `player/player-02-profile.png` — Profile overview showing 99 OVR
- `player/player-03-ratings.png` — Full profile showing 99 OVR and 99 core/skill ratings
- `player/player-04-stats.png` — Career statistics with 99 OVR header

The capture player’s batting, bowling, fielding, and meta attributes were set to 99 in the QA save. The app independently recomputes and displays 99 OVR.

## Manager Career

- `manager/manager-01-tactics-xi.png` — Tactics and first four XI ratings
- `manager/manager-02-playing-xi.png` — Middle of XI with 97/98/99 ratings
- `manager/manager-03-full-xi.png` — Remainder of XI with 97/98/99 ratings

Both the Mumbai club and India national squad players in the QA fixture were assigned cyclic 99, 98, and 97 attributes/OVR. The captured Manager Career is at national-coach level, so the screenshots show India National XI.

These are deliberately rigged/staged marketing review sources, not organic player progression or a normal gameplay balance claim. Do not upload them to Google Play as evidence of naturally earned ratings, titles, or records. The source Manager fixture contains authored press clippings; no such clippings are included in this capture set.

Recreate the fixtures with `node scripts/prepare-rigged-marketing-saves.mjs`. The JSON files in this folder are QA-only and must not be bundled into a production build.
