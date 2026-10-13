# Cricket Player and Manager 1.0.11 fixes and verification

Updated 11 October 2026. This is the handoff for Android version **1.0.11,
version code 16**, including the progression fixes, account backup, save
deletion and purchase recovery. The final automated gate passed, the signed
AAB was checked, and the derived Android emulator build preserved existing
careers. These results cover the scenarios below, not a guarantee that every
possible device or customer state is bug-free.

The owner subsequently submitted the release in Google Play Console:
**Submission 10, Production, full rollout, In review**, at 2:52 PM on
11 October 2026, according to the shared Console screenshot. Managed publishing
is off. This is submission evidence, not confirmation that the update is live.
No iOS build or Apple billing certification is included in these Android results.

## Release artifact and latest regression results

- Upload file: [cricket-player-manager-1.0.11-vc16.aab](../output/production-1.0.11/cricket-player-manager-1.0.11-vc16.aab).
- Package: `com.coverdrive.cricket`; production store build, not a QA APK.
- AAB SHA-256: `301522f9e0c1ae9555c3f0c9689286666c1095498d3962534fe6e4d816c2db4d`.
- Final source gate: **1,709 tests in 257 suites and two snapshots passed**;
  zero failures or skipped tests. TypeScript and ESLint passed.
- Separate adversarial progression/storage/commerce gate: **78 tests in three
  suites passed**. This preceded the final metadata-only version correction;
  the gameplay and payment code did not change afterward.
- Final five-season audit: the canonical Player and Manager five-season case
  passed. **Two optional expanded/monetization variants were skipped**, not tested.
- Fresh progression recheck on the unchanged build 16 source: all four Player
  roles and one Manager reached retirement across **109 combined seasons**;
  **66 resolver audit cases and 96 focused tests passed**. Details follow below.
- Account backup SQL: **24 isolated PostgreSQL access, revision, backup and
  deletion checks passed**. This run did not mutate the live backend.
- `git diff --check` passed. Earlier focused counts overlap the final suite;
  they must not be added together as unique tests.

Machine-readable results:
[full regression](../output/production-1.0.11/evidence-vc16/full-regression.json),
[quality summary](../output/production-1.0.11/evidence-vc16/quality-summary.json),
[adversarial regression](../output/production-1.0.11/evidence/adversarial-regression.json),
[five-season regression](../output/production-1.0.11/evidence-vc16/five-season-regression.json).
The [production packaging report](../output/production-1.0.11/RELEASE_VERIFICATION.md)
contains signing, native-library, configuration and emulator equivalence checks.
Its statement that no submission occurred describes that packaging pass; the
owner's later Console submission is recorded above.

## Fresh Android progression recheck

Completed on 11 October 2026 at 3:50 PM IST. All **1,073 recorded build inputs**
matched the final build 16 manifest before and after testing; the production
AAB checksum also remained unchanged. These are fresh tests of the source
packed into the submitted release, not results from an older gameplay version.

| Career | Seasons completed | Age at start and retirement | Result |
| --- | --- | --- | --- |
| Player Batter | 21 | 16 to 37 | Retired; no reported errors or warnings |
| Player Bowler | 21 | 16 to 37 | Retired; no reported errors or warnings |
| Player All-rounder | 21 | 16 to 37 | Retired; no reported errors or warnings |
| Player Wicketkeeper | 21 | 16 to 37 | Retired; no reported errors or warnings |
| Manager | 25 | 35 to 60 | Retired; no reported errors or warnings |

The retirement run covered **109 combined seasons and 4,896 recorded team
results** on Normal difficulty through canonical Instant Sim settlement,
using earned resources without IAP or ads. Its one expanded retirement test
passed; the separate five-season and monetization variants were intentionally
skipped in this invocation, not additional passing cases.

The separate **66-case resolver audit** also passed without failures or skips.
It follows required story, adviser, energy, press and job gates that the
engine-oriented retirement soak does not fully exercise. Coverage includes
both modes in all 18 countries; all four Player roles on all four difficulties
for five years; zero-wallet, injured and low-form Player paths; Club, State,
Elite and National Manager phases; ten Manager years without transfers,
renewals, purchases or ads; serialized save re-entry; sacking and appointments;
minimum injured squads; and automatic or manual loan-return edge cases.

