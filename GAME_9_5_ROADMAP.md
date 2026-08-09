# Cricket Career Game: 9.5/10 Roadmap

> Historical planning document from 13 July 2026. It is not a description of
> the current source. Use `docs/APP_COMPLETE_REFERENCE.md` and
> `docs/UI_UX_COMPLETE_SPEC.md` for the active implementation.

## Current Rating

Current product rating: 6.8/10.

Commercial potential: real, but not yet dependable. The core idea is strong because cricket games rarely combine player career, manager career, live match control, auctions, youth progression, domestic cricket, national pathways, and monetization systems in one mobile-first package. The product can make money if the first 30 minutes become polished, emotionally clear, and stable.

Target rating: 9.5/10.

To reach that level, the game must feel trustworthy, deep, smooth, fair, and unmistakably cricket-specific from the first session.

## Code Implementation Status - July 13, 2026

Current code-side rating: 8.0/10 after seven real-device bugfix batches.

Implemented in this pass:

- Player creation attributes now feed match outcomes more clearly: batting, bowling, keeping, catching, throwing, agility, running, temperament, confidence, aggression, and discipline all have tested gameplay effects.
- Role-based batting order is enforced for created career players: batters 1-4, wicketkeepers 4-6, all-rounders 5-7, bowlers 8-11.
- Full-project errors-only lint is green after separating true hook-order checks from React Compiler-only adoption checks that do not match current Reanimated usage.
- Typecheck is green.
- Economy tests now follow configured balance constants instead of stale hard-coded values.
- Test match balance is re-tuned after the fielding/keeping engine changes; Monte Carlo now produces a realistic draw/decisive mix.
- A deterministic no-spend economy simulation now guards against obvious two-hour energy-wall regressions.
- First-session trust gates are centralized in `src/game/readiness.ts`: Season Pass and advanced liveops stay hidden until 2 total matches.
- Progression locks now have pure, test-covered reason helpers for National Cup, franchise auctions, and manager multi-format competitions.
- Hubs now use the shared Season Pass trust gate instead of hard-coded local checks.

Real-device bugfix batch completed after the July 13 playtest:

- Training is now role-locked in both UI and store/state logic: pure batters only see batting training, bowlers only see bowling, wicketkeepers see batting/fielding, and all-rounders see batting/bowling/fielding.
- Training cost/session counts are tracked per discipline so batting training no longer raises bowling/fielding costs.
- Creation attribute taps now allocate up to 5 points per tap, clamped to the points remaining.
- Youth club selection no longer shows adult division/squad-strength framing for Under-14 and Under-19 starts.
- Store copy is Google Play-only, restore purchases were removed from the Android store footer, starter pack timer is 24 hours, and starting gems are 0.
- Weekly quests no longer award gems; gems stay scarce and achievement/premium-led.
- Production rewarded ads no longer auto-complete through the mock provider.
- Manager transfers are gated to transfer-window months, bid-war counter offers deduct the actual counter fee, and signed players are removed from the market.
- Match flow now pauses while the batting stance picker is open, removes 4x speed, slows ball cadence, hides skip-to-bat after user dismissal, and only shows DRS after reviewable user wickets.
- Focused regression tests cover role training, per-discipline training costs, weekly gem scarcity, transfer-window gating, and counter-offer signing.

Second real-device bugfix batch completed:

- Onboarding modal decorative layers no longer intercept Android touches, and carousel dots have larger tap targets.
- Android hardware back on player/manager hubs now asks before leaving the active career flow.
- Career hub starter pack countdown is now truly 24 hours in both UI and countdown math.
- Manager record now derives wins, losses, and ties from played user fixtures instead of treating every non-win as a loss.
- Team talks are one per upcoming fixture and now lock after use, so repeated tapping cannot stack form boosts.
- Season Pass card in the store now opens the track screen instead of trying to purchase immediately.
- School/U19 player careers no longer show personal stock portfolio or academy finance panels.
- Club Office staff/facility actions now show failure reasons when unaffordable instead of feeling dead.
- Deadline Day no longer shows a fake "Close Transfer Window" action; it is labelled as navigation back to the manager hub.

Third manager-mode repair batch completed:

