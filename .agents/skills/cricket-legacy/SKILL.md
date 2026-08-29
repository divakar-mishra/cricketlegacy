---
name: cricket-legacy
description: Build, review, balance, document, test, or package the Cricket Legacy Expo/React Native game. Use for work involving Player Career, Manager Career, match simulation, cricket-first UI, economy/IAP, save migrations, store/legal readiness, or Android QA in this repository.
metadata:
  short-description: Cricket Legacy product and engineering rules
---

# Cricket Legacy

Use this Skill for every product or implementation change in the Cricket Legacy repository. It preserves the decisions already approved by the owner while keeping current source code—not an old proposal—as the final implementation authority.

## Establish the truth before changing anything

Use this priority order when sources disagree:

1. The owner's latest explicit instruction in the current conversation.
2. Current runtime code, schemas, migrations, tests, and generated configuration.
3. The newest focused approved document for the affected system.
4. Broad audit documents as navigation maps, not automatic proof of current behavior.

Always inspect the relevant source and existing tests with `rg` before proposing or editing behavior. Some broad audits have older verification dates and known stale statements. Do not revive a removed feature merely because an old document describes it.

Read [references/approved-product-rules.md](references/approved-product-rules.md) for any gameplay, UI, economy, persistence, commerce, or release task. Then read only the focused documents needed for the current change:

- Whole-app architecture and feature map: `docs/APP_COMPLETE_REFERENCE.md`.
- Detailed UI inventory and component system: `docs/UI_UX_COMPLETE_SPEC.md`.
- Cricket-first visual direction: `docs/CRICKET_FIRST_UI_AUDIT.md`.
- Player ladder, U19, sponsorship, training and readiness: `docs/PLAYER_CAREER_PROGRESSION.md`.
- Manager sponsorship, facilities, stadium, tickets, training and leadership: `docs/MANAGER_SYSTEMS_IMPLEMENTATION_AUDIT.md`.
- Newspaper catalogue and repetition rules: `docs/NEWSPAPER_CONTENT_PROPOSAL.md`.
- Store, privacy, legal pages and release blockers: `docs/STORE_LEGAL_COMPLIANCE.md`.
- Exact-save premium sponsor security and recovery: `docs/PREMIUM_SAVE_SPONSOR_CHECKOUT.md`.
- Runtime commerce guards: `src/services/purchases.ts`, `src/state/careerStore.ts`, and the root economy/IAP audits.
- Current game constants: `src/data/gameConfig.ts` and the owning module; never copy a number from UI text without checking its source.

## Working agreement with the owner

- Do not guess a new number, eligibility rule, price, scope, progression gate, reward, expiry, or destructive migration. Explain the choice and ask when the answer is not already approved or discoverable.
- Diagnose concrete bugs from state flow and source evidence. Avoid speculative redesigns that expand the request.
- Preserve the dirty worktree. Existing edits and generated assets belong to the owner unless proven otherwise.
- For UI or gameplay iterations, implement the approved change and report it for review before running the full suite, creating an APK, or installing it. Run those only when the current request explicitly asks for them.
- A request to build or install a QA APK does not authorize a production release, store submission, backend deployment, KYC action, purchase enablement, or deletion of saves.
- When the owner asks to discuss or preview first, make no runtime implementation until approval is explicit.

## Product test for every change

The game must pass these four checks:

1. **Cricket first:** without the logo, the user can identify the cricket context, their current place, and the next cricket decision within five seconds.
2. **One coherent app:** Player and Manager modes share the same background, design language, match authority, and quality bar; they differ by role, not by looking like separate products.
3. **No dead ends:** every required choice is visible, missing prerequisites are explained beside a visibly disabled action, and optional spending never blocks basic career continuation.
4. **Authoritative progress:** fixtures, results, tables, form, stats, age, rewards and sponsor payments update exactly once from canonical completed state.

## UI and writing decisions

