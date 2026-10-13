# Whole-app diagnostic audit — 11 October 2026

## Verdict and scope

The current local app is **not cleared as bug-free**. Ordinary career progression passes a broad simulation matrix, but adverse action sequences and interrupted saves expose reproducible defects. This is a diagnostic report, not a production release approval.

The original diagnostic pass added isolated regression tests and this report only. The subsequently authorized fixes are listed below. Existing local runtime changes for off-season routing, progression and shared-screen margins were preserved. No live saves, accounts, purchases, store configuration, deployment or Git remote were changed.

Owner decision on 11 October: **keep intentionally linked VIP story conversations together**. Immediate authored follow-ups are not themselves a defect. Replaying the effects of an already answered conversation is a separate defect.

## Authorized fix follow-up — 11 October

The owner requested fixes for the three explained groups: currency, interrupted purchase delivery, and squad recovery. These correspond to **A03, A04, A06, A10, A11 and A12**. Other findings below remain separate, unresolved audit items; their original reproductions are retained.

- **Contracts (A06):** renewal requires an expired contract; a negotiated offer is bound to its career/player/club/season/contract. Duplicate or stale acceptances do not pay another bonus or consume another boost. The signing screen also rejects re-entry synchronously. Valid later renewals remain supported.
- **Gem exchange (A03):** no speculative wallet rollback. Save first, persist a separate protected exchange intent, then apply the exact exchange once using a persisted transaction marker. Failure/restart can recover without replacing newer rewards, spending, or the selected career.
- **Purchase delivery (A04):** persist the original career before checkout and retain a SecureStore checkout intent/receipt until its grant is durably saved. Recover against the original save and provider account, not whichever career happens to be open. An interrupted receipt write can reconcile a single new matching provider transaction against the pre-checkout history and provider time. Old/ambiguous receipts, mismatched accounts, replaced slots and inactive restorable entitlements are not guessed. Definite pre-checkout failures/cancellation clear the intent; uncertain billing outcomes retain it and block another checkout to avoid a second charge. Recovery runs on career load/app foreground. Purchase and exchange deliveries are serialized together to preserve both grants when their original career is inactive.
- **Squad recovery (A10–A12):** preserve condition above the standard recovery cap; do not charge tokens/gems when no uninjured player benefits. Medical Centre uses the same benefit calculations. Schema 45 migrates existing cooldowns onto a persistent completed-fixture counter; normal recovery remains three fixtures OR seven real days, and Full Fitness remains five fixtures. National duty and unrelated AI fixtures do not advance the club-recovery clock.

Focused regressions cover duplicate delivery/taps, stale offers, cancellation, account/career switches, failed career/receipt writes, cleanup failure, encrypted reload, simultaneous recovery, wallet rewards/spending, zero-benefit recovery, season rollover, cooldown boundaries and legacy migration. Relevant existing reward, VIP, provider, encrypted-save and migration tests are also rerun. See `src/state/__tests__/commerceRecovery.test.ts`, `src/game/__tests__/squadRecovery.test.ts`, `src/state/__tests__/careerStoreRewards.test.ts` and the selected original audit regressions.

Verification for this fix pass: **171 distinct focused tests passed** (163 tests across 11 standard suites, six selected resolver-audit regressions and two selected storage-commerce regressions). TypeScript checking, focused ESLint and `git diff --check` passed. The full suite, Android build/install and live billing sandbox were not run.

**Release boundary:** these are local code fixes, not a shipped update or proof that every app defect is fixed. Live Google Play/RevenueCat sandbox verification remains required: successful/cancelled/pending purchases, force-stop after payment and before save, receipt-write failure, offline restart, account switching and original-career recovery. Use test purchases, never customer charges. Do not clear app data to resolve a pending receipt. A missing/deleted original career or ambiguous provider history remains pending for support instead of silently losing or misassigning a paid grant. This device-local journal is not a cross-device backend receipt-binding authority and cannot retroactively reconstruct receipts that older app versions never recorded.

## Customer Starter Pack incident and emulator follow-up — 11 October

### Evidence and limits

- The customer reports a ₹99 Starter Pack payment followed by an in-game failure. The shared RevenueCat profile records two Starter Pack purchases at 05:06 and 08:33 UTC on 10 October, totaling USD 2.04. The later account alias was created at 11:26 UTC; that timeline does not establish an account switch during either checkout.
- The two subsequently shared event-detail screenshots are copies of the same later purchase event. It is `NON_RENEWING_PURCHASE`, `PRODUCTION`, `PLAY_STORE`, product `starter_pack`, purchased-currency amount INR 99. The original Play receipt and later event have distinct order IDs. No customer identifiers or full order IDs are retained in this report.
- Those records prove recorded purchases, not local reward delivery or current refund status. The customer's exact in-game error, career mode, installed version and original-save state are still awaited. Do not attribute their specific failure to a particular callback/save/account error without that evidence.
- `Unattached products`, no RevenueCat virtual-currency balance and no configured offerings do not themselves explain this complaint. Starter Pack is a consumable fulfilled into the game's wallet, not a permanent entitlement; products are purchased directly. No webhook integration is currently responsible for this client's ordinary Starter Pack delivery.
- Source inspection of the pre-fix checkout path confirms an independent post-payment recovery risk: failed grant/save handling could return failure without a durable recovery intent, and missing ownership could allow another Starter Pack checkout. This fits the complaint but does not prove which failure occurred on the customer's device.

### Additional local safeguards

- With no existing pending intent, Starter Pack checkout now checks fresh provider transaction history before opening another payment. Any earlier Starter Pack receipt with missing local ownership is held for support rather than charged again or blindly granted again. This follows the established one-per-account purchase rule; it does not resolve a historical customer's delivery automatically.
- Pending payment/delivery copy explicitly says not to purchase again or clear app data. Definite unavailable requests are separated from unresolved payment/delivery. The durable checkout recovery described above remains responsible for recovering a known new transaction into its original save.
- Regressions cover a provider-recorded purchase followed by an error in both modes, duplicate-charge prevention, exact-once recovery, and one/two historical Starter Pack receipts with missing local ownership. The historical cases failed before the additional guard and pass afterward.
- Latest focused rerun: **118 tests passed across five suites** (`commerceRecovery`, `careerStoreRewards`, `squadRecovery`, `guestPurchases`, `purchaseCopy`). TypeScript, focused ESLint and `git diff --check` passed. This count overlaps the earlier 171-test pass and is not additive. The full suite was not run.

### Installed Android QA

Built `:app:assembleQa` with `EXPO_PUBLIC_QA_TOOLS=true`, `NODE_ENV=production`, arm64-v8a. Build succeeded; installed with `adb install -r` on `Pixel_10_Pro_XL` / `emulator-5554`, retaining all test data. The standalone APK contains its 8,102,024-byte `assets/index.android.bundle` and is debug-signed, internal only.

- Artifact: `android/app/build/outputs/apk/qa/app-qa.apk`.
- SHA-256: `db57964a486df7c701af363aaa39424cfd4f8a43b4a611a2ce4fade5392ab238`.
- Android emulator display: 1344 × 2992, 480 dpi; target SDK 36. Only isolated imported careers were used. No real-money purchases, global whale credits, app-data clearing or uninstall were performed.