- Team Talk is no longer an always-visible dashboard spam panel; Play Match now opens a pre-match Team Talk modal when a talk has not been used for the fixture.
- Managers can skip the talk or choose one tone, then the match starts immediately.
- Squad swapping now works in both directions: tap XI then bench, or tap bench then any XI slot. No long drag from top to bottom required.
- Wage Ledger now exposes Renew buttons for expiring manager contracts and shows success/failure feedback.
- Deadline Day generated fees now display in the same dollar budget framing as the manager economy.

Fourth player-career trust batch completed:

- App launch now enforces a daily session gate: open online once per local day, then the app can continue offline for that same day.
- Guest sign-in records the daily check only when connectivity is available; stale offline launches are blocked with a clear daily-login message.
- Player Career Home now surfaces pending story/interview-style beats directly on the home dashboard instead of hiding them behind the Story tab.
- Career Journey timeline entries now render live tokens such as team and coach names before storage, and old raw timeline entries are rendered safely at display time.
- Player creation now shows an Attribute Dashboard before individual rows, so the first attributes view is role/budget/groups rather than immediately dropping into Technique.
- Attribute decrement controls now use a clean minus button so users can correct allocations without a corrupted glyph.
- Daily Challenge no longer has a tap-to-claim reward exploit; rewards cannot be minted from the screen before the match flow records a real completed challenge.
- New focused tests cover the daily login gate and rendered timeline effect tokens.

Fifth economy/progression trust batch completed:

- Match energy is no longer a flat cost for every career match.
- Youth fixtures are lighter, domestic fixtures use the normal baseline, and international fixtures cost more.
- Format now matters: T10 is cheapest, T20/Hundred use the baseline, ODI costs more, and Test costs the most.
- Career Hub Matchday now displays the energy cost for the next fixture.
- Multi-format competition picker now prices each available fixture independently instead of disabling every option from the next T20 fixture's cost.
- Career store spending now uses the same fixture-aware energy cost for simulated, live, and international matches.
- New economy tests cover format-based costs and youth/international fixture detection.

Sixth remaining-playtest repair batch completed:

- Hall of Fame no longer admits tiny unfinished careers; player careers must now clear a meaningful legacy threshold, and manager entries need trophies/promotions or a real legacy score.
- Added regression coverage so a 69-run unfinished career cannot appear in the Hall of Fame.
- School/U19 pathway now ages out automatically: School players move to U19 at 16+, and U19 players move to Domestic at 20+, preventing 30+ year-old youth-career labels.
- Daily Challenge now has an armed challenge path: pressing Play Challenge stores the active challenge, and rewards are only paid after a completed career match meets the target runs within the target balls.
- The old blind Daily Challenge claim method now refuses unproven challenge objects, preventing tap-to-claim regressions from other screens.
- Main menu Continue card no longer uses the misaligned animated green glow; the resume affordance is now a centered icon button.
- Player creation review now labels the value as "In-game starting OVR" and also shows the potential ceiling, making youth low-start/high-growth ratings explicit.
- Transfer Market no longer shows the dead paid scout-reveal button in the row; scouting remains an in-game coin action until the purchase backend can actually reveal a report.

Seventh manager/match authenticity repair batch completed:

- Player of the Match selection now scores batting milestones, strike tempo, not-out value, wicket hauls, bowling economy, maidens, and wicketkeeper/fielder dismissal impact instead of using a flat cosmetic runs/wickets formula.
- Player of the Match keeps a small winner-team edge but can still award an exceptional losing performance, matching real cricket award behavior more closely.
- Added focused Player of the Match regression tests for all-round performances, losing-team centuries, expensive bowling spells, and wicketkeeper/fielding impact.
- Added a duplicate transfer-signing regression test so a player signed once cannot remain signable, cannot duplicate in the squad, and cannot deduct budget again.
- Manager Hub now exposes monetization as cleaner contextual Club Deals: Store access remains available, low-budget clubs see Emergency Funds, and low-fitness squads see a Physio Recovery Pack.
- Club Office now keeps paid manager monetization contextual: unaffordable facility upgrades can offer Emergency Funds, and cash-poor clubs get a visible Emergency Funds CTA beside the Wage Ledger.
- Deadline Day no longer carries mixed rupee/dollar fee seed data; manager transfer fees stay in the manager economy's dollar framing.
- Verification after this batch: `npm run typecheck`, `npm run lint -- --quiet`, and full `npm test -- --runInBand` are green with 42 test suites and 234 tests passing.

