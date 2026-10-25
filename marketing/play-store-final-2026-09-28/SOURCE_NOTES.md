# Marketing source and accuracy notes

Reviewed again on **29 September 2026**. The output folder retains its original 28 September project date.

## Brand and scope

- Exact public title: **Cricket: Player and Manager**.
- Phone launcher label: **Cricket**.
- The supplied golden-batter icon is the existing app identity, not a new logo.
- The feature graphic is promotional illustration, not gameplay. Gameplay panels must use genuine app captures, with any decoration outside the actual interface.
- This export is marketing work only. It does not certify production billing, live ad delivery, store approval or a particular build's regression status.

## Source folders

| Source | What it provides | Handling |
| --- | --- | --- |
| `marketing/capture-2026-09/store-assets/` | Current icon and newly titled feature graphic | Preserve icon; use current-name feature graphic only. |
| `marketing/capture-2026-09/player-live-70s.mp4` | Genuine in-app Player Career match recording, approximately 70 seconds at 720 × 1280 | Suitable source footage after checking the selected intervals for notices and old branding. A 1080 × 1920 export is an upscale, not a new native-1080 capture. |
| `marketing/capture-2026-09/player/`, `manager/` and root PNGs | Native 1344 × 2992 app captures from 24 September | These predate the rename. Inspect each chosen crop; exclude old title, diagnostic UI, synthetic milestones and placeholder purchase screens. |
| `output/play-store/captures-20260912/` | Earlier Manager squad, tactics, scouting, facilities and match footage; Player profile/records | Supplementary genuine captures, not fresh-current-build certification. Compare visible UI with the current app before use. |
| Fresh capture folder, if included in this delivery | New device/emulator screenshots and screen recordings | Treat only actual device captures as gameplay. Keep a per-scene source map with the editable project. |

Source paths above are repository-relative. The capture archive's `README.md` is the provenance authority for its staged saves and newspapers.

## Material excluded from ordinary-career marketing

- `player-186-newspaper.png`, `player-200-newspaper.png`, `player-300-newspaper.png`, `player-engine-100-home.png` and `player/player-8-wicket-newspaper.png`: deterministic QA scenarios with rating or other test overrides. In-app rendering does not make these organic player achievements.
- `manager/manager-30-england-test-newspaper.png`, `manager-32-world-cup-newspaper.png`, `manager-33-australia-test-newspaper.png` and `manager-34-wtc-newspaper-qa.png`: authored or QA-only milestone material.
- `manager/manager-canonical-*.png`: canonical simulated outcomes, but with QA appointment/rating overrides. Do not present them as ordinary-career trophy or victory evidence.
- `scenario-saves/manager-capture-only.json` and `player-wicket-latest-qa-only.json`: rendering fixtures, not independently earned results.
- `session-capture/`: diagnostic and intermediate capture material, not a store asset collection.
- Old-name main-menu/splash screens, QA tools, emulator notices, staged Store balances and placeholder purchases.
- The entire `marketing/rigged-qa-2026-09-29/` image set: its README identifies Player attributes/OVR manually set to 99, and Mumbai/India Manager players assigned cyclic 97/98/99 attributes. Both accompanying JSON saves contain `qaCaptureOnly: true`. They were captured in the internal QA APK v1.0.8/build 8 and are not evidence of naturally earned progression or normal squad strength. No image from that set belongs in these public-facing exports.

Do not paint over a score, create a different winning result, rewrite in-app text or generate replacement controls to make a source usable. Crop unrelated system bars only where the remaining interface still accurately represents the screen; otherwise recapture it.

## Input archive's recording gaps

The September archive provides match footage, but not a complete moving-image tour of every requested system. Genuine still screenshots can be held or gently reframed in a trailer without pretending that a control was used. Such sections should be recorded as **still-image scenes** in the project's shot list.

For moving footage to replace any remaining still-image scenes, capture the following in the current renamed build. These are specific recording instructions, not fabricated substitute gameplay:

| Scene | What to record | Useful uninterrupted duration |
| --- | --- | --- |
| Player progression | Player Career home, then the Progression view; pause on the next genuine selection/progression step | 6–8 seconds |
| Training and support | Training → Development Centre; show a role-appropriate coach, analyst or physio and open its information control | 8–10 seconds |
| Player Life | Profile → Player Life; show Career Contracts, then Finances or the unlocked Portfolio on a real eligible senior save | 8–10 seconds |
| Adviser | A naturally triggered **Your Story** adviser note with its relevant-screen and **Carry on for now** choices; accepting may open the destination but must not imply an automatic purchase | 6–8 seconds |
| Squad and field | Manager squad/playing XI, then live Tactics → Field; select and legally reposition one fielder, then apply | 8–10 seconds |
| Club development | Transfer market/scout report, then Youth Academy or Club Office → Home Ground; show normal current balances and facilities | 10–12 seconds |
| Career history | A real career's Records, followed by an organically triggered press scene or earned trophy if available | 6–8 seconds |

