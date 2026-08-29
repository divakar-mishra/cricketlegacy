# Approved Cricket Legacy product rules

Read the sections relevant to the task. These are durable product constraints distilled from the owner's decisions and the current repository. Exact runtime numbers still belong in their source module and focused audit.

## Product identity and navigation

- Cricket Legacy is one fictional cricket game with two careers: Player and Manager.
- Both modes use the same charcoal/night background and visual family. They must not look like two unrelated apps.
- Gold conveys trophies, premium value and important cricket emphasis. Cricket white/cream supports scorecards, paper and formal surfaces. Leather red supports ball, urgency and competitive action. Green is contextual rather than universal.
- The app must not resemble a finance app. Financial UI belongs mainly in Player finance/investments and the deeper Club Office ledger; it must not define the whole game.
- Home is a cricket dashboard, not the complete game. It shows identity, the current chapter/fixture, form or relevant readiness, and a small number of timely destinations.
- A chapter card must own the action needed to progress. Selection meetings, recovery weeks, training weeks, bench outcomes and season transitions cannot become tappable-looking dead ends.
- If an action is blocked, the button must look disabled and the nearby message must name the missing choice. Toss and Manager preparation are important examples.
- A transient “tap to dismiss” layer should dismiss from a tap anywhere on that layer; close controls must work on the first tap.
- Avoid permanent top-level tabs that encourage users to play every match from Home while ignoring progression systems. Use contextual prompts and chapter-driven reasons to visit other areas.

## Copy and information density

- Use concise cricket language on the primary surface. Do not expose internal formulas, raw percentage bonuses, implementation notes or repeated explanations by default.
- Keep one instance of a fact in its natural home: Club Balance in Club Office, detailed league standings in Records, and detailed Player life systems in Player Life or a timely Home entry.
- Information controls are preferred for optional depth, especially on IAP cards. The detail side must state the exact grant, duration, mode/save scope and meaningful exclusions.
- Newspaper copy must be lively editorial sports prose without invented quotes, crowds, injuries, partnerships, innings phases or other facts absent from the verified event.
- Newspaper selection is deterministic for a saved story and avoids recent template/headline repetition. Game logo/name should be prominent; the modal should feel authored rather than bland.

## Player Career

- A new Player starts at age 16 in **Grade A Cricket**. `SCHOOL` may remain as a legacy internal key but must not appear as “School cricket” in user-facing copy.
- The ladder is Grade A → merit-based Under-19 when age-eligible → senior Domestic → senior International.
- Grade A never gives an automatic Under-19 place. Readiness is role-aware and driven mainly by actual runs/wickets, with match rating a smaller component.
- The U19 World Cup is a high-merit opportunity and can occur only once in a career. A player who is dropped or not selected must not play, receive a score, update form, or get appearance stats for those fixtures; they still need a clear advance route.
- Domestic and international selection may leave an established player out. Bench/rest is a real outcome, not a broken state.
- The career must progress age at the season boundary and make the season/age transition visible enough to verify.
- Player form and “recent scores” use appearances only. A team fixture in which the player did not play cannot update the form card.
- Records separate Grade A, Under-19, U19 World Cup, Domestic T20, List A, First Class, T20I, ODI and Test. Historical aggregate stats from older saves must remain visible as an earlier record when exact splits cannot be reconstructed.
- Post-match presentation includes full batting and bowling scorecards for each innings in addition to the summary, player stats and wagon wheel.
- Player Career keeps separate simultaneous affiliations: the domestic club owns
  First-Class/List A cricket and the franchise owns T20 cricket. Rival domestic
  offers appear as two or three popup choices and are based on domestic output,
  so international selection is never required for a valuable long domestic
  career. National duty overrides clashes without cancelling either contract.
- A fully selected, successful international season provides 10 Tests, 25 ODIs
  and 15 T20Is. Selection is refreshed per assignment, and tournament
  elimination naturally reduces appearances. April and May contain no
  international fixtures: those months are protected for franchise cricket.
- One poor match cannot erase an entire international tour. A format drop needs
  sustained collapsed form after at least three appearances in that assignment;
  later assignments re-evaluate merit and can recall the player.
- Every ranked international appearance prospectively records separate career
  best-rank and best-rating milestones for all qualifying Test/ODI/T20I ×
  Batting/Bowling/All-Rounder combinations, including the exact save season,
  displayed year and player age. Old saves must not be given fabricated peaks.

## Player training and long-term rating

- Player technical development is driven by deliberate paid training sessions, not silent automatic attribute inflation.
- Grade A, Under-19 and senior levels provide progressively larger seasonal session/focus allowances. Costs rise with sessions already taken and with higher OVR.
- Every successful session increases eligible attributes directly and shows old value, new value, total growth and decimal OVR progress. The creation screen's five-points-for-three allocation model is not reused.
- A focus that cannot produce a gain is disabled before payment. Never charge for a zero-gain session.
- Training weeks always offer **Continue without training**. Lack of coins cannot stop the career.
- The economy should allow an ordinary free player to reach roughly 78–82 OVR, an engaged free player roughly 88–92, and 95+ through exceptional free commitment or a materially faster paid route. Paid items accelerate; they must not make normal career completion impossible.
- Do not introduce a visible “training did nothing” soft cap. High-level growth can become slower/more expensive, but a purchased valid session must still feel rewarding.