Eighth correction batch completed:

- Restored 4x live-match speed instead of removing it.
- Added an always-visible latest-commentary panel near the field/over display so commentary remains readable while batting or fielding, including at 2x and 4x.
- 4x now skips heavy typewriter behavior and shows the latest commentary line immediately.

Ninth trust/guardrail batch completed:

- Post-match manager Tactical readout now uses the actual scorecard: batting runs, wickets, overs, run rate, boundaries, bowling runs conceded, wickets, and dot balls.
- Tactical readout logic is now a pure helper with regression coverage instead of screen-only copy.
- Added a deterministic first-week no-spend economy simulation so seven daily free sessions are guarded against early energy-wall regressions.
- Leaderboard sanity checks now catch impossible score-per-match uploads, impossible manager titles, negative/extreme wallets, and suspicious long-sample win rates before public leaderboard insertion.
- Added focused tests for first-week no-spend playability, tactical scorecard summaries, and expanded leaderboard shadow-routing rules.
- Verification after this batch: focused Jest suites, `npm run typecheck`, and `npm run lint -- --quiet` are green.

Still requires real playtime/device feedback:

- First 30-minute completion rate and third-match intent.
- Small Android and modern iPhone screenshot pass.
- Commentary readability at 1x and 2x during real interaction.
- Two-hour no-spend feel, not just the energy simulation.
- Store clarity, price perception, and purchase trust.

## Product USP

- Two career fantasies in one game: player mode and manager mode.
- Cricket-specific progression: school, youth, domestic, auction, national, manager levels.
- Live match experience with player intent, manager tactics, commentary, and speed control.
- Domestic and national calendar depth instead of only isolated quick matches.
- Long-term save systems: achievements, records, rivals, contracts, auctions, injuries, morale, facilities, staff, and transfers.
- Monetization hooks that can fit the genre: season pass, cosmetics, energy, starter packs, boosts, premium rewards.
- Low competition in cricket management/career games compared with football and basketball.

## Current Pros

- Strong concept for cricket markets, especially India and other cricket-heavy regions.
- Player and manager modes give the app more surface area than a simple sim.
- Career depth is already broader than many early mobile sports games.
- The codebase has meaningful domain modules for seasons, auctions, liveops, career progression, manager progression, cup play, finance, and match simulation.
- Progression gating is improving: youth players and amateur managers are no longer pushed into advanced competitions too early.
- Manager quests now better match manager behavior instead of asking the user to personally score runs.
- Tactics now persist from live match choices, reducing the feeling that the button is cosmetic.
- Economy has a clearer early-session buffer with more starting currency and a larger energy cap.
- Season Pass promotion is delayed until the user has played 2 matches across any mode, giving the core loop room to breathe.
- The storefront is being shaped around primary currencies and the ₹499 Season Pass, with niche packs rotated into contextual Daily Deals.
- Leaderboard uploads now have an anti-cheat sanity path for impossible scores.

## Current Cons

- UI polish is inconsistent across screens, especially on small mobile viewports.
- Some visual hierarchy is noisy: too many cards, banners, currencies, offers, and systems can appear before the user understands the core loop.
- Commentary at high speed needs continuous testing so text never overlaps or feels jumpy.
- Tactics need visible cause-and-effect: the user should understand what changed, why it mattered, and whether it helped.
- Diamonds/gems still need stronger perceived value and clearer premium uses.
- The first 30 minutes still need a tighter emotional arc.
- Match presentation needs more drama: pressure, milestones, player identity, rivalry, form, and crowd/context.
- The product moat is currently design/content depth, not technology. That moat must be strengthened through polish, balance, and cricket authenticity.
- Monetization could feel premature if offers appear before the user trusts the game.
- There may still be edge cases in season rollover, fixture generation, auctions, and multi-mode progression.
- A full two-hour no-spend playtest still needs to be completed and measured.
- The store needs regular review so contextual deals do not creep back into choice paralysis.

## Market Leader Blocker TODO

These are the practical gaps keeping the app from feeling like the default cricket career/management game in the market.

