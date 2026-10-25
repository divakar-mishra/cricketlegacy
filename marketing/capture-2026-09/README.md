# Cricket: Player and Manager capture pack — 24 September 2026

Captured from the Android app on the isolated Pixel 8 Pro emulator. PNGs are native app screenshots at 1344 × 2992; the match recording is a 70.03-second Android screen recording at 720 × 1280.

Current store materials are in [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md), including the app name, short and full descriptions, a newly titled [feature graphic](store-assets/feature-graphic-1024x500.png), and the current [app icon](store-assets/app-icon-512.png). The screenshots below predate the rename and need visual review before public upload.

For a complete eight-screenshot concept and 45-second Play preview-video shot list, use the [marketing creative brief](MARKETING_CREATIVE_BRIEF.md).

## Deliverables

- [Player Career screenshots](player/) — 21 PNGs; all 21 have distinct SHA-256 hashes. They cover the career hub, stats, progression, profile, records, achievements, Hall of Fame and competition-specific records.
- [Manager Career screenshots](manager/) — 38 PNG files, 32 visually unique by SHA-256, so there are at least 20 distinct captures.
- [Live gameplay video](player-live-70s.mp4) — 70.03 seconds of an in-progress Player Career match. Playback was verified in Android Photos. At about 18.0 seconds the live commentary shows a six; at about 18.4 seconds it shows a four. This is app screen capture, not a rendered promo animation.
- [Live six screenshot](player-live-six.png), [chase screenshot](player-live-chase.png), and [completed-match screenshot](player-match-win.png).

## Milestone and newspaper images

- [Player 186-run newspaper](player-186-newspaper.png) — generated through the canonical match engine in a deterministic QA scenario.
- [Player 212-run double-century newspaper](player-200-newspaper.png) and [319-run triple-century newspaper](player-300-newspaper.png) — captured in-app from deterministic canonical-engine scenarios.
- [Player 8-wicket newspaper screenshot](player/player-8-wicket-newspaper.png) — genuine Player Career Media Scrapbook screen captured in the app. Its story comes from the deterministic canonical-engine QA fixture below: Aarav Sen took 8 wickets against England, and the bowling scorecard contains an individual five-wicket haul. This is a staged QA result, not an organic career result.
- [Player Career home/menu](player-career-menu.png) — mode selection/menu capture; it is not a record screen.
- [Player five-wicket QA article save](scenario-saves/player-wicket-latest-qa-only.json) — a staged UI-only article fixture. It is not a canonical simulated match or a verified player record.
- [Canonical Player bowling scenario save](scenario-saves/player-engine-wicket-spell.json) — one deterministic `runFixture` + `applyResult` Test match vs England, with Aarav Sen taking 8 wickets in total and at least 5 in an individual bowling row; the archived story is categorized `FIVE_WICKET`. This test save uses QA rating/tactic overrides and must not be described as an organic career.
- [Canonical Manager World Cup newspaper](manager/manager-canonical-world-cup-newspaper.png) — captured in-app from the deterministic canonical match/tournament save.
- [Canonical Manager WTC newspaper](manager/manager-canonical-wtc-newspaper.png) — captured in-app from the completed WTC cycle and final.
- [Canonical Manager Test win in England newspaper](manager/manager-canonical-england-test-newspaper.png) and [Australia newspaper](manager/manager-canonical-australia-test-newspaper.png) — captured in-app; the report records the actual home venues and scorecards.
- Earlier illustrative Manager clippings remain available: [World Cup](manager/manager-32-world-cup-newspaper.png), [WTC](manager/manager-34-wtc-newspaper-qa.png), [England](manager/manager-30-england-test-newspaper.png) and [Australia](manager/manager-33-australia-test-newspaper.png). These are not the canonical-result screenshots above.
- [Canonical Manager milestone QA save](scenario-saves/manager-canonical-milestones-qa-only.json) — World Cup and WTC titles plus canonical away Test wins against Australia and England.
- [Canonical Manager result report](scenario-saves/manager-canonical-milestones-report.json) — verified fixture winners, innings, trophy ledgers, test seed and explicit QA rating/appointment overrides.
- [Separate QA-only WTC visibility save](scenario-saves/manager-wtc-latest-qa-only.json) puts the existing WTC clipping in the recent-six list. It was imported using the app’s empty-slot-only QA importer; regular career saves were left untouched.
- [Player staged engine saves for 100, 200 and 300+ runs](scenario-saves/) — the files `player-engine-100.json`, `player-engine-200.json` and `player-engine-300.json` contain canonical-engine test results (186, 212 and 319 runs respectively). Their deterministic test setup uses rating overrides; describe them as staged QA engine scenarios, not organic tester careers.

## Evidence and staging limits

The legacy Manager save `manager-capture-only.json` is explicitly marked `qaCaptureOnly`; its headlines are authored rendering fixtures and are not backed by those results. The separate `manager-canonical-milestones-qa-only.json` has genuine canonical simulated competition results and WTC fixture/result ledgers, with editorial clippings composed from those recorded outcomes. Its national appointment is a QA shortcut and its India/opposition ratings are overridden to make the outcome deterministic; it is not an organic career or evidence that a normal-strength save will win. The final captures were made inside the app from a temporary in-memory preview because Android AsyncStorage returned `SQLITE_FULL`; the preview was not persisted and no normal career slot was overwritten. Do not present QA save results as organic tester gameplay.

The `manager-31-vip-screen.png` file is a non-editorial Manager screen and should not be counted as an achievement/news capture. The `session-capture/` directory contains emulator diagnostics and intermediate flow shots, not store-ready creative. PNGs retain Android status/navigation bars and should be framed for Play Store or YouTube use.

## Reproduction

- [Canonical Player engine scenario test](../../scripts/marketing-engine-sim.test.ts).
- [Capture-save preparation script](../../scripts/prepare-marketing-capture-saves.mjs).
- [WTC visibility-copy script](../../scripts/prepare-manager-wtc-capture.mjs).
- Canonical match-driven Manager scenarios: [test/reproducer](../../src/game/__tests__/managerMarketingCapture.test.ts).
- [Player fixture saves](scenario-saves/) and [Manager capture fixture](scenario-saves/manager-capture-only.json).

## Scope note

The live gameplay video and Player 186/212/319/8-wicket articles are captured in the app; the scoreline scenarios are deterministic QA runs through the canonical match engine, not a naturally played career. The bowling screenshot shows the in-app scrapbook article derived from the canonical simulated scorecard. Original `manager-30` through `manager-34` clippings are authored rendering fixtures; the `manager-canonical-*` images are the separate canonical-result captures.

These are internal QA/marketing capture materials. Use the clip and distinct app screenshots as visual assets, but do not make factual claims about staged Manager outcomes unless they are replayed and verified in a normal canonical Manager career.