All **96 focused tests in eight suites** passed without skips. These include
existing stuck Player saves, retained Manager metadata in Player saves,
unfinished AI fixtures and playoffs, missing legacy off-season preparation,
free rollover in every Manager level, depleted-squad repair, and stale
story/press/weekly callbacks. No progression blocker reproduced in these runs.

These checks do not certify every customer save or a manual Android
playthrough of every UI decision through retirement. Gameplay code, the
submitted AAB and live/customer saves were not changed by this recheck.

Evidence: [source equivalence](../output/production-1.0.11/evidence-vc16/progression-recheck-source-comparison-2026-10-11.json),
[full retirement report](../output/production-1.0.11/evidence-vc16/full-retirement-progression-recheck-2026-10-11.json),
[retirement test result](../output/production-1.0.11/evidence-vc16/full-retirement-jest-recheck-2026-10-11.json),
[resolver audit](../output/production-1.0.11/evidence-vc16/progression-resolver-recheck-2026-10-11.json),
and [focused tests](../output/production-1.0.11/evidence-vc16/progression-focused-recheck-2026-10-11.json).

## Completed fixes

| Area | Failure corrected | Current behavior and regression coverage |
| --- | --- | --- |
| Player off-season | A Player career could enter Manager Transfers, where every signing was closed and the career had no valid next step. | Player continuation uses the Player resolver, settles remaining fixtures and reaches a real season transition without buying anything. Old Manager calendar metadata cannot route a Player into club management. Zero-wallet, bench, injury, unresolved-week and semifinal cases are covered. |
| Manager progression | Loan renewal, release and return sequences could leave an empty squad and block play. | Borrowed players cannot be renewed or sold as owned players. Manual returns protect a playable minimum XI. Existing depleted domestic saves recover through deterministic youth generation without changing currency or duplicating records. National duty does not alter the retained club. |
| Story and press answers | Stale or repeated callbacks could apply the same effects twice. | Resolution checks the pending occurrence, save identity and resolution sequence, with a synchronous UI tap latch. New recurring occurrences still work. Intentionally linked VIP story conversations remain together, as approved. |
| Weekly choices | Repeating an old weekly button could consume the next calendar event. | The action must match the displayed event and career. Stale callbacks cannot skip the following event or unresolved match. |
| National Manager press | National press answers could modify the retained domestic club. | National reputation/squad effects target the controlled national team; retained domestic budget and shared club-player records are protected. |
| Press accuracy | A home win could receive an away-win question. | Venue-dependent scenarios check the controlled team's latest played fixture in the current season. This is the corrected venue case, not certification of every possible prose assertion. |
| Contract bonuses | Accepting the same negotiated contract twice could pay two signing bonuses or consume another boost. | Offers are bound to the original career/player/club/season/contract and accepted once. Invalid, stale, foreign-career and duplicate terms are rejected; legitimate later renewals remain possible. |
| Gem exchanges | Failed saving could roll back over newer rewards/spending or replace the selected career. | Durable exchange intent and transaction markers replace speculative rollback. Recovery applies the exchange once to its original save and preserves intervening rewards, spending and the active selection. |
| Paid grants | A payment followed by a save/receipt failure or career switch could lose delivery. | Checkout saves the original career first, records a protected intent/receipt, and retains it until fulfillment is durable. Recovery targets that career, not the currently selected one. Duplicate receipt delivery cannot pay twice. |
| Cancelled pending payments | A declined slow payment could keep every later checkout locked. | Read-only Play inventory checks plus fresh RevenueCat history resolve positively checked unpaid outcomes. Paid, pending, malformed, offline or identity-mismatched evidence remains protected. No blind timeout, automatic repurchase or guessed reward. |
| Starter duplicate-charge protection | A historical provider receipt without local ownership could allow another checkout after a delivery failure. | Fresh history for the current RevenueCat customer blocks another Starter payment and directs unresolved historical delivery to support. This is not a server-enforced Google-account or cross-device limit. |
| Squad recovery | Recovery could lower healthy condition, charge with no eligible recipients, or keep the wrong season-relative cooldown. | Existing higher condition is preserved; injured/no-benefit players do not cause a charge. Preview and fulfillment share eligibility. Schema 45 uses a persistent completed-fixture counter; standard recovery is three fixtures OR seven real days, Full Fitness five fixtures. National/unrelated AI fixtures do not advance that club clock. |
| Save importing | A failed import could leave an unsaveable imported career active. | Destination replacement is serialized and identity-checked; activation follows durable saving. Failure retains the original career. A simultaneous career switch keeps the user's new selection. Pending purchases prevent replacement. |
| Save deletion | An active deleted career could return when background autosave ran. | Matching active references are cleared and deleted identities reject late writes. Stale confirmations cannot delete replacement careers. A different career can reuse the slot. Pending purchase and exact-save sponsor guards remain. |
| Saved Games tabs | Slow Player/Manager decrypt/list responses could expose the wrong mode's rows and actions. | Listings are bound to mode and request generation. Previous-mode rows are hidden during loading and stale Play/Delete/New actions are rejected. Three regression cases reproduced the old failure and pass with the fix. |
| Account recovery | Clean reinstall removed locally stored balances, inventory and paid markers. | Confirmed account backups restore complete remaining career state after signing into the same app account. Recovery uses fresh device encryption keys and preserves transaction markers and absolute ad-free expiry, rather than regranting packs. |
| Screen spacing | Shared controls could sit against screen/system edges. | Shared screen/footer insets and side padding were corrected and regression-tested. Large Pixel and compact Store checks passed; this does not claim a visual inspection of every screen on every device. |
| Android packaging | Release optimization and Android 15 theme recommendations needed attention. | R8/resource shrinking ran, modern app-owned theme settings were adjusted, and the native payment probe survived optimization. Third-party React Native/Material deprecated calls may still trigger Play's separate warning. Final main-menu version text was corrected to 1.0.11. |