- Prove the first 30 minutes on real devices: two-match completion, third-match intent, confusion points, and where users hesitate.
- Run a small-screen screenshot audit across the top 20 screens: main menu, new game, player creation, player hub, manager hub, match screen, store, squad, training, transfers, club office, daily challenge, season pass, records, settings, save/load, injury report, contract negotiation, press conference, and academy.
- Tighten the first-session emotional arc: one obvious next action, one strong first reward, one story/selection hook, and a clear reason to play the next match.
- Make match presentation feel more premium: milestone drama, pressure states, partnerships, final-over tension, clearer personal camera, and readable commentary at 1x/2x/4x.
- Add live tactical proof during matches, not only post-match: current plan, AI response, and visible "what changed" feedback after field/bowling/batting changes.
- Reduce hub/store clutter before trust is earned: early users should see cricket goals first, monetization only after the loop is understood.
- Verify the two-hour no-spend loop by hand, not only simulation: energy, rewards, training, progression, and frustration points.
- Make gems feel aspirational: cosmetics, recovery, scouting, customization, premium boosts, and status items should feel more desirable than simple refill currency.
- Harden long-save stability: five-season player and manager runs covering auctions, transfers, cups, international fixtures, season rollover, relaunch, and corrupted save recovery.
- Add automated screenshot/regression coverage for mobile UI overlap and cramped text on small Android and modern iPhone viewports.
- Improve content freshness after season 3: more story events, manager events, rival beats, domestic/national competitions, achievements, records, cosmetics, and season pass rewards.
- Prepare market trust polish: Google Play purchase verification, regional price testing for India, honest store copy, app store screenshots, crash/session monitoring, and leaderboard shadow-review validation.
- Do competitor positioning work: clearly market the dual player/manager fantasy, youth-to-legend pathway, cricket-specific tactical depth, and long-save story engine.

## What Must Improve To Reach 9.5/10

### 1. First 30-Minute Experience

Goal: a new user should understand the game, feel progress, and want one more match.

Required work:

- Make the first screen after mode selection focused on one obvious next action.
- Reduce early clutter: hide advanced liveops, store promos, and secondary systems until the user has played enough.
- Add a guided first match flow with minimal interruption.
- Make the first reward moment satisfying: coins, XP, story update, selection progress, or board reaction.
- Show why the next match matters.
- Add a soft tutorial through UI states instead of long text.
- Test the full first session on a small Android phone and a modern iPhone viewport.

Success metric:

- 70%+ of new users complete two matches.
- 50%+ start a third match.

### 2. Match Experience

Goal: the match should be the emotional center of the game.

Required work:

- Fix all commentary overlap at 1x and 2x.
- Make commentary transitions smooth, readable, and paced.
- Show important match moments more clearly: wickets, milestones, required rate, partnerships, final over, personal objectives.
- Give player mode a stronger personal camera: "you are batting", "you are bowling", "you are waiting", "you were dropped", "you changed the match".
- Give manager mode stronger tactical feedback: field change impact, bowling plan impact, batting approach impact.
- Add post-match cards that explain why the result happened.
- Make match speed controls reliable and professional.

Success metric:

- Users should describe the match as readable and exciting, not just simulated.

### 3. Progression Gating

Goal: users should never ask "why am I eligible for this?"

Required work:

- Keep National Cup locked until appropriate domestic/national status.
- Keep auctions locked until enough seasons, matches, and reputation.
- Gate manager multi-format competitions behind promotions.
- Gate national/international paths behind clear performance milestones.
- Add clear locked-state UI for unavailable systems.
- Add regression tests for every major progression gate.

Success metric:

- Every locked feature has an understandable reason.

### 4. Tactics Clarity

Goal: tactics should feel like strategic tools, not decoration.

Required work:

- Show current tactic state before and during matches.
- Add short post-match tactical summary: "Aggressive batting increased boundaries but raised wicket risk."
- Make AI tactics visible in key moments.
- Tune tactic impact so it matters without becoming a guaranteed win button.
- Add tests/sim runs proving tactics shift outcomes statistically.

Success metric:

- Users can explain why they changed tactics and what happened after.

### 5. Economy And Diamonds

Goal: premium currency should feel valuable but fair.

Required work:

- Define exact gem sinks: energy refill, premium pass, cosmetics, recovery, special scouting, name/logo customization, rare boosts.
- Avoid spending gems on boring actions.
- Make gems feel scarce enough to matter but generous enough to build trust.
- Add first-week economy simulation.
- Add no-pay progression checks: the game must remain fun without paying.
- Add paid-user value checks: spenders should feel they got convenience, status, cosmetics, or optional acceleration.
- Keep the storefront decluttered: always show primary currency packs and the ₹499 Season Pass, then rotate recovery, transfer, training, scouting, and form packs into Daily Deals only when context makes them useful.
- Run a two-hour no-spend loop test before every release candidate. If the player hits repeated energy blocks or progression stalls before feeling mastery, rebalance before shipping.