- Use the shared charcoal/night foundation, warm gold, cricket white/cream and leather red. Emerald/grass green communicates pitch, availability, success or selected state; it is not the universal action or money color.
- Prefer cricket objects and places—fixture ticket, scoreboard, team sheet, coach board, ground plan, contract sheet, scorebook, kit, newspaper—over generic financial dashboard cards.
- Keep core screens action-led and scannable. Remove repeated explanations, duplicated metrics, raw formulas and obvious tutorial copy from the normal surface.
- Put optional depth behind an `i` control, drill-down, or contextual help. Paid-card information must remain explicit and accessible even when the front face is compact.
- Do not replace useful information with ambiguity. Cost, paid duration, renewal, restore behavior, selection state, format and required action remain clear.
- A home screen must not become a tunnel that lets the user ignore the rest of the game. Surface timely reasons to visit Training, Player Life, Portfolio, Academy, Squad, Transfers, Club Office and Records through the current chapter and cricket context.
- Use one resolver-owned primary action. Do not scatter two competing “next” actions for the same state.
- Popups, commentary, sticky actions and long labels must work on compact Android screens without clipping, overlap or horizontal overflow.
- Newspaper prose should read like a sports newspaper, use only verified match/career facts, avoid robotic receipt language, and obey deterministic repetition control.

## Gameplay and state invariants

- Instant Sim, Key Moments and Watch must settle through the same underlying balance and finalization authority.
- Do not grant a result, appearance, form score, stats, payment or table update to a player/team that did not actually participate.
- A scheduled fixture can be completed once. Reopening, duplicate taps, stale calendar events or repeated finalization must not replay it or pay it again.
- Progression and selection are merit-led. Do not add automatic selection merely to smooth the flow; provide a valid bench/advance route instead.
- Training must feel rewarding while preserving progression and economy. A paid successful Player session must display real attribute movement and may never silently consume currency for zero gain.
- Preserve totals during migrations. If old saves lack newer competition splits, display an honest earlier/combined residual rather than resetting historical runs, wickets or matches to zero.
- Every persisted shape change requires a forward migration and legacy-save coverage. Never solve a schema issue by discarding unknown older state.

## Implementation boundaries

- The app is Expo SDK 57 / React Native. Read the exact Expo 57 documentation required by `AGENTS.md` before changing Expo/native configuration.
- Keep deterministic engine logic in pure game modules and use `careerStore` as orchestration/fulfilment, not as a dumping ground for every formula.
- Reuse theme tokens and shared components. Do not hard-code a parallel visual system inside one screen without a deliberate reusable reason.
- Maintain Player/Manager money separation, mode guards, per-save products, idempotency ledgers and backend fail-closed gates.
- Never place a service-role key, provider secret, receipt-verification key or webhook secret in Expo public environment variables or the APK.
- Do not turn fictional clubs, sponsors, grounds or competitions into unlicensed real-world brands.

## Verification and packaging

When verification is authorized, prefer this order:

1. Focused tests for the changed invariant.
2. `npm run typecheck`.
3. `npm run lint -- --quiet`.
4. `npm test -- --runInBand` or `npm run check` for the complete gate.
5. `git diff --check`.

For a standalone internal Android build with QA tools, build the `qa` variant with `EXPO_PUBLIC_QA_TOOLS=true` and `NODE_ENV=production`. Confirm the APK contains `assets/index.android.bundle`; a Metro-dependent debug APK is not acceptable for handoff. The local QA artifact is debug-signed and must not be presented as a Play Store release.

Install with `adb install -r` so existing emulator data is retained unless the owner explicitly requests a clean install. Do not uninstall or clear package data as part of an ordinary update.

Production release gates are separate. Do not bypass legal URL checks, provider-price requirements, signing, backend verification, store-console configuration or production KYC because a QA APK succeeds.

## Handoff

Lead with what changed and what the user can now verify. State tests/build/install facts precisely. Mention unresolved decisions or release blockers without representing them as implemented. Link directly to changed project files or the APK when helpful.