## Account backup and recovery tests

Automated results below are from real app orchestration/storage logic with
controlled provider/device-storage responses. They exercise failures safely,
but do not simulate a second physical device's real providers. The final gate
passed all **17 account recovery, 13 cloud service, eight backup journal,
three Google recovery login and 29 encrypted-save cases**. The 29 encrypted
cases include general persistence as well as account recovery.

| Scenario | Verified outcome |
| --- | --- |
| Both modes recovered after reinstall | IDs, modes, remaining balances, inventory, entitlements and grant markers are restored without a new grant or restarted timer. |
| First sign-in with existing local careers | Local careers are backed up prospectively; guest saves are not uploaded under an invented account. |
| Existing Google account versus fresh reinstall guest | Recovery signs into the existing identity rather than linking it to the new anonymous guest. Explicit guest linking still works. Cancelling login keeps local saves. |
| Older remote snapshot versus newer local progress | Older cloud data never overwrites newer local state. |
| Occupied preferred slot | Recovery uses another empty slot in the same mode, not destructive replacement. |
| Full mode, unreadable slot or stored JSON null | No overwrite, other-mode slot theft or false declaration that the data is empty/backed up. |
| Corrupt remote payload or future schema | Invalid/unsupported data is rejected without erasing the original save. |
| Missing backend, offline request or failed listing | Local careers remain playable; failure is not reported as confirmed backup or an empty cloud account. |
| Switch account or sign out while downloading | Late results cannot restore/upload another account's career; identity is checked again at commit. |
| Bound save opened under another account | The original ownership cannot be silently rebound or uploaded to the other account. |
| New reward/write during older upload | An older acknowledgement cannot clear the newer dirty revision. Rapid dirty markers are serialized. |
| Career created while uploads are running | Backup remains unconfirmed until the new career is also backed up. |
| Failed local recovery write or metadata acknowledgement | Failure remains retryable; no duplicate career, invented reward, changed last-played or false confirmation. |
| Repeated foreground recovery | No repeat download/grant of the same paid state. |
| Reinstallation changes device encryption key | The snapshot is resealed for the new device while preserving remaining paid state. |
| Tampered primary, missing key or failed migration | Ciphertext/checksum/identity checks and rolling backups protect existing data; corrupt slots are not silently reset or reused. |
| Reserved high-numbered QA slots | Device-only test slots are excluded from normal account backups. |

Tests: [accountRecovery](../src/services/__tests__/accountRecovery.test.ts),
[accountCareerCloud](../src/services/__tests__/accountCareerCloud.test.ts),
[accountBackupJournal](../src/storage/__tests__/accountBackupJournal.test.ts),
[googleRecoveryLogin](../src/services/__tests__/googleRecoveryLogin.test.ts),
[encryptedSaves](../src/storage/__tests__/encryptedSaves.test.ts).