## Player Life and off-field systems

- Player Life, Portfolio/Stock investments and the personal Cricket Academy must not be buried so deeply that a home-only user never discovers them.
- Surface them in an “Off the field” cricket-career context when unlocked, without turning Home into a menu wall.
- Player Portfolio contains 24 fictional companies across Technology, Infrastructure, Mining, Energy, Consumer, Manufacturing, Logistics and Healthcare. It supports multiple simultaneous holdings, adding funds and partial/full sales with immediate feedback and persistence.
- Company values change once per career season from deterministic company/sector behavior, never from the player's cricket results. Stable moves stay within -4% to +7%, Balanced within -8% to +12%, and Volatile within -16% to +20%.
- The retired anonymous stock balance migrates without loss into a sell-only Legacy Market Index. The removed Legacy Token market refunds the higher of token cost basis or current fictional market value exactly once.
- Explain an unfamiliar system through contextual help, not a permanently dense paragraph or a raw “+2%” dashboard.

## Manager Career

- A starting domestic Manager controls a lower-tier squad whose quality fits that tier; results must not be automatically dominant.
- Manager Normal difficulty is neutral. Easy gives modest help; Hard gives roughly a 5% opposition edge; Pro roughly 10%. Genuine team rating, tactics, condition, morale and leadership remain meaningful.
- Instant Sim, Key Moments and Watch use identical underlying Manager balance. Presentation mode cannot change match odds.
- Avoid implausible score extremes when teams are closely rated while retaining rare cricket collapses/upsets. Balance changes require distribution tests, not one anecdotal seed.
- Manager Home contains the cricket action dashboard, not Club Balance, wages, gate income, duplicate streaks, duplicate “top of table” callouts or the full league table.
- League standings and season leaders are reachable in Records. Team played/won/lost/tied/no-result values must update from canonical fixture results in both careers.
- Instant Sim should lead with the result/victory-defeat moment before deeper team summary content.

## Manager club systems

- Club Office owns Club Balance, wage/upkeep detail, kit partnership, infrastructure, staff, treatment and the prominent Home Ground entry. Ground details and Club Balance belong near the top.
- Facilities are three visible destinations: Training Ground, Medical Centre and Youth Academy. They must not be hidden as cramped rows.
- Every facility upgrade offers an explicit choice between Club Balance and an optional purchased token. A token is an IAP shortcut, never the only upgrade path. Do not silently choose one currency.
- Facility, stadium, staff, academy, sponsor, appointment and ticket state belongs to the club and remains when the Manager changes jobs. Inactive clubs stay otherwise unchanged in version one; they do not autonomously upgrade.
- Home Ground has separate Stadium Capacity and Matchday Experience tracks, a visual ground-first presentation, format-specific Low/Standard/Premium ticket presets, attendance history, average crowd/occupancy and projections.
- Higher ticket prices reduce demand. Home semifinals increase demand and have a strong occupancy floor; finals use the approved neutral-ground sharing rules.
- Captain and vice-captain are explicitly appointable, distinct, shown in Squad, and provide only the approved small match-only leadership effect. New saves receive sensible defaults and a review prompt.
- Manager training is automatic between fixtures, uses six plans and Light/Normal/High intensity, and applies through the shared completed-fixture path. It spends neither Wallet Coins nor Club Balance.
- National Manager duty pauses domestic club operations where specified, including premium Manager sponsor payments. The retained club must restore unchanged on return.
- National Managers have Test, ODI and T20I world team rankings showing position, team, matches, points and rating; the controlled country is highlighted and only canonical completed international fixtures move its format table.
- Capped Player Careers have separate Test, ODI and T20I Batting, Bowling and All-Rounder rankings. Only players with completed matches in that format qualify, retired players are removed, and the user's row remains visible even outside the top ten.
- The Player ranking panel also shows the selected format/category's career-best
  rank and rating with the season/year and age at which each independent peak
  occurred.

## Sponsorship and kit identity

- Player earned sponsors pay Wallet Coins. Manager earned sponsors pay the club's Club Balance. Broadcast rights remain a separate Manager income line.
- Each mode offers one earned slot with three contract choices when its approved senior/domestic unlock is reached. Never unlock Player kit sponsorship from Grade A/U19 or pay an unselected appearance.
- A Manager earned sponsor belongs to the club where signed and remains with that club after a job move.
- Premium sponsors are separate ₹499 products for one exact Player or Manager save. They are not account-wide, do not cross modes and do not move to another save.
- A premium save sponsor pays once for the first qualifying completed fixture in each Monday-to-Monday UTC week, scales with current stature, has no missed-week catch-up, and pauses for a Manager on National duty.
- Sponsor branding is dynamic and visible on kit preview, player shirt/portrait presentation, Manager club header/office and Matchday where space allows. Do not permanently bake a sponsor into the fixed portrait image assets.

