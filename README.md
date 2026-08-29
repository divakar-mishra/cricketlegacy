# Cricket Legacy

Android-first, offline-capable Expo/React Native cricket career game with Player Career and
Manager Career modes, a deterministic ball-by-ball match engine, long-lived
save migrations and optional online/commerce integrations.

## Local setup

Expo SDK 57 requires Node.js 22.13 or newer. Local native Android builds use
Java 17 and the Android SDK installed by Android Studio.

```bash
npm ci
cp .env.example .env.local
npm run check
npm start
```

To verify the native Android project locally:

```bash
cd android
./gradlew :app:assembleDebug
```

Use an EAS development build for native AdMob, RevenueCat and notification
behavior. Expo Go remains useful for the local game and most UI work.

## Product boundaries

- Local careers and guest play do not require internet access.
- Cloud backup, Google sign-in and global leaderboards are not advertised as
  complete until their player-facing flows are enabled.
- Leaderboards are disabled by default and require the hardened Supabase
  migration plus `EXPO_PUBLIC_LEADERBOARDS_ENABLED=true`.
- Release purchases and the Main Menu Store entry remain unavailable when
  RevenueCat public SDK keys are absent. Development mock purchases remain
  confined to `__DEV__` builds.

## Important documentation

- `docs/APP_COMPLETE_REFERENCE.md` — current implementation reference.
- `docs/UI_UX_COMPLETE_SPEC.md` — current interface and flow reference.
- `SUPABASE_SETUP.md` — optional backend and migration setup.
- `PREMIUM_TRANSACTION_DESIGN.md` — commerce fulfillment rules.
- `STORE_LISTING_AND_LAUNCH.md` — store copy and soft-launch plan.
- `docs/STORE_LEGAL_COMPLIANCE.md` — legal, deletion and store-console release audit.
- `legal-site/README.md` — Cloudflare Pages legal/support site and required decisions.

## Release gate

Before distributing a production build:

1. Run `npm run check:release` and confirm the GitHub quality workflow passes.
2. Test save/relaunch, app-background saving and storage-failure messaging on a
   physical Android device.
3. Confirm production crash/analytics events arrive remotely.
4. Verify the production AAB signing identity and incremented Play version.
5. After store/KYC setup, verify every IAP with licensed test accounts before
   supplying production RevenueCat keys.
6. Confirm the four hosted legal/support URLs, selected age treatment, approved
   retention values and deployed authenticated account-deletion service.