### Real Google account reinstall test

This was actually executed on the Pixel Android emulator against the live
account-backup service, not merely asserted in a unit test. The approved
`202610110001_account_career_backups` migration was deployed beforehand.

1. Confirmed nine account-scoped, checksum-verified careers: five Player and
   four Manager.
2. Uninstalled the package without retaining app data. Package absence,
   first-run onboarding, no Resume and empty slots confirmed a clean install.
   Android automatic backup was disabled.
3. Reinstalled and signed into the same Google account. Careers recovered from
   the service, **not an emulator snapshot or imported fixture**.
4. Compared all nine full cloud snapshot hashes and revisions immediately
   afterward: unchanged.
5. Opened the purchased Starter career: **4,000 coins / 50 gems**, the original
   absolute ad-free expiry and purchase markers remained. Manager Medical
   Centre retained **one remaining recovery token**, not a new full pack.
6. Repeated recovery, force-stopped/reopened, installed the updated QA APK in
   place and cold-started offline. IDs, modes, slots, balances, inventory,
   entitlements and grant-marker hashes remained correct. Normal saves advanced
   only the relevant backup revisions.
7. Offline Backup now correctly reported **Backup not confirmed** while local
   play remained available. Restoring network and retrying confirmed backup
   without another sign-in.

Evidence: [account reinstall summary](../test-artifacts/account-cloud-reinstall-2026-10-11/qa-summary.json)
and the `cloud-*.json`/device captures in that directory. Protective snapshots
were retained for device-only QA fixtures; they were not used for the tested
standard-career recovery. No new checkout occurred during this recovery pass.

## Save import and deletion tests

| Scenario | Verified outcome and evidence type |
| --- | --- |
| Confirmed occupied-slot import | Explicit expected-career replacement succeeds and imported state is saveable. Automated storage integration. |
| Import storage failure | Original active career and recoverable disk state survive; imported unsaveable state never becomes active. Automated injected failure. |
| Career switch while import finishes | The newly selected career remains selected. Automated delayed-write integration. |
| Corruption after import | The original rolling backup remains recoverable and saveable. Automated encrypted-storage integration. |
| Import over unresolved checkout | Rejected before replacing the paid grant's original save. Automated commerce integration. |
| Delete active career then background/autosave | It stays deleted; a late write cannot resurrect its ID. Automated store plus storage integration. |
| Delete confirmation after slot replacement | Rejected; the replacement identity is retained. Automated encrypted-storage regression. |
| Delete known active ID with unreadable disk copies | The old identity is still revoked; failure does not revive it. Automated regression. |
| Reuse deleted slot for another career | Allowed; revocation applies to the deleted ID, not every future save in that slot. Automated regression. |
| Pending purchase or unreadable checkout journal | Original paid destination cannot be deleted/replaced; unrelated saves are not unnecessarily blocked. Automated fault injection. |
| Delete account-bound backup | Remote deletion must be positively confirmed first; stale uploads/recovery and another account's delete request are rejected. Automated journal/cloud tests and isolated SQL checks. |
| Purchased exact-save sponsor deletion | Requires an exact positive server confirmation before local removal. Mock-only development grants remain distinct. Automated sponsor guard tests. |
| Full account deletion | Client accepts only durable success with an opaque request reference, sends no client-selected account ID, and keeps privileged deletion RPCs unavailable to client roles. Three automated boundary tests; **no real production account was deleted in this hotfix verification**. |

Tests: [storage commerce integration](../scripts/storage-commerce-audit.test.ts),
[encrypted saves](../src/storage/__tests__/encryptedSaves.test.ts),
[backup journal](../src/storage/__tests__/accountBackupJournal.test.ts),
[account deletion boundary](../src/services/__tests__/accountDeletion.test.ts),
[sponsor deletion](../src/services/__tests__/premiumSponsorSaveDeletion.test.ts),
[mode races](../src/screens/__tests__/savedGamesModeRace.test.ts),
[SQL checks](../scripts/account-career-backups-sql.test.cjs).
Career deletion, full account deletion and uninstall are different operations;
the real reinstall test must not be described as a live account-deletion test.