Success metric:

- Gems are understood as premium, useful, and not mandatory.
- A free player can play for two hours, understand the loop, and still want to return without feeling punished.

### 6. UI Polish

Goal: no screen should look broken in screenshots.

Required work:

- Audit every hub, selection screen, match screen, store screen, and modal on small screens.
- Remove overlapping labels and cramped cards.
- Reduce oversized empty panels.
- Keep CTAs visible and safe-area aware.
- Use compact, scannable dashboards for manager mode.
- Improve spacing consistency.
- Avoid showing too many monetization surfaces at once.
- Add screenshot testing for the top 20 screens.

Success metric:

- Every store screenshot looks shippable.

### 7. Career Emotion

Goal: users should care about their player, club, and season.

Required work:

- Strengthen player identity: role, form, selection pressure, contracts, rival, fan reaction.
- Strengthen manager identity: board pressure, dressing room, transfers, academy, promotions.
- Add memorable story beats after great or terrible performances.
- Make seasons feel like arcs, not fixture lists.
- Add better milestone celebration.

Success metric:

- Users remember specific moments from their save.

### 8. Content Depth

Goal: long-term retention needs fresh goals.

Required work:

- More teams, players, leagues, domestic competitions, youth events, and national events.
- More manager events and player story events.
- More achievements with meaningful rewards.
- Better cosmetics and customization.
- More season pass tiers with attractive rewards.
- Better records, Hall of Fame, and legacy screens.

Success metric:

- Users still have meaningful goals after 10 seasons.

### 9. Stability And QA

Goal: no progression dead ends.

Required work:

- Test season rollover after auctions, transfers, cups, and manager promotion.
- Test every mode after fixtures end.
- Test app relaunch after every major save mutation.
- Test corrupted save recovery.
- Test low energy, no fixture, cup fixture, and multi-format fixture states.
- Add automated coverage around the most expensive bugs.

Success metric:

- A user can play 5 seasons in both modes without getting stuck.

### 10. Monetization Trust

Goal: users should feel the game earns the right to sell.

Required work:

- Keep the Season Pass hidden until 2 total matches across any mode.
- Show premium value after the user understands rewards.
- Avoid showing offers during confusion or dead-end states.
- Make every paid item explain its value through UI, not long text.
- Add cosmetics/status items so monetization is not only energy.
- Add regional pricing and test Indian market price points carefully.
- Offer loyal free players fair relief valves: rewarded ads for energy, daily-login rewards, quest rewards, and healthy regen.
- Add leaderboard sanity checks before public upload, including impossible wallet balances, impossible Season 1 stats, and suspicious win rates.
- Route impossible leaderboard uploads to a hidden review table while returning a normal client success path, keeping the public leaderboard clean.

Success metric:

- Monetization feels optional, fair, and well-timed.

## Release Readiness Checklist

- First 30-minute playtest completed on real devices.
- All visible text fits on small screens.
- Match commentary is smooth at every speed.
- No major progression path has dead-end states.
- Player mode and manager mode both have clear early goals.
- Season Pass appears only after 2 total matches across any mode.
- Storefront shows primary currencies plus the ₹499 Season Pass; niche packs appear only as contextual Daily Deals.
- Two-hour no-spend loop test completed and written down.
- Rewarded ad energy path tested for loyal free users.
- Leaderboard sanity checks and shadow table routing tested.
- Gems have at least 5 valuable uses.
- Google Play purchase flow is tested.
- Save/load and migration are tested.
- App launch, crash recovery, and offline play are tested.
- App store screenshots are captured from polished screens.

## 9.5/10 Definition

This becomes a 9.5/10 game when:

- The first session feels clean and exciting.
- The match engine feels readable and dramatic.
- Progression always makes sense.
- Manager and player modes feel meaningfully different.
- Tactics visibly matter.
- Economy feels fair.
- UI looks professional in screenshots.
- Long-term saves create stories users care about.
- Monetization appears after trust, not before it.
- The game feels like cricket, not a generic sports template.