| Check | Observed result |
| --- | --- |
| Contract renewal | Repeated sign taps granted one 500-coin bonus: 1,000 → 1,500. Signed salary/contract and wallet survived a data-preserving APK update. Boosted salary 11,500 uses existing 500-coin contract rounding. |
| Gem exchange | Confirmation: 25 gems → 1,000 coins. Wallet changed 1,500/100 → 2,500/75 and remained exactly that after force-stop/relaunch. |
| Squad recovery | Preview and result affected three eligible players. Squad average 92% → 95%, below-60 count 3 → 0, tokens 2 → 1. A second use was disabled as recovery was no longer needed. Those totals survived restart. Individual healthy-player preservation and cooldown boundaries are covered by focused state/pure-module tests, not asserted from the summary UI alone. |
| Player off-season | With zero coins and gems, `Continue season` settled the remaining AI fixture and exposed `Start Season 2`; the next action produced Season 2 / 2027, age 22. No Manager transfer route or purchase was required. Natural Focus regeneration had reached 3/36 on load. The 9,072-coin rollover balance matches the generated starting contract: `(61 − 40) × 12,000 × 1.2 × 0.03`. |
| Observed layout | Menu, Settings, career hubs, contract and recovery/exchange actions had side insets and clear system navigation on this large emulator. This is not a whole-app or compact-device visual certification. |

Screenshot/XML evidence is under `test-artifacts/emulator-economy-2026-10-11/`. The scoped process logs contained no JavaScript exception/native fatal crash in these checks, but did contain RevenueCat billing-unavailable errors on the sideloaded emulator and empty-offerings diagnostics. Paid catalogue actions stayed disabled. Therefore the emulator pass does **not** verify live billing, pending Google Play transactions or production consumable delivery. The recovery tests use controlled provider responses.

### Customer remediation / release boundary

Inspect both Play orders' current statuses. The follow-up recommendation is to refund the second ₹99 charge if it has not already been refunded, since Starter is a one-per-account offer. Retain one payment only if one complete pack is actually delivered (or the customer agrees to verified fulfilment); if neither was delivered and prompt fulfilment is unavailable, refund both ₹99 payments. The exact error and career mode are still awaited for diagnosis, not a reason to keep an unjustified duplicate payment. Ask them not to buy again, uninstall or clear app data. Do not promise that Restore Purchases regrants Starter Pack coins/gems. No refund, entitlement grant, customer-save edit, backend deployment, store release or Git push was performed. The local fixes do not retroactively create a recovery journal for purchases made in an older installed version.