## IAP and currency tests

The final gate includes **60 commerce recovery cases and 19 unpaid-checkout
provider-resolution cases**. These are controlled tests. Exact store grants,
guest/provider identity, reward idempotency and restore behavior have additional
catalogue/reward/provider tests in the same 1,709-test gate.

| Scenario | Verified controlled-test outcome |
| --- | --- |
| Save fails before checkout | No payment sheet starts; the original career remains intact. |
| Double tap or existing unresolved payment | No second checkout. |
| Pending payment | No early coins, gems, tokens or entitlement grant. |
| Missing transaction ID or wrong product | No fulfillment from an invalid successful-looking response. |
| Failed receipt journal write | A single new matching provider transaction can reconcile using pre-checkout history and provider time. Ambiguous/old histories are not guessed. |
| Failed grant save followed by process restart | Protected receipt remains recoverable; original career receives its grant exactly once. Success is not reported before durable fulfillment. |
| Career switch before delivery | Original Player/Manager destination receives the grant; selected career stays selected and gets no accidental reward. |
| Replaced/deleted original slot | No grant to a replacement career; unresolved delivery stays protected for support. |
| Account change, wrong provider identity or ambiguous history | Recovery fails safely; no transfer to the wrong person and no repeat charge. Provider-confirmed guest linking is handled separately. |
| Duplicate receipt or cleanup failure | Persisted transaction marker prevents another grant, even if journal cleanup must retry. |
| Concurrent exchange and purchase recovery | Both grants survive in the original inactive career. |
| Cancel before confirmation | No grant; definite cancellation clears the intent and allows a later legitimate checkout. |
| Slow decline versus uncertain provider/network state | Only positively checked unpaid results release the lock. Pending/unconsumed paid inventory, new receipts, invalid history, missing native probe, timeout or account change retain it. |
| No pending journal | Honest no-pending result; no automatic purchase or replay of old consumables. |
| Historical Starter receipt but missing local ownership | Another Starter checkout is blocked for the current provider history and directed to support. One- and two-receipt cases are covered in both modes. |
| Revoked VIP or normal restore | Revoked access is not restored; genuine restorable mode entitlements restore idempotently without replaying coins, gems, toolkit tokens or save-bound consumables. |
| Gem exchange save failure, new rewards or spending | No stale rollback; newer wallet changes and selected career survive. Committed exchange recovers exactly once; unaffordable exchange grants nothing. |
| Recovery token, facility token and budget products | Correct inventory/mode/season/cooldown guards; no useless recovery charge, hidden cash spend or national-duty club operation. |
| Rewarded ads, daily and pass rewards | Transaction/claim guards prevent repeated rewards; no live ad-impression certification is implied. |

Tests: [commerce recovery](../src/state/__tests__/commerceRecovery.test.ts),
[cancelled checkout](../src/services/__tests__/cancelledCheckout.test.ts),
[career rewards](../src/state/__tests__/careerStoreRewards.test.ts),
[guest purchases](../src/services/__tests__/guestPurchases.test.ts),
[purchase catalogue](../src/services/__tests__/purchases.test.ts).

### Real Google Play license billing tests

The Pixel emulator used real Google Play and RevenueCat, but Google's **free
test payment methods**. The checkout explicitly said the user would not be
charged. These were not simulated successes and were not real UPI payments.

| Executed case | Observed result |
| --- | --- |
| Manager Bag of Coins slow approval plus force-stop/reopen | Original wallet **1,000 → 11,000 coins**; one 10,000-coin grant; journal cleared after delivery. |
| Player slow approval and repeated cold restart | Wallet stayed **2,500 coins / 75 gems** while pending, then **12,500 / 75** after approval; no duplicate grant after restart. |
| Player payment then switch to Manager before approval | Player received the single grant; Manager stayed **11,000 / 0**. |
| Unconfirmed sheet cancellation | No reward/payment and another checkout could open. A raw `cancelled` alert wording was observed in the earlier pass. |
| Genuine pending payment then attempt another checkout | Second checkout blocked with a pending confirmation/delivery warning. |
| Slow decline after force-stop | No reward. The initial test exposed a stuck Store lock; A15 fixed it. The same retained journal then cleared without changing **12,500 / 75**. |
| Fresh slow decline on the fixed APK | No premature grant, second checkout blocked while truly pending, then **Checkout no longer pending** and later checkout available after confirmed unpaid resolution. |
| Fresh slow approval on the fixed APK | Wallet remained **12,500 / 75** while pending, then reached **22,500 / 75** exactly once; restart retained it and Manager remained **11,000 / 0**. |
| First Starter Pack | Eligible test career **1,000 / 0 → 4,000 / 50**; offer disappeared. A different eligible local career could not buy it again. |
| Guest clean uninstall/reinstall on the same Play account | **Restriction failed:** a new anonymous install could buy another Starter. A second free test order granted **3,000 coins / 50 gems** once to the fresh test career. This is a known client/account-identity limitation, not a fixed cross-device cap. |