## Match authority and presentation

- A fixture ID is the idempotency key for result registration, tables, records, reward settlement, sponsorship, attendance and current form.
- Finalization must reject or harmlessly ignore an already-played or missing scheduled fixture. Rapid taps, stale routes and re-entry cannot duplicate it.
- A Player appearance is created only if selected in the resolved XI. Batters not required in a chase may have an appearance with zero runs; non-selected players have no appearance.
- Matchday should prioritize score, phase, current decision and a short recent commentary feed. Full commentary history belongs in the archive. High-speed simulation reduces motion/update frequency rather than stacking text.
- Commentary rows need stable keys, bounded line counts and non-overlapping layout. Pause simulation while modal commentary history is open.
- Manager preparation is concise and progressively disclosed. Scouting must add uncertain-to-revealed intelligence rather than duplicate all stats already available from tapping a player.
- Full scorecards display every innings, dismissals, extras, total and relevant bowling figures.

## Economy, Store and Season Pass

- Wallet Coins, Gems, Training Focus/Energy, Club Balance and transfer budget have separate meanings. Never convert or relabel Wallet Coins as club finance.
- Player coin income and training costs must be audited across a full career, not tuned from only season one. Manager seasonal cash must not make every upgrade trivial.
- Store sections must never be empty without an explicit unavailable/loading state. Visible Buy buttons must work or be visibly disabled with the real reason.
- Restore Purchases is mandatory and applies only to genuinely restorable subscriptions/non-consumables. It must not regrant consumable coins, gems, action tokens or exact-save sponsor products.
- One Season Pass subscription unlocks Premium access across every Player and Manager save on the same store account. Progression remains per individual save: Player and Manager tracks do not merge, and separate saves do not share XP or reward claims.
- Player and Manager Home each show one compact, mode-labelled Season Pass ticket. The pass screen links directly to the Premium Clubhouse so monthly collections and scenarios are reachable.
- Future tier and monthly claims grant only items usable in that save mode: Player receives Player kit/celebration/frame presentation; Manager receives Manager office/ground presentation. Existing already-owned items are never deleted.
- Keep Season Pass screens compact and cricket-themed. Exact price, duration, auto-renewal, claim state, Privacy and Terms remain clear.
- Do not promise wins, selection, trophies, Hall of Fame entry, permanent stats or features the purchase does not grant.
- Production prices come from verified store metadata. Fallback/mock prices are development information, not a live charge.

## Persistence and migrations

- Saves use checksummed envelopes, rolling backups and serialized slot writes. Preserve this architecture.
- Store the active in-memory save when it is newer than disk; never overwrite it with a stale copy during a bulk operation.
- All reward/payment/result paths need durable idempotency markers before they can be replayed or resumed.
- New fields need schema synchronization/migration for every old save shape that can reach them.
- Never reset career totals because a newer scoped-stat map is absent. Do not invent historical competition splits; preserve and label residual totals honestly.
- Exact-save products and Season Pass progress/claims remain attached to their mode/slot/save identity; the Season Pass subscription entitlement itself is account-wide. Intentional deletion must respect the server deletion contract before local deletion when a paid exact-save sponsor exists.

## QA-only controls

- QA tools are enabled only by development mode or `EXPO_PUBLIC_QA_TOOLS=true`.
- Unlimited energy is a QA convenience, not production economy behavior.
- `+10M coins` credits every existing Player and Manager save and durably writes each slot. It must not create new saves or overwrite newer active progress.
- `+1B Club Budget` applies only to the currently active domestic Manager club; it is unavailable during National duty.
- QA APKs embed their JavaScript bundle and use the `qa` build type. They are debug-signed internal artifacts, not store releases.

## Legal and release constraints

- Publisher: Divakar Mishra, individual developer trading as Sunlight, Navi Mumbai, Maharashtra, India; contact `devsunlightpvt@gmail.com`.
- Approved age policy: 18+ in India and 13+ elsewhere. The app is not directed to children and must not be placed in a children/families category.
- Approved policy effective date: 20 August 2026. Retention: account deletion within 7 days; pseudonymous deletion-request status 30 days; provider backup rotation 7 days; security/support records 90 days; minimum pseudonymized purchase/refund/chargeback/fraud evidence 365 days.
- Privacy, Terms, Support and Account Deletion pages must be distinct public HTTPS pages. Store declarations must match actual production SDK/provider behavior.
- Production exact-save sponsor checkout remains fail-closed until KYC, store/RevenueCat products, Supabase migrations/functions/secrets, server receipt verification, webhook handling, automatic backup/recovery UI and sandbox tests are complete.
- A successful local test or QA APK never authorizes enabling production checkout.
- Production signing, AAB/iOS output, console submission and physical-device QA remain separate owner-approved release work.
