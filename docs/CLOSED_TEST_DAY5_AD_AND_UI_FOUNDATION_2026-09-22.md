# Closed-test Day 5: ad and UI foundation

## Approved interstitial policy

- Minimum interval: 15 minutes.
- Maximum: 4 interstitials in a rolling 60-minute window.
- Entry point: only after returning to the Player Career Hub, and only after
  three completed appearances.
- Never use a live match, an innings, a result settlement or an unsaved
  transition as an interstitial entry point.
- `areAdsRemoved()` remains the entitlement gate for permanent VIP/bundle
  ownership and the timed Starter Pack ad-free period.

The boundary in `src/services/ads.ts` now requires a typed safe point. New ad
call sites cannot be added without declaring and reviewing that safe point.

## UI consistency foundation

- `SegmentedControl` is the shared radio-style control for compact mutually
  exclusive choices. It uses equal-width segments, consistent selected,
  disabled and pressed feedback, and supports Dynamic Type shrinking.
- Player creation uses it for batting hand, bowling hand, bowling style and
  difficulty. The four bowling disciplines therefore remain on one row where
  the screen has normal phone width instead of leaving `Leg-spin` alone below.
- Saved Games now uses the same control for Player / Manager mode selection.

## Verification

- `npm run typecheck`
- `npm run lint -- --quiet`
- Focused Jest coverage for ad policy and player-creation selectors
- QA APK built with `:app:assembleQa`; it contains `assets/index.android.bundle`.

## Emulator note

The local QA APK is debug-signed. Android will not install it over the
Play-signed `com.coverdrive.cricket` package already on the emulator. Do not
uninstall the Play build or erase its data without explicit owner approval.
Either install the QA APK on a clean emulator or explicitly approve removal of
the Play-signed emulator package first.