Provider references: [RevenueCat non-subscription purchases and consumable delivery](https://www.revenuecat.com/docs/platform-resources/non-subscriptions), [RevenueCat refunds and detection limitations](https://www.revenuecat.com/docs/subscription-guidance/refunds), [Play Console order management](https://support.google.com/googleplay/android-developer/answer/2741495?hl=en).

## Second commerce hardening pass — 11 October

The owner requested another check after supplying the transaction screenshots. These changes are local and do not establish the cause of this customer's historical failure.

- **Proven guest-link recovery gap:** an interrupted checkout was stranded after a guest logged into an account, even when RevenueCat's fresh customer information identified that same guest as the original customer and contained the exact receipt. Both receipt-recorded and callback-interrupted regressions failed before the fix. Recovery now accepts only that narrow provider-proven guest-to-signed-in link plus matching new-receipt evidence. Unrelated account changes, new anonymous identities, missing receipts and wrong receipts remain blocked. Some legitimate merges whose original identity cannot prove this link still require support; the client does not infer aliases from a login alone.
- **Original-save protection:** deletion could remove the destination of a known unfinished purchase. The two new deletion regressions failed before the fix. Saved Games now checks before remote sponsor deletion; local slot deletion checks again within the serialized operation. A pending checkout for that slot, or an unreadable recovery journal, prevents deletion. Unrelated slots and ordinary deletion after resolution still work. This is not a fix for the separate A05 active-save resurrection finding below.
- **Safe user-initiated recheck:** the Store has a separate `Check pending purchase` action. It invokes only pending-delivery reconciliation, never checkout or blanket consumable restore. Recovery returns explicit `NONE`, `PENDING` or durable `DELIVERED` results; the UI cannot infer success just from an absent record. Success identifies the original career, including when the selected career changed. Older unjournaled purchases are directed to support rather than charged again or blindly granted.
- **Catalogue-wide interruption coverage:** 16 product/mode cases cover all 14 launch SKUs with a successful simulated receipt followed by failed career saving and two encrypted reloads. Assertions cover exact-once Coins/Gems (including the existing gem-pack promotion), wallet/club-fund separation, the $1M club grant, utility tokens, matching-mode VIP, coaching, and preserved timed-ad expiry. Existing tests cover uncertain billing outcomes, cancellation, repeat taps, offline history, wrong accounts, ambiguous receipts and receipt/cleanup-write failures.

Verification: **186 tests passed across 12 focused suites**: `commerceRecovery`, `careerStoreRewards`, `modeVipFulfilment`, `guestPurchases`, `purchases`, `modeVipProducts`, `accountPurchases`, `premiumSponsorSaveDeletion`, `purchaseCopy`, `concisePurchaseCopy`, `encryptedSaves`, and `saveGames`. TypeScript, focused ESLint and diff whitespace checks passed. Counts overlap earlier runs; do not add them. The new UI action has source/copy checks and tested state outcomes, not a new emulator UI pass. No full-suite run, rebuilt APK, installation, release, backend deployment, live purchase or refund was performed in this follow-up. The earlier installed APK does not contain these follow-up changes.

**Remaining release work:** verify a Play-installed license-test build with successful, cancelled and delayed/pending payments, interruption after payment, offline restart and guest login. The current client journal and receipt flags are device/save-local, not a server-authoritative delivery ledger. They cannot guarantee recovery after uninstall, wiped storage or loss of the original career; nor can they reconstruct an older unrecorded purchase's destination. Strong cross-device recovery and refund-aware fulfilment need a verified server receipt-to-save ledger/webhook path plus account/backup recovery. RevenueCat transaction reporting alone does not confirm whether the game granted consumable rewards. Those architectural/deployment changes have not been represented as complete.

## Confirmed defects and client-side failure reproductions

### A01 — P1: Manager loan/renew/release/recall can empty the squad and block matches

- Reproduction: reach off-season normally; loan eleven players for one year; release the owned squad; use Club Office's two-year renewals on the borrowed players; roll over; release the replacement owned players; return the renewed loans through Recall. Continue now encounters an empty squad.
- Observed: zero players remain, the next match cannot prepare a valid XI, and continuation can throw while accessing an absent player's ID.
- Root cause: `src/game/manager.ts:206` permits renewal of borrowed players without reconciling loan duration; `src/game/manager.ts:723` removes recalled loans without protecting the minimum squad. Recall is exposed in Transfers, including with a closed buying window.
- Scope: this is a particular legal-action sequence, not proof that all Manager careers or ordinary loan expiry fail. Automatic expiry without the manual renewal/recall sequence passed.
- Regression: `does not permit loan returns to leave a manager with no players for the next match`.
- Fix direction: protect the legal squad on every removal path; define consistent borrowed-player renewal behaviour; provide a free recovery path for already depleted saves.

### A02 — P1: Player Career import fails into an occupied slot and leaves unsaveable state active

- Player Life explicitly says importing replaces the current slot. The import action requires an open career, so an occupied destination is the ordinary path.
- Reproduction: save career A, import valid exported career B with a different ID into that slot.
- Observed with real migrations and encrypted storage: the operation returns failure; disk retains A, but the active store becomes B. Subsequent ordinary writes of B to A's slot are rejected. Continued play in B is not durable.
- Root cause: `src/state/careerStore.ts:4519` activates B before saving and does not roll back on error. `src/storage/saveGames.ts:110` correctly rejects a different identity in an occupied slot, but the import workflow has no explicit authorized replacement transaction.
- Regressions: the two import cases in `scripts/storage-commerce-audit.test.ts`, plus the injected write-failure case in the resolver audit.
- Fix direction: an explicit, recoverable replacement transaction; activate the imported career only after success, with original active state restored on any failure. Do not remove the ordinary occupied-slot safety guard globally.

### A03 — P1: Failed gem exchange can erase newer rewards or restore the wrong active career

- Reproduction 1: start an exchange with persistence pending; earn a separate 100-coin reward; fail the exchange write.
- Observed: wallet returns to 750 rather than 850, while the independent reward's claimed flag remains consumed.
- Reproduction 2: start exchange in Player slot 1, switch to Manager slot 2, then fail the earlier write.
- Observed: old Player state is restored into `save`, while `ref` still points at Manager slot 2. Disk overwrite was **not** demonstrated; occupied-slot guards can reject later writes.
- Root cause: `src/state/careerStore.ts:3445` rolls back the entire captured wallet and unconditionally replaces active state after an asynchronous failure. Purchase-screen back navigation remains enabled during the operation.
- Fix direction: identity/version-aware transactions and rollback of only the failed operation; never replace a newly selected career from an old callback.

### A04 — P1 commerce risk: interrupted consumable fulfillment lacks demonstrated durable recovery

- Reproduction 1: provider mock returns a successful 10,000-coin receipt; storage fails; discard memory and reload the encrypted save.
- Observed: the in-memory grant was 10,750 coins, but restart returns 750; no durable grant/recovery record survived.
- Reproduction 2: start a purchase, switch careers before its successful provider callback, then reload the original career.
- Observed: fulfillment returns `active_save_changed`; the original career receives no coins.
- Root cause: `src/state/careerStore.ts:3817` discards fulfillment for a changed active ID; the receipt flag and grant are stored only within the career, followed by persistence at `:3982`. There is no demonstrated pending-consumable reconciliation on reload. `src/services/purchases.ts` restores durable entitlements, not consumed coin packs.
- Evidence level: **client-side failure reproduced with simulated receipts**, not a real charge or a confirmed live customer loss. RevenueCat/Google Play native recovery and acknowledgement behaviour require a billing-sandbox test.
- Fix direction: receipt-bound, exactly-once durable fulfillment/reconciliation for the original save, including process death and account changes. Do not “fix” this by regranting every historical consumable in Restore Purchases.

### A05 — P2: Deleting the active save can resurrect it on backgrounding

- Reproduction: persist the active career; delete it through the same storage operation used by Saved Games; confirm the disk slot is empty; invoke the app's background-save call.
- Observed with real encrypted persistence: the deleted career returns.
- Root cause: `src/screens/SavedGamesScreen.tsx:63` deletes storage without clearing the matching active save/ref. `App.tsx:135` subsequently persists that still-active save. Queue serialization protects writes already queued before deletion, not future writes.
- Fix direction: coordinate deletion with active-state invalidation and stale asynchronous callbacks. Preserve the separate exact-save sponsor server-deletion contract.

### A06 — P2: Repeated contract-sign callback pays a second signing bonus

- Reproduction: sign the same valid Player contract offer twice through `signNegotiatedContract`.
- Observed: 750 → 1,250 → 1,750 coins for one offer.
- Root cause: `src/state/careerStore.ts:4719` has no pending-offer identity or consumed-offer check. `ContractNegotiationScreen` changes its rendered stage but has no synchronous in-flight lock protecting an already queued callback.
- Scope: action replay/stale callback demonstrated; the rate at which physical taps can trigger it is not measured.
- Fix direction: consume a concrete pending offer once; guard UI re-entry as a second line of defence.

### A07 — P2: Answered Player story choices can apply twice

- Reproduction: submit `career_start/work` twice.
- Observed: discipline 50 → 53 → 56; repeated effects are not rejected.
- Root cause: `src/game/careerEvents.ts:222` finds the authored event/choice and applies effects without requiring that occurrence to remain pending. The narrative screen can retain a stale callback.
- Fix direction: validate and consume the pending occurrence before effects. Keep owner-approved linked follow-ups intact.

### A08 — P2: Answered Manager press choices can apply twice

- Reproduction: submit `m_unveiling/promise` twice.
- Observed: board confidence 50 → 58 → 66.
- Root cause: `src/game/managerEvents.ts:644` likewise applies effects before checking/consuming an actual pending occurrence.
- Fix direction: exactly-once resolution per occurrence. Do not globally reject every previously seen ID: some press events legitimately recur in later seasons.

### A09 — P2: A stale weekly-action callback can consume the next Player calendar event

- Reproduction: execute the same rendered Skill-work callback twice with consecutive non-match events pending.
- Observed: both events complete; the second callback acts on a different current event.
- Root cause: `src/state/careerStore.ts:4290` takes only a choice, without an expected event ID/cursor/save identity.
- Fix direction: bind actions to the displayed event and reject stale calls. This reproduction did not replay a match or demonstrate that every double tap skips a week.

### A10 — P2: Squad Recovery lowers healthy players' condition

- Reproduction: three players at 40 condition and remaining teammates at 100; apply one recovery token.
- Observed: healthy teammates fall from 100 to 95.
- Root cause: both `src/state/careerStore.ts:3525` and the Medical Centre preview use `min(95, current + 20)` without preserving an already higher condition.
- Fix direction: recovery must not reduce an existing higher value; keep preview and fulfillment authoritative and consistent.

### A11 — P2: Recovery token can be consumed with no eligible players

- Reproduction: all roster players injured and low-condition; apply a recovery token. The screen's “three tired players” eligibility includes injured players.
- Observed: success, token 1 → 0, but every player is skipped by fulfillment.
- Root cause: token deduction happens before checking whether any non-injured player can benefit. Medical Centre can offer Apply with zero eligible players.
- Scope: extreme but valid injury-state test; not evidence all injured squads occur frequently.
- Fix direction: validate the effective recipient set before charging; show the same eligibility in the UI.

### A12 — P2: Squad Recovery's three-fixture cooldown breaks across rollover

- Reproduction: use recovery at the end of a normally completed Manager season; start the next season; complete three fixtures before seven real days have elapsed; attempt recovery again.
- Observed: recovery is still blocked after completing the three new-season fixtures. The promised UI rule is “3 fixtures or 7 days,” not three fixtures in the same season.
- Root cause: `userFixturePlayCount` (`src/state/careerStore.ts:482`) counts only fixtures currently present, but `squad_recovery_next_fixture` survives when old fixtures are rebuilt. The old season-relative threshold outlives its counter.
- Fix direction: persistent monotonic fixture count or an explicit remaining-fixtures counter. Cover club changes as well as rollover.

### A13 — P2: National Manager press effects mutate the retained domestic club

- Reproduction: build a valid National Manager calendar, queue a post-win press event and answer its morale choice.
- Observed: retained domestic players' morale changes from 70 to 73 although the controlled national team has a different ID.
- Root cause: `applyMgrEffects` (`src/game/managerEvents.ts:517`) always uses `userTeamId`, unlike manager-controlled-team selection elsewhere. Rendering also uses the domestic club name.
- Fix direction: distinguish national-team effects from domestic club/board/budget effects; retained domestic operations must remain frozen as approved.

### A14 — P2 content correctness: press questions can invent match circumstances

- The Manager catalogue includes assertions about away wins, rotation, narrow margins and bowling changes, while eligibility is only `POST_WIN`/`POST_LOSS` plus repetition controls.
- The dedicated regression supplies a home win with no completed away fixture, then chooses the away-win event through the actual weighted queue.
- Root cause: `src/game/managerPressScenarios.ts:18` and its catalogue mapper have no factual eligibility condition; `queueManagerEvent` has no match-context validation for these assertions.
- Player press templates contain similar specific claims without complete factual filters; their full range is a follow-up content risk, not an additional independently reproduced defect in this report.
- Fix direction: use canonical result facts for eligibility, or make the question genuinely circumstance-neutral. This is not the intentionally linked VIP-conversation decision.

## Verification and coverage

### Default suite, freshly rerun

- `npx jest --runInBand --silent`: **1,542 passed, 1 failed**, 248 suites, 2 snapshots passed.
- Existing failure: `src/components/__tests__/playerAvatar.test.ts:47` expects a literal old green stroke; current runtime uses a theme-dependent colour expression. Treat as a test maintenance issue, not proof of an in-game crash.
- `npx tsc --noEmit`: passed after correcting the audit fixtures.
- `npx eslint . --quiet`: existing `legal-site/auction-xi.test.cjs:36` error, `__dirname` undefined.
- Focused lint on both audit files: passed.
- `git diff --check`: passed.
- `node --test legal-site/auction-xi.test.cjs`: all 5 website-render/link tests passed. This does not verify the deployed website.

### Adversarial audit suites

- `scripts/progression-resolver-audit.test.ts`: real game/store actions with device persistence replaced; normal navigation decisions driven by the next-step resolver; JSON save re-entry; no purchased resources or QA energy bypass.
- `scripts/storage-commerce-audit.test.ts`: real store, migrations, save queue, chunking and AES-GCM, with in-memory device storage/keychain adapters and mocked provider responses. No actual user data or purchases touched.
- These scripts intentionally assert the correct behaviour and therefore stay **red for unresolved defects**. They are outside the default Jest testMatch; a green default suite alone does not clear these findings.
- Full resolver audit: **53 passed, 13 failed**, 66 cases, 202.252 seconds.
- Durable save/commerce audit: **4 passed, 5 failed**, 9 cases, 2.506 seconds.
- Combined: **75 audit cases; 57 passed, 18 failed**. Multiple failures can exercise the same underlying defect; this is not a count of 18 independent bugs.
- Machine-readable results: `/private/tmp/cricket-resolver-audit-2026-10-11.json` and `/private/tmp/cricket-storage-commerce-audit-2026-10-11.json` (temporary local audit artifacts).

### What the broader matrix exercises

| Area | Evidence | Limits |
| --- | --- | --- |
| Player progression | All 18 countries; four roles × four difficulties for five seasons; zero-wallet/injured/low-form states; youth/senior/bench/camp/adviser/story gates; JSON re-entry | Deterministic test scenarios, not every possible seed |
| Manager progression | All countries; Club/State/Elite/National phases; ten-year no-spend path; minimum injured squad; sacking/new job; accepted job/reload; normal loan expiry | Manual destructive squad sequence still fails |
| Match authority | Engine invariants, live match/toss/results/competition/stat tests; duplicate commit checked throughout resolver runs | Real-device frame pacing, gestures and process kill during rendering not certified |
| Economy and training | Daily/ad duplicate grants; coin/gem integrity; portfolio buy/partial/full sell; capped-training no-charge; sponsors, facilities, contracts and rewards tests | New contract/recovery/rollback defects remain |
| Persistence | Migration/encryption/chunking/queue/default tests plus real-store integration; valid Player/Manager re-entry; backup recovery after primary corruption; latest queued write retained | Import, deletion and interrupted commerce findings remain |
| Ads and purchases | Existing consent, age, ad reward, guest purchase, mode VIP, restore, receipt, account and sponsor guard tests; injected interruption cases | No live AdMob impression or Google Play/RevenueCat sandbox purchase performed |
| Auth and account services | Existing sign-in/session, age eligibility, deletion, identity, cloud/VIP and backend-contract tests | No production account deletion, server mutation or live outage exercise |
| Navigation and presentation | All **48** declared stack routes have exactly one registration; existing screen/copy/shared-margin/popup/responsiveness tests run | Static/logic checks are not a visual audit of every Android screen |
| Assets | 128 distinct 300×300 portrait JPEGs validated; asset scan completed | Clothing-normalization metadata check fails; decoded PNG upper bound is not measured app RAM |

### Previous full-career engine soak retained as supplementary evidence

The engine-oriented run completed 88 combined seasons and 3,823 team-result fixtures with no reported invariant errors: Batter/Bowler/All-rounder careers each progressed 21 years to age 37; Manager progressed 25 years from age 35 to 60. It used earned resources, not IAP or ads.

This older soak bypasses some UI/resolver/story gates and **cannot override the newer failures**. Wicketkeeper and all difficulties are covered in the resolver matrix, not in that particular full-career soak.

## Tooling/presentation observations, not proven customer blockers

- `npm run validate:portraits`: passes, 128 unique portraits, 4.43 MiB.
- `npm run validate:portrait-clothing`: fails because the manifest does not record the required charcoal-clothing normalization. This does not by itself establish that an image is missing or that the game crashes. Do not rewrite artwork automatically.
- `npm run audit:assets`: 382 files, 27.54 MB on disk; 366 images, 23.88 MB compressed. The 170.52 MB decoded-PNG figure assumes every PNG is resident simultaneously; it is **not** a measured memory leak or actual runtime usage.
- Existing lint and portrait-assertion failures should be cleared independently before presenting a fully green release gate.

## Remaining verification boundary

ADB reports no connected device/emulator. This audit does not certify physical-device layout, font scaling, edge-to-edge insets, keyboard overlap, touch timing, rendering performance, lifecycle/process-death handling, installed-build equivalence, real ads/consent, native billing, or production backend availability.

After fixing the reproduced defects, run all regressions again and execute Android QA on compact/large screens, gesture/three-button navigation and enlarged fonts. Exercise fast taps, back navigation, career/account switches, app background/force-stop, offline transitions and failed persistence during rewards/purchases. Use billing sandbox and test ad units; do not charge real users to verify recovery.

Original recommended fix order: A01–A04 (progression/save integrity/commerce), A05–A09 (deletion and exactly-once actions), A10–A13 (recovery/national scope), then A14 and tooling/presentation checks. Only the findings explicitly listed in the authorized fix follow-up above have been addressed in this implementation pass.

## Reproduction commands

```sh
npx jest --runInBand --silent
npx jest --runInBand --testMatch '<rootDir>/scripts/progression-resolver-audit.test.ts' --silent
npx jest --runInBand --testMatch '<rootDir>/scripts/storage-commerce-audit.test.ts' --silent
npx tsc --noEmit
npx eslint . --quiet
npm run validate:portraits
npm run validate:portrait-clothing
npm run audit:assets
git diff --check
```

## Final pre-release verification rerun — 11 October 2026, 02:45 IST

The owner requested another payment/regression/edge-case pass before releasing
the progression hotfix. This rerun tested the current dirty worktree on top of
`caa8763`, not just the committed revision. No runtime code, production accounts,
customer purchases, emulator saves or release artifacts were changed in this
verification pass. This section supersedes earlier test counts and the earlier
statement that no emulator was connected; it does not mark unresolved findings
as fixed.

**Decision: the current combined worktree is not cleared for production.** The
payment safeguards pass their automated regressions, but separate adversarial
tests still reproduce a Manager progression blocker and save-integrity defects.
Three real transactions, including the customer's two disputed Starter Pack
purchases, do not establish reliability or identify that customer's exact
in-game failure cause.

### Fresh results

| Check | Result | Interpretation |
| --- | --- | --- |
| Focused commerce, rewards, off-season and squad recovery | 163/163 passed, six suites | Includes 56 commerce-recovery cases; these tests also belong to the default suite, so do not add their count to it. |
| Default Jest suite | 1,617 passed, four failed; 250 suites; two snapshots passed | Four stale expectations described below, not four newly established gameplay defects. |
| Separate adversarial scripts | 65 passed, ten failed; 75 cases | Storage/commerce: 6 passed, 3 failed. Progression/resolver: 59 passed, 7 failed. These scripts are outside default Jest discovery. |
| Full-career engine soak | Passed: 88 combined seasons, 3,823 team-result fixtures | Batter/Bowler/All-rounder each retired at 37 after 21 seasons; Manager retired at 60 after 25. No recorded invariant errors or warnings. Normal difficulty, earned resources, no IAP/ads. |
| TypeScript | Passed | `tsc --noEmit`. |
| ESLint | Failed: two `no-undef` errors | `__dirname` in `legal-site/auction-xi.test.cjs:36` and `scripts/emulator-economy-qa.cjs:5`. Tooling errors, not demonstrated runtime crashes. |
| Website tests | 5/5 passed | Existing Node tests, not a live deployment check. |
| Portrait asset validation | Passed | 128 unique portraits, 4.43 MiB. |
| Portrait clothing check | Failed | Manifest does not record charcoal-clothing normalization; no automatic artwork changes made. |
| Asset inventory | Completed | 382 files, 27.54 MB compressed/on disk. Decoded-image upper bounds are not measured device memory usage. |
| Local legal release gate | Could not validate release environment | The local environment lacks all four public legal URL variables. This does not establish that deployed pages are down or EAS production variables are missing. |

The full-career command deliberately skips the script's baseline five-season
and monetization-comparison tests (one active test, two skipped). It exercises
canonical instant simulation, not every UI/resolver gate. Its pass does not
override the failing adversarial cases. The separate resolver matrix covers all
18 Player countries, four roles across four difficulties, Manager career levels,
injuries, no-spend continuation, appointments, sacking and serialized re-entry.

### Failures that still need attention

- **A01 — Manager dead end:** the reproducible loan-renewal/release/return
  sequence leaves zero players and blocks continuation. `renewContract` extends
  a borrowed player's contract without resolving its loan; `recallLoan` removes
  the player without a playable-squad guard (`src/game/manager.ts:206`, `:723`).
  Automatic loan expiry is a separate case and passed.
- **A02 — Player Life import/save integrity:** the occupied-slot import fails,
  and failure leaves the imported career active instead of the original career.
  `importCareerBackup` activates the imported ID before the protected disk write
  and does not roll it back on failure (`src/state/careerStore.ts:4678`). Three
  failing assertions across the two audit scripts cover this same finding; they
  are not three independent bugs.
- **A05 — Deleted save returns:** Saved Games deletes the disk slot but leaves
  the active in-memory reference. Background persistence can recreate it
  (`src/screens/SavedGamesScreen.tsx:66`, `App.tsx:136`). The new pending-purchase
  deletion guard does not resolve this ordinary deletion path.
- **A07/A08 — Repeated story/press effects:** resolvers apply effects without
  requiring a currently pending occurrence. A stale Player callback raised
  discipline from 53 to 56 again; a Manager callback raised board confidence
  from 58 to 66 again (`src/game/careerEvents.ts:222`,
  `src/game/managerEvents.ts:644`). This is not the intentionally linked VIP
  follow-up conversation behavior the owner approved.
- **A09 — Stale weekly choice:** `resolvePlayerWeek` accepts only a choice, not
  the displayed event identity. A repeated callback consumed the next selection
  event as well (`src/state/careerStore.ts:4449`).
- **A13 — National Manager scope:** press effects use the retained domestic
  `userTeamId`; the reproduced national press answer changed domestic squad
  morale from 70 to 73 (`src/game/managerEvents.ts:522`).
- **A14 — Press factual mismatch:** a home win can select the away-win story.
  This is a content/eligibility defect, not the same severity as an unsaveable
  career or zero-player squad.

The four default-suite failures were inspected against current source:
`playerAvatar.test.ts:47` expects a literal green stroke instead of the existing
theme expression; `vip.test.ts:136` hardcodes schema 44 although current schema
is 45; `schema37.test.ts:121` omits the new migration's
`recoveryCompletedFixtures: 0`; `storeResponsiveness.test.ts:17` expects a direct
`getState().save` condition instead of the equivalent captured `purchaseSave`
guard. Update these assertions without weakening their actual invariants.

### Payment confidence and remaining device work

Passing controlled tests include interrupted receipt/save writes, process
restart, original-career delivery after switching careers, duplicate receipt
delivery, repeat Starter attempts with one or two existing provider receipts,
provider-proven guest linking, wrong-account/ambiguous/offline histories, checkout
cancellation, and pending-purchase save protection. These use mocked provider
responses and storage fault injection, not actual Google Play test payments.

`emulator-5554` is connected, with package `com.coverdrive.cricket` version
1.0.10/code 14 installed by sideload (`installerPackageName=null`). It was not
rebuilt, reinstalled or exercised as the current candidate in this pass. A
connected emulator alone does not certify a Play license-testing account.

Before payment release sign-off, use a confirmed license tester and verify:

1. Starter Pack succeeds and grants once; another attempt cannot charge again.
2. Slow approval plus app interruption/reopen grants exactly once to the original
   career, including switching between Player and Manager.
3. Slow decline/cancellation grants nothing and does not strand later legitimate
   checkout behind an unresolved recovery record.
4. Offline/reconnect and interrupted fulfilment preserve rewards and save
   identity; wrong-account recovery does not deliver someone else's purchase.

Google documents no-charge license-test instruments, including slow approval
and slow decline, in [its billing test guide](https://developer.android.com/google/play/billing/test).
An internal-test-track install alone does not make purchases free: the purchasing
account must be a license tester and the payment sheet must show a test method.
No real customer needs to purchase again for these checks. Client-side recovery
and duplicate guards remain risk reductions, not a server-enforced cross-device
one-per-account guarantee.

Raw logs and JSON for this pass are under
`/private/tmp/cricket-release-verification-BTjSfa/` (temporary local artifacts).
Runtime fixes, test maintenance, a fresh candidate build/install, Google Play
test-billing, and production submission remain separate work. Do not present
this verification as an exhaustive proof that every possible bug is absent.

## Follow-up fixes and regression gate — 11 October 2026

This section supersedes the outstanding runtime findings in the preceding
verification pass. They were reproduced but not implemented at that point;
the owner's subsequent instruction authorized these fixes and regression QA.

### Resolved findings

- **A01 — Manager squad dead end:** borrowed players cannot be contract-renewed
  or released for sale proceeds. Manual loan returns preserve a valid minimum
  XI; automatic season-end returns remain supported. Loading an already
  depleted domestic Manager save repairs the playable roster through the
  existing youth-generation rules, without changing money or gems. Recovery
  is deterministic, avoids duplicate/missing squad IDs and never overwrites an
  existing youth record. National duty does not repair/change the retained club.
- **A02 — Player Life import:** the destination is saved first, then an explicit
  serialized replacement checks its identity. The imported career becomes
  active only after durable storage succeeds. A failed write keeps the original
  career active and recoverable. Switching careers during the write does not
  steal the new selection. Pending purchases prevent replacement. The original
  rolling backup remains recoverable and saveable if the new primary corrupts.
- **A05 — Save deletion:** the active matching reference is cleared, deleted
  identities reject late autosaves, and a different/new career can still reuse
  the slot. Stale delete confirmations cannot remove a replacement identity.
  Even if disk copies become unreadable, deleting a known active identity
  revokes it. Pending purchase and permanent-sponsor deletion guards remain.
- **A07/A08/A09 — Repeated choices:** story and press resolution require the
  current pending event. UI callbacks capture the save identity and resolution
  sequence; a synchronous tap latch also rejects double presses. Weekly choices
  capture their displayed calendar-event ID, so stale callbacks cannot consume
  the next event. Legitimate recurring press events and intentionally linked
  VIP conversations are still allowed.
- **A13 — National press effects:** reputation and squad effects target the
  national team, not the retained domestic club. Domestic budget is unchanged,
  and shared player records belonging to the retained club are protected.
- **A14 — Away-win press copy:** venue-dependent scenarios now use the
  controlled team's latest played fixture in the current season; a home win
  cannot select the away-win scenario.

Focused tests cover invalid/out-of-order choices, already-damaged saves,
same-ID recurring event occurrences, different-career callbacks, repeated loan
returns, failed writes, backup fallback, pending checkout, slot reuse and stale
deletion confirmations. Existing schema migrations and reward amounts were not
replaced with new balancing rules. Test-only stale source/schema expectations
and two tooling lint declarations were corrected.

### Android recommendations

R8 optimization and resource shrinking are enabled for release and standalone
QA builds, with `proguard-android-optimize.txt`. The verified QA build ran
`minifyQaWithR8`, resource conversion and resource optimization and includes the
embedded Hermes/JavaScript bundle; it is not Metro-dependent. This follows
[Android's optimization configuration](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization)
and the exact [Expo SDK 57 build-properties reference](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/).

The app-owned Android 15+ theme no longer defines deprecated system-bar
background colours or legacy cutout modes. A `values-v35` theme uses `always`
cutout handling and light icons; pre-15 compatibility styles are retained.
Modern layout still uses insets, consistent with
[Android 15 edge-to-edge guidance](https://developer.android.com/about/versions/15/behavior-changes-15#window-insets).

**Remaining limitation:** the Play screenshot names React Native and Material
library methods. Installed React Native 0.86.2 still includes compatibility
calls in `StatusBarModule` and `WindowUtil`; updating our theme does not remove
those methods from precompiled dependencies. No unsupported vendor patch was
made and complete clearance of the Play deprecated-API warning is not claimed.
The console screenshot also refers to the already-published 1.0.10 artifact,
not a new store analysis of these changes. R8 emitted stack-map warnings from
Google Auth and the Amazon Appstore dependency, but the build completed; the
smoke test does not certify every dependency's authentication/payment path.

### Final verification results

| Check | Result |
| --- | --- |
| Default Jest suite | **1,633/1,633 passed**, 251 suites; two snapshots passed. |
| Separate progression/resolver and storage/commerce scripts | **77/77 passed**, two suites; includes 11 import/storage integration cases. |
| Full-career engine soak | **88 combined seasons passed** through retirement, zero reported invariant errors/warnings. One active test, two intentionally skipped baselines. |
| TypeScript and ESLint | Passed after final runtime/test edits. |
| Whitespace/diff check | `git diff --check` passed. |
| Optimized standalone Android QA build | `assembleQa` succeeded, arm64 APK with embedded `assets/index.android.bundle`; R8 and resource shrinking executed. |
| Pixel emulator in-place update | `adb install -r` succeeded without clearing data. Player and Manager careers, pending story/press, Saved Games and Store opened. Background encrypted autosave completed, then cold restart resumed the same Manager career/pending duty. |

The Pixel emulator reports API **37**, not API 35. The screenshots show inset
screen controls and unobscured system bars in the exercised screens; this is a
smoke check, not an exhaustive Android-version/device/layout matrix. No careers
were deleted, no story/press choices were resolved, and no purchases were made
in this device pass. Store products correctly showed unavailable/disabled when
the emulator's billing service was unavailable. The RevenueCat empty-offerings
log is distinct from direct product queries, which this app uses.

Current evidence: `/private/tmp/cricket-fix-full-complete.log`,
`/private/tmp/cricket-fix-adversarial-final.log`,
`/private/tmp/cricket-fix-careers.log`,
`/private/tmp/cricket-fix-android-complete.log`,
`/private/tmp/cricket-fix-emulator-app.log`,
`test-artifacts/full-career-audit.json`, and
`test-artifacts/emulator-economy-2026-10-11/final-r8-*.{png,xml}`.
Temporary logs are local evidence, not durable production monitoring.

The optimized APK is an **internal, debug-signed QA build**, with QA tools
enabled and the existing 1.0.10/code 14 version. It is not a Play release
candidate for upload without normal production packaging/version/signing gates.
No commit, push, store upload, backend deployment or production release was
performed. Real Google Play license-test pending/declined/interrupted payment
checks remain unverified; the successful mocked commerce suite and this
billing-unavailable emulator do not replace them.

## Real Google Play license-billing verification — 2026-10-11

After the owner completed license-test setup and signed into Play Store on the
Pixel emulator, the existing optimized standalone QA APK connected to the real
RevenueCat/Google Play provider. It did not need replacement or data deletion.
The checkout sheets explicitly displayed **"This is a test order, you will not
be charged"**. Only Google's free test instruments were used; no real UPI/card
payment, refund, console mutation or production release was performed.

This pass supersedes the preceding **unverified** status for the cases below,
not for every billing scenario or every product. QA tools remained enabled;
the bundled production JavaScript runtime used real billing, not mock grants.
Google permits licensed debug-signed sideloads for these tests:
https://developer.android.com/google/play/billing/test.

| Real-device case | Result |
| --- | --- |
| Manager Bag of Coins, slow approval with force-stop/reopen | Passed. Original Manager wallet 1,000 → 11,000; exactly the 10,000-coin grant. Recovery journal subsequently reported no pending checkout. |
| Player Bag of Coins, slow approval, immediate force-stop and repeated restart | Passed. While Google reported `PaymentPendingError`, Player remained at 2,500 coins / 75 gems. After approval it reached 12,500 / 75, with no duplicate reward after another cold restart. |
| Switch from Player to Manager before delayed approval | Passed. Manager remained at 11,000 coins / 0 gems. The original Player save received its single 10,000-coin reward, despite the other mode being selected. |
| Cancel an unconfirmed checkout sheet | Passed for state safety. No reward or new payment; another checkout could open. Minor copy issue: the alert displayed raw `cancelled`. |
| Slow decline with force-stop/reopen: no premature grant | Passed. Player remained at 12,500 coins / 75 gems while pending and after Google cancelled the order. |
| Attempt another checkout while payment is genuinely pending | Passed. No second Google checkout; app displayed the confirmation/delivery-pending warning. |
| Recover from a provider-cancelled pending payment | **FAILED — new commerce blocker A15.** Google Play Budget & history showed the latest Bag of Coins order as **Canceled**. The app's manual recovery still reported pending, new checkout remained blocked, and a cold restart did not clear the block. |

### A15 — Cancelled pending payment leaves Store locked

Reproduction: buy `coins_medium` using **Slow test card, declines after a few
minutes**, force-stop/reopen, verify unchanged wallet, wait for Google Play
history to show **Canceled**, return online to the original career and use
**Check pending purchase**. Recovery stays pending and every new checkout is
rejected. Confirmed again after cold restart more than four minutes after
submission. Career play itself was not shown to be blocked; Store checkout is
blocked and the original save's pending-purchase deletion/import guard remains.

Root cause is source-backed: `getPurchaseRecoverySnapshot()` reads successful
RevenueCat `nonSubscriptionTransactions`, with no terminal cancellation state.
`recoverPendingPurchases()` returns `PENDING` when there is no new matching
successful transaction (`careerStore.ts`, candidate-count guard). It never
resolves a cancelled pending order. The durable journal therefore remains,
and the early `readPendingCheckout()` guard rejects all subsequent purchases.
Retaining ambiguous payment evidence is correct, but cancellation needs a
separate authoritative resolution path. **Do not solve this by blindly expiring
the journal or treating missing receipt history as proof of cancellation**;
a still-pending or delayed paid order could otherwise lose its destination.

The latest request authorized testing; this new runtime issue is recorded,
**not fixed or release-certified** in this pass. The pending journal and QA
saves were preserved for reproduction. Only the local screenshot helper was
hardened against missing XML attributes and to redact email addresses in its
printed output. No game/payment logic was changed during these tests.

Evidence is in the ignored local directory
`test-artifacts/emulator-economy-2026-10-11/`:
`billing-manager-store-before`, `billing-slow-approve-pending-wallet`,
`billing-after-recovery-no-pending`, `billing-player-pending-no-early-coins`,
`billing-player-payment-manager-unchanged`,
`billing-player-after-cross-career-payment`, `billing-slow-decline-confirmation`,
`billing-decline-pending-blocks-second-checkout`, `billing-play-test-history`,
`billing-decline-still-blocked-after-cancellation`, `billing-final-player-wallet`
and `billing-decline-cold-restart-checkout-blocked`, `billing-final-manager-wallet`,
`billing-final-safe-menu` (`.png` / `.xml`). Some raw
device captures contain private account/history data; do not publish them.

Remaining real-device coverage includes Starter Pack once-per-account retry,
permanent entitlement/restore, interrupted disk-write failure, network outage,
account/device switches, and any implementation of A15. These tests do not
establish a complete server-enforced cross-device Starter Pack limit.

Final post-test Manager reload still showed 11,000 coins / 0 gems; final Player
reload showed 12,500 / 75. Screenshot-helper syntax/lint and `git diff --check`
passed. The whole Jest/engine suite was not rerun in this billing-only pass;
the preceding automated results remain the most recent full-suite evidence.

## A15 fix and follow-up verification — 2026-10-11

The owner subsequently authorized fixing A15. This follow-up supersedes the
preceding **not fixed** status and automated-test counts. The historical failed
case above is retained to distinguish the original finding from the fix.

### Safe unpaid-checkout resolution

Added a read-only native `PlayCheckoutStatusModule` inventory probe. It queries
Google Play one-time purchases without starting checkout, consuming,
acknowledging, granting or transferring any order. Any matching pending or
purchased-but-unconsumed order keeps the recovery journal intact. RevenueCat
remains the sole transaction owner.

Only when no verified result or new successful receipt exists does recovery
consider resolving an unpaid checkout. It requires two successful empty Play
inventory reads, surrounding a fresh direct HTTPS RevenueCat customer-history
read using the existing public SDK key. Every matching history receipt must
already belong to the checkout's recorded pre-purchase history. New or malformed
receipts, native/network failures, missing native support, invalid provider data
or an identity change retain the journal and keep another checkout blocked.

There is **no time-based payment expiry**, automatic retry purchase or SDK
restore/sync call. The request timeout means "unavailable", not "cancelled".
A saved verified paid result is never cleared by an empty inventory probe.
Resolving an unpaid checkout returns `NOT_PURCHASED`, grants nothing and
releases the Store/save protection lock only after durable journal cleanup.
The UI explains that nothing was granted and asks anyone seeing an actual
charge to contact support before purchasing again.

The two-provider check relies on the installed RevenueCat Android 10.22.1
receipt workflow: Google one-time consumption occurs after the backend accepts
the receipt, so paid evidence remains in Play inventory or backend history.
This is not a substitute for a complete server-enforced cross-device limit.
Source references:

- Google Play purchase/pending handling: https://developer.android.com/google/play/billing/integrate.
- RevenueCat public customer-history schema: https://www.revenuecat.com/docs/api-v1/customer-info-model.
- Installed SDK receipt/consumption ordering: https://raw.githubusercontent.com/RevenueCat/purchases-android/10.22.1/purchases/src/main/kotlin/com/revenuecat/purchases/PostReceiptHelper.kt.

### Verification on the updated build

| Check | Result |
| --- | --- |
| Default Jest suite | **1,656/1,656 passed**, 252 suites; includes 19 new provider-resolution tests and four new recovery-orchestration tests. |
| Separate progression/resolver and storage/commerce suites | **77/77 passed**, two suites. |
| TypeScript and ESLint | Passed after the final test additions. |
| Optimized standalone Android QA build | `assembleQa` passed, embedded release JS, R8/resource shrinking enabled. New inline module compiled in the Expo library against the same Billing 8.3.0 used by RevenueCat. |
| In-place Pixel update | `adb install -r` passed. Existing careers and the original failed pending journal were retained; no app data or saves were deleted. |
| Original cancelled journal | Passed. Recovery released the previously reproduced Store lock without changing Player's 12,500 coins / 75 gems. A new free Google test checkout opened. |
| Fresh slow decline with immediate force-stop/reopen | Passed. Player stayed at 12,500 / 75; a second checkout while genuinely pending was blocked. After Google's decline, manual recovery displayed **Checkout no longer pending**, granted nothing and allowed the next checkout to open. |
| Fresh slow approval with immediate force-stop/reopen | Passed. Reopened Player wallet remained 12,500 / 75 while pending. After approval, manual recovery reported delivery to the original Player career and wallet reached exactly 22,500 / 75. Another cold restart/resume preserved 22,500 / 75 without a duplicate grant. |
| Other career after Player recovery | Passed. Loaded the existing Manager save after the Player cold-start check; its Store wallet remained 11,000 coins / 0 gems. |
| Final whitespace check | `git diff --check` passed after the report update. |

All test checkout sheets explicitly said the order was a test and would not be
charged. No real payment or refund was made. Only the existing QA Player and
Manager fixtures were exercised; gameplay choices were not advanced.

Evidence: `/private/tmp/cricket-cancel-payment-full-tests.log`,
`/private/tmp/cricket-cancel-payment-adversarial.log`,
`/private/tmp/cricket-cancel-payment-typecheck.log`,
`/private/tmp/cricket-cancel-payment-lint.log`,
`/private/tmp/cricket-cancel-payment-android.log`, and ignored local
`test-artifacts/emulator-economy-2026-10-11/cancel-fix-*.{png,xml}`.
Key captures include `cancel-fix-original-wallet`, `cancel-fix-new-google-sheet`,
`cancel-fix-true-pending-block`, `cancel-fix-manual-recovery-result`,
`cancel-fix-slow-approve-confirmation`, `cancel-fix-approval-pending-wallet`,
`cancel-fix-approval-check-result`, `cancel-fix-approval-final-wallet` and
`cancel-fix-player-cold-start-wallet` and
`cancel-fix-manager-final-store-wallet`.
Raw device captures can contain private account data; do not publish them.

Remaining unverified live cases include Starter Pack's once-per-account retry,
permanent entitlement/restore, interrupted disk-write failure, network outage
and Play-account/device switches. Earlier cross-career delayed delivery passed,
but those results do not establish a server-enforced cross-device Starter Pack
limit. The updated APK remains an internal debug-signed QA build, with QA tools
enabled and 1.0.10/code 14; it is not the production release artifact. No commit,
push, store upload or production release was performed in this follow-up.

## A16 — Guest Starter Pack purchase limit fails after clean reinstall

The owner explicitly authorized uninstall/reinstall testing on the Pixel. This
was a diagnostic pass, not authorization to change guest eligibility or billing
product configuration. No runtime purchase code was changed.

### Real Google Play reproduction

Used `emulator-5554` only, the same optimized standalone QA APK for both
installs, real RevenueCat and the same Google Play license-testing account.
Every confirmed checkout explicitly said it was a test order and would not be
charged. The selected instrument was **Test card, always approves**. No real
money was spent or refunded.

Three opt-in isolated Player fixtures began with 1,000 coins / 0 gems, no
first-purchase flag and the existing post-first-match Starter offer unlocked.
This tests purchase ownership, not gameplay unlocking or the 24-hour offer gate.
The original emulator QA saves were checkpointed before destructive testing.

| Check | Result |
| --- | --- |
| First Starter Pack | Passed delivery: wallet became exactly **4,000 coins / 50 gems**, and Starter Pack disappeared. |
| Fresh career before uninstall | Passed local restriction: a different fresh eligible fixture remained at **1,000 / 0** and did not offer Starter Pack. |
| Clean uninstall/reinstall | `adb uninstall com.coverdrive.cricket` succeeded without retaining package data; the exact same APK was installed. Fresh age/onboarding and no Resume confirmed local state was cleared. |
| Same Play account | Verified by comparing the account email in both payment-method captures programmatically; both were present and equal. Email was not printed. |
| Fresh eligible career after reinstall | **Failed purchase limit:** Starter Pack reappeared and the app opened a second Google Play checkout rather than returning the historical-purchase guard. |
| Second free Starter Pack | **Failed purchase limit:** Google Play accepted the second order; the app reported **Purchase complete** and granted another **3,000 coins / 50 gems**, making the new fixture **4,000 / 50**. |
| Cold restart/resume after second grant | Delivery persisted at **4,000 / 50**, without a further duplicate grant. |

### Source-backed cause and scope

`src/services/accountPurchases.ts` stores Starter ownership in install-local
AsyncStorage plus a process flag. Those survive switching careers, but not a
clean uninstall. `src/services/purchases.ts` configures guests without a stable
App User ID; an authenticated recoverable app account is required for its
`logIn` path. RevenueCat documents that anonymous identities are cached locally
and a fresh anonymous identity is generated after deleting and reinstalling
the app:
https://www.revenuecat.com/docs/customers/identifying-customers.

The `starter_pack_history_requires_support` guard in
`src/state/careerStore.ts` checks the **current RevenueCat customer's**
transactions. It is useful when that identity retains the purchase history, but
the observed clean guest reinstall did not recover the earlier Starter purchase
under the active identity. Direct before/after RevenueCat IDs were not logged;
the identity mechanism is source/documentation-backed, not a captured ID diff.
Starter Pack is configured in the app as a consumable, so the same Google Play
account alone did not prevent this second checkout in the verified test.

This confirms a guest reinstall loophole, **not** the root cause of the paying
customer's earlier complaint: their reinstall history and exact failure message
remain unknown. It also does not certify two-device, authenticated-account,
restore, offline or interrupted-save scenarios. A durable account/store-backed
ownership design needs an explicit product decision before changing guest
eligibility. A15's verified pending/interrupted-payment fix remains unchanged.

### Evidence and local verification

Ignored private evidence lives in
`test-artifacts/emulator-economy-2026-10-11/`, particularly
`starter-reinstall-first-delivered-wallet`,
`starter-reinstall-fresh-career-no-second-offer`,
`starter-reinstall-clean-launch`, `starter-reinstall-clean-menu`,
`starter-reinstall-after-store-offer-ready`,
`starter-reinstall-second-free-confirmation`,
`starter-reinstall-second-app-delivery`,
`starter-reinstall-second-delivered-wallet` and
`starter-reinstall-second-cold-career` (`.png` / `.xml` where available).
Raw payment-method XML contains private account details; do not publish it.

Added `scripts/starter-pack-reinstall-qa.test.ts`, an opt-in fixture generator
using the existing engine helper. It passed its focused Jest test; TypeScript,
focused ESLint and screenshot-helper syntax checks passed. Hardened the local
screenshot helper to avoid reusing stale UI XML when a live countdown prevents
UIAutomator from reaching idle, and added screenshot-only capture. Full game
suites were not rerun: no runtime code changed in this diagnostic pass.

The reproduced state was retained in the local emulator snapshot
`cricket_starter_reinstall_failure_20261011`. The checkpoint
`cricket_after_first_starter_20261011` was then loaded successfully to recover
the pre-uninstall QA installation, original careers and first purchased test
fixture. Snapshot rollback does not undo the two free provider transactions.
Post-restore captures verified the original QA Economy Player, QA Off Season,
first Starter fixture and Mumbai Sharks Manager slots. The first Starter wallet
was still 4,000 / 50; the emulator was left at the main menu. Focused ESLint and
`git diff --check` passed after the diagnostic changes.
No commit, push, backend deployment, store upload or production release was
performed.

## A17 — Live Google-account career recovery verified after deployment

The owner explicitly approved deploying only
`202610110001_account_career_backups` and testing account backup → uninstall →
reinstall → recovery. The exact migration (SHA-256
`2394cdf3c2162f1e92327f4cb12634e6716b2ee159a22eecfc4bf3fc82dd122f`)
and its history entry were applied in one guarded transaction to the project
matching the app configuration. No other migration, product enablement, price,
refund or store release was changed. RLS/direct-table restrictions were checked,
and an unauthenticated call to the live list RPC returned HTTP 401 / `42501`
rather than exposing the test account's records.

### Real emulator evidence

On `emulator-5554`, using the existing real Google account and live Supabase:

- Backup was confirmed before uninstall. Nine checksum-verified careers were
  backed up: five Player and four Manager, including original `hhhh` and the
  previously purchased Google Play license-test Starter Pack career.
- Actual uninstall succeeded; package absence, first-run onboarding, no Resume
  and empty slots confirmed a clean installation. Android backup is disabled.
  Recovery did not use an emulator snapshot or an imported fixture.
- Signing into the same Google account recovered the careers. All nine complete
  cloud snapshot hashes and revisions stayed identical immediately afterward.
  Both mode lists and native career opening were checked.
- The Starter career showed **4,000 Coins / 50 Gems**, with original absolute
  ad-free expiry `1792276909770`, first-purchase state and purchase markers
  unchanged. Manager Medical Centre showed **one remaining token**. Normal
  opened-career saves advanced revisions without regranting benefits.
- Repeat recovery, force-stop, offline cold launch and an ordinary `install -r`
  of the final QA APK preserved the recovered careers. All nine IDs, modes,
  slots, Coins, Gems, inventory, entitlements and grant-marker hashes matched
  pre-uninstall evidence after these checks.
- Offline Backup now reported **Backup not confirmed**; local careers remained
  available. Restoring network settings and retrying succeeded without another
  Google sign-in. No new checkout or real-money charge was performed.

Full protective emulator snapshots were saved before uninstall. Standard
careers recovered from the live backend; reserved device-only high-slot QA
fixtures remain recoverable from the snapshot, not the account backup. The
second emulator was not cleared or updated.

### Additional save-tab race found and fixed

`SavedGamesScreen` retained the preceding mode's rows during asynchronous
decryption, and an older listing could replace a newer tab's rows. A delayed
Player listing finishing after Manager reproduced `setActive(playerSave,
'manager', 1)`. Three focused tests failed before the change. Listings are now
bound to their mode and request generation, previous-mode actions are hidden
while loading, and stale Play/Delete/New callbacks are rejected. All three
tests pass; repeated native tab switching was checked in the final APK.

### Verification and release boundary

Full regression: **1,709 tests, 257 suites, two snapshots passed**. Focused
recovery/storage/commerce checks: **139 passed**; focused screen checks:
**15 passed**; isolated PostgreSQL checks: **24 passed**. TypeScript, ESLint and
`git diff --check` passed. Final standalone internal QA APK SHA-256:
`3bac815e56f895df5a578ddfe24103d28557ad13e0ca4af782d52509aba65200`.
The clean reinstall initially used the prior QA APK; the final APK adds the
save-tab guard and was installed retaining recovered data, then checked
offline and online. Neither is a signed Play Store release.

Private evidence: `test-artifacts/account-cloud-reinstall-2026-10-11/qa-summary.json`,
`cloud-*.json`, screenshots/XML and `full-regression.json`. The read-only
`scripts/account-reinstall-evidence.cjs` collects account-scoped, sanitized
comparison evidence without exporting complete saves or credentials.

This supersedes **migration not deployed / real Google-account reinstall
recovery unverified** for this tested path. It does not certify a second
physical device, live force-stop during a partially completed download, a
server-authoritative receipt ledger or a cross-device one-purchase limit.
Those are separate from snapshot recovery. A16's historical guest limit
finding is not a reason to reintroduce the restriction the owner subsequently
approved removing.

Customers must update **without uninstalling first**, sign in and wait for
**Account backup confirmed** before uninstalling. The new app still needs a
separate production package/release; backend deployment does not update the
installed app. Already-lost, unbacked-up consumables cannot be reconstructed
from this migration. No commit, push or store publication was performed.
