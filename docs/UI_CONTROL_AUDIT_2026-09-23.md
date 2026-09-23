# UI control consistency review — 23 September 2026

## Scope and evidence

This is a source-level review of custom tabs, selectable chips, and segmented
controls in the main Player and Manager flows, supplemented by screenshots of
Player Home, Stats, and Progress from the currently installed emulator build.
Those screenshots are saved in this folder. They predate this turn's source
changes, so they are a baseline, not visual verification of the changes below.
Layout at small widths, large system text, and screen-reader traversal remain
unverified on-device.

The review focused on controls most likely to drift or clip: career difficulty,
leadership role, transfer sections and filters, Records sections and filters,
Player Life tabs, staff roles, and handbook categories. Controls that are
intentionally content-sized and wrapping (for example response choices and
country selections) were not forced into equal-width tabs.

## Changes made

- Introduced/reused the shared `SegmentedControl` for Manager difficulty,
  captain/vice-captain role, transfer sections, and Records sections/filters.
  These now share selected/disabled/pressed states, minimum 48dp targets, and
  one-line labels that shrink only as a fallback instead of being cut off.
- Set page-navigation selectors to tab semantics and choice selectors to radio
  semantics. The shared control exposes selected/checked and disabled state to
  accessibility services.
- Replaced Records' horizontally scrolling, hidden-scrollbar main tab strip
  with equal-width tabs. Its 10 career-stat scopes remain a wrapping grid so
  that labels are not squeezed into an unusable single row.
- Preserved wrapping in the 8-role Staff Recruitment selector, added a 44dp
  minimum target and pressed feedback, and supplied explicit role labels.
- Added pressed feedback and explicit labels to Player Life's career and
  in-phone tabs.
- Added full spoken labels and pressed feedback to the compact transfer role
  and sort filters while preserving their intentional horizontal scrolling.

## Remaining review findings

1. **Device layout verification — high priority.** Re-run the affected screens
   on a small Android phone, tablet, landscape, and enlarged text. In particular,
   confirm the 4-option Manager difficulty control and long Records/Transfer
   labels remain readable without horizontal overflow.
2. **Match preparation controls — high priority.** `MatchScreen` contains
   several separate tactic/preparation chip groups. They have different
   enabled/disabled rules, so audit each group in the live toss/preparation
   flow; verify that disabled tactics explain why, and that selected/pressed
   states remain distinguishable. Do not replace these with a generic selector
   without preserving game rules.
3. **Selection chips — medium priority.** Player-profile training-focus chips,
   notification filters, squad filters, and the country-selection chips on Home
   remain screen-specific. Source review did not prove a clipping defect, but
   check target size, selected state, full accessible labels, and wrapping on
   compact layouts before deciding whether to consolidate them.
4. **Touchable cards and overlays — medium priority.** Inspect nested card
   actions, modal backdrops, and fixed bottom actions on-device for accidental
   hit interception or controls hidden behind an overlay/system navigation.
5. **Accessibility and themes — medium priority.** Check VoiceOver/TalkBack
   focus order, selected-state announcements, contrast in both themes, and
   minimum target sizes. Source attributes alone do not establish usability.
6. **Visual regression — follow-up.** Capture a baseline for Player and Manager
   home plus the screens above, with normal/enlarged text and narrow/landscape
   layouts. Compare after future shared-control changes.
7. **Profile navigation — investigate before release.** During coordinate-based
   emulator navigation, the attempt to open Player Profile ended on a full-time
   match result screen. It is unclear whether this was a mis-targeted emulator
   tap or a navigation/touch-routing defect. No "Continue season" or other
   match-result action was tapped. Reproduce deliberately with accessibility
   bounds or an automated navigation path before treating this as a confirmed
   app defect.

## Verification in this review

Run TypeScript typecheck, ESLint on touched UI files, and `git diff --check`.
No app build, install, or automated test suite was run. Screenshots show the
pre-change installed build and do not validate this source revision.