Use a normal save without edited ratings, fabricated articles or forced trophy results. Do not spend money or buy an IAP for the recording. A locked system may be shown truthfully as locked, but it must not be edited to look available.

Record portrait at 1080 × 1920 or higher where the device supports it, with consistent theme and no touch indicators, emulator overlays, notifications or QA tools. Leave roughly two seconds before and after each intended action for editing. If a genuine trophy or adviser event is not available, use the corresponding real record/navigation screen and keep the specific event off-screen.

## Copy verification

## Final screenshot source map

The definitive crop rectangles are in `project/screenshots.json`. Public panels use these sources:

| Panel | Actual source |
| --- | --- |
| 01 Live match | Fresh normal Player `player-live-field.png`, actual boundary and 28/1 score |
| 02 Player Career | Fresh normal Player `player-home.png` |
| 03 Manager Career | September 12 `03-manager-playing-xi.png` |
| 04 Tactics and field | September 12 `02-manager-tactics.png`; actual field presets, not an invented position editor |
| 05 Training and recovery | September 12 `04-manager-training.png` plus fresh `player-physio-info.png` dialog crop, excluding price rows |
| 06 Club development | September 12 scout report, youth academy and home-ground captures, excluding upgrade prices |
| 07 Player Life | Fresh `player-life-overview.png`; three intact cropped sections, including the honest portfolio lock |
| 08 Records and story | Archive `manager-first-press-conference.png` plus fresh normal `player-records.png`; one appearance and 30 earned runs, test ad excluded |

No September 29 rigged QA screenshot is used. The fresh capture workflow advanced the normal Player career through its first match; Manager press and match preparation were also navigated normally. No purchases, rating edits, save deletion or forced trophy outcomes were used.

## Copy verification details

The listing is grounded in current screen and gameplay modules. It describes role-aware Player training, equipment, personal support, the contextual adviser, Player Life, Manager squad/tactics/scouting/staff/facilities/academy, simulated match presentation, records and story choices. It makes no promise of automatic selection, victory, real-money returns, multiplayer or licensed clubs.

- Title: **27 characters**.
- Short description: **80 characters**.
- Full description: **2,214 characters**, including spaces and line breaks inside the text block.

## Final export checklist

- Eight separate 1080 × 1920 PNGs, numbered in the requested story order.
- Real app content remains readable and occupies most of each gameplay panel.
- Exact new title on any promotional text; no old title visible in exported gameplay.
- Feature graphic: 1024 × 500; icon unchanged.
- Trailer: 45 seconds, 1080 × 1920, genuine live footage in its opening three seconds, accurate captions, licensed/app-owned audio only.
- The editable project's shot list distinguishes screen recording, still capture and promotional end card. No source footage is claimed to exist when it does not.
- Check final screenshots/contact sheet and video frames visually; file dimensions alone do not establish visual accuracy.

## Google Play upload requirements checked on 29 September 2026

For phone screenshots, 1080 × 1920 is a valid 9:16 size and meets the recommended game-promotion minimum; provide at least three such gameplay screenshots. Eight phone screenshots are permitted. Screenshots and the 1024 × 500 feature graphic should be JPEG or 24-bit PNG without alpha. Keep promotional captions small relative to the UI and avoid distorted captures.

Upload the MP4 to YouTube, then use its individual video URL in Play Console. Public or unlisted is acceptable for the standard listing preview; it must allow embedding, have no age restriction and show no ads. Disable monetization and avoid music or other material that attracts third-party monetization claims. Portrait video is supported. These requirements are from [Google's preview-asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB).

Play Console also has an asset-specific AI-content declaration. The supplied feature graphic was AI-generated/edited promotional artwork. The gameplay images are genuine captures, with deterministic framing/caption layout, not AI-generated interface or match events. Review each finished asset and its production history when completing the declaration; do not assume one answer applies to everything. See [Google's AI-generated-content declaration guidance](https://support.google.com/googleplay/android-developer/answer/17262077?hl=en).