Evidence: private device captures under
`test-artifacts/emulator-economy-2026-10-11/`, especially `billing-*`,
`cancel-fix-*` and `starter-reinstall-*`. The
[chronological audit](WHOLE_APP_AUDIT_2026-10-11.md) records the original
failures and later passing reruns. Raw screenshots/XML can contain account or
payment details; **do not publish them or commit them as public evidence**.

## Purchase policy and recovery boundaries

Starter Pack still advertises **3,000 coins, 50 gems and seven ad-free days**.
The current source retains the install-wide ownership marker and the current
RevenueCat customer's historical-receipt guard. It was **not changed to a
repeatable product or once per save** in this release. A source comment saying
one per account is not proof of an authoritative Google-account-wide limit.
The owner discussed alternate rules, then requested no further purchase-policy
change for this production hotfix.

Account backup restores the **remaining saved balance/inventory and original
expiry**. It does not refund spent currency, restart seven free days, replay a
consumable pack or recover a career that was never successfully backed up.
Ordinary Restore Purchases is different: it restores eligible permanent
entitlements, not spent consumables.

For existing customers: update **without uninstalling first**, sign into the
recoverable app account and wait for **Account backup confirmed**. After a
later reinstall, sign into that same account to recover the latest confirmed
snapshot. Merely being signed into the Google Play Store is not app-account
backup. Offline/local-only progress after the last confirmation can be lost
on uninstall. Previously lost unbacked-up consumables and old unrecorded grant
destinations cannot be reconstructed by this migration.

The disputed customer case has two provider-recorded Starter purchases, but
their exact game error, original career/delivery state and current refund
status were not established from the shared screenshots. The safeguards reduce
future duplicate-charge/delivery risks; they do not prove a historical disputed
grant was delivered or automatically resolve compensation. No refund or
additional customer charge was performed by these checks.

Still separate from the completed checks:

- A server-authoritative cross-device consumable receipt/destination ledger
  and one-purchase limit.
- Concurrent real two-device account restore or Play-account switching.
- Real permanent-entitlement purchase/restore and every product's live
  pending-payment path.
- Physical force-stop exactly during a partial cloud download, injected real
  disk failure during live payment, and every real provider outage.
- Destructive deletion of a live production account.
- Every Android size/OS/navigation/font combination, all press prose, real
  ad impressions and the disappearance of third-party deprecated-API warnings.
- All iOS signing, simulator/device behavior, Apple products, sandbox billing
  and App Store privacy/login/review requirements.

## Final Android emulator and packaging checks

The final-AAB-derived, debug-resigned emulator-only APK was installed in place
on Pixel 10 Pro XL, Android 17/API 37 with 16 KB pages. Android and the menu
reported **1.0.11/code 16**. All nine careers remained visible and the Starter
career remained **4,000 coins / 50 gems** with account backup confirmed.
Manager **11,000 / 0**, background save/cold resume, pending press duty, repeated
mode switching, localized Store prices, disabled QA tools and compact
360×640 dp Store layout were also checked on the production candidates.

Bundletool/signature checks passed; upload certificate matched the earlier
production release. Standalone Hermes bytecode was present; R8 and resource
shrinking ran; payment recovery native code was retained; native alignment and
derived APK equivalence checks passed. Scoped final-process logs showed no
detected JS/native fatal, linker or missing-class exception in exercised paths.
No new payment, uninstall or account deletion was performed in final packaging.

The project skill kept QA and production artifacts separate and preserved the
approved career, currency, save and purchase rules. The document workflow kept
historical failed tests distinct from later fixes and real-provider checks.
