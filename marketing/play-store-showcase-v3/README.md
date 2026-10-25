# Cricket: Player & Manager — showcase screenshots v3

This is the corrected-name export. Every screenshot footer and the contact sheet use the exact title **Cricket: Player & Manager**. Use this pack instead of v2.

This revised set follows the owner's request to showcase advanced careers rather than lead with a rookie scorecard. Upload the eight PNGs in filename order; each is 1080 × 1920, opaque RGB. The contact sheet is review material only.

1. 99 OVR Player profile, 36,640 career runs and core ratings.
2. The supplied 97–99-rated national Manager XI.
3. A real live boundary, with the ground prominent rather than the 28/1 scorecard.
4. Actual batting, bowling and field-setting controls.
5. Squad training and Player physio information.
6. Scouting, youth academy and home-ground development.
7. The advanced Player profile, Player Life and Media Scrapbook destinations.
8. Press choices and the in-app trophy cabinet.

## Source accuracy

The owner explicitly approved the supplied advanced showcase saves for this revision. The source screenshots are genuine app renders, but the elite ratings and some historical totals/trophies come from staged demonstration/QA saves. They are illustrative game-state showcases, **not proof of naturally earned achievements, typical player outcomes, starter ratings or guaranteed progression**. No score, rating, trophy, control or in-app label has been painted in or changed in this layout.

The 36,640 runs are exactly the total visible in the supplied statistics capture. Source career-total rows not relevant to the panel are cropped; no totals are recomputed. The older source file called `player-18-records-test.png` actually shows the T20I view; only its trophy-cabinet region is used, with no Test-record claim.

`project/screenshots.json` maps every source and crop. Copies of the exact inputs are included in `sources/`. The original provenance is in `marketing/rigged-qa-2026-09-29/README.md` and `marketing/capture-2026-09/README.md` in the repository. The user's latest showcase direction supersedes the previous version's decision to omit these inputs.

No old app name, test-ad banner, emulator status bar, store price, made-up rating badge or external award is included. Some systems are shown through their real navigation entry rather than fabricated feature screens. The set does not promise every user a 99-rated team or 36K-run career.

## Editable layout

On macOS with Xcode Command Line Tools, run from this pack folder:

```sh
swift -module-cache-path /private/tmp/cricket-marketing-swift-cache project/render-screenshots.swift .
node project/validate.mjs
```

The renderer composites existing pixels and captions deterministically; it does not regenerate game UI. Fonts and licences are in `project/fonts/`. Video is not included in this screenshot delivery. The previous screenshot version is retained separately.
