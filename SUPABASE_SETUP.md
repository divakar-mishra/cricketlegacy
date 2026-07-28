# Supabase Setup

## What To Get From Supabase

Open your project in the Supabase dashboard.

1. Project URL
   - Go to `Project Settings` -> `API`.
   - Copy the `Project URL`.
   - It looks like `https://your-project-ref.supabase.co`.

2. Publishable key for the mobile app
   - Go to `Project Settings` -> `API Keys`.
   - Prefer the `Publishable key` (`sb_publishable_...`) if your project has the new key system.
   - If the project only shows legacy keys, copy the `anon public` key.
   - This key is safe to ship in the mobile app only when Row Level Security policies are correct.

3. Anonymous sign-ins
   - Go to `Authentication` -> `Sign In / Providers`.
   - Enable `Anonymous sign-ins`.
   - This lets a guest player receive a real Supabase Auth user id/JWT without collecting email.

4. Secret/service key
   - Do not put a secret/service-role key in this mobile app.
   - The current implementation uses user JWTs, Row Level Security, and SQL RPC functions, so the app only needs the Project URL and publishable key.

## Where To Put The Mobile Values

For local development, copy `D:\APP\.env.example` to `D:\APP\.env.local` and fill in:

```text
EXPO_PUBLIC_SUPABASE_ENABLED=false
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

If you only have the legacy anon key:

```text
EXPO_PUBLIC_SUPABASE_ENABLED=false
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_legacy_anon_key_here
```

Do not put a secret/service-role key in `.env.local` for the app.

Keep `EXPO_PUBLIC_SUPABASE_ENABLED=false` until the SQL migration below has been applied and anonymous sign-ins are enabled. Flip it to `true` only after a debug build has verified sign-in and daily verification against your Supabase project.

## Database Setup

The repo now contains the required Supabase SQL migration:

```text
D:\APP\supabase\migrations\202607170001_stabilization_backend.sql
```

Fastest dashboard path:

1. Open Supabase Dashboard -> SQL Editor.
2. Open the migration file above in this repo.
3. Paste the full SQL into the SQL Editor.
4. Click `Run`.
5. Confirm these tables exist: `daily_verifications`, `cloud_saves`, `reward_transactions`, `leaderboard`, `shadow_leaderboard`.
6. Confirm Row Level Security is enabled on all five tables.

What the migration adds:

- `record_daily_verification(...)`: authenticated RPC that returns Supabase server time and a 24-hour expiry.
- `claim_reward_once(...)`: authenticated, idempotent reward transaction helper using `(user_id, transaction_id)` uniqueness.
- `cloud_saves`: user-scoped save sync table behind RLS.
- `leaderboard` and `shadow_leaderboard`: user-scoped write policies, public read for visible leaderboard rows only.

Optional Edge Function wrapper:

```text
D:\APP\supabase\functions\daily-verification\index.ts
D:\APP\supabase\config.toml
```

The app currently calls the SQL RPC directly through Supabase Auth. The Edge Function is included for later deployment if you want an HTTP wrapper; it is configured with `verify_jwt = true` and does not require a service key.

## Current App Wiring

The app now reads public Supabase values through:

```text
src/config/supabase.ts
```

The auth/session/cloud/leaderboard services use that central config:

```text
src/services/supabaseClient.ts
src/services/auth.ts
src/services/sessionGate.ts
src/services/cloud.ts
src/services/onlineLeaderboard.ts
```

The repo still has older placeholder values in `app.json`:

```json
"extra": {
  "supabaseUrl": "https://placeholder.supabase.co",
  "supabaseAnonKey": "placeholder-anon-key"
}
```

Those `app.json` placeholders are not the new source of truth for Supabase client setup. Use `.env.local` instead.

Current enablement rule:

```ts
EXPO_PUBLIC_SUPABASE_ENABLED === 'true'
```

When enabled, `Play as Guest` uses Supabase anonymous auth. Daily verification uses Supabase server time, then allows offline local play for up to 24 hours while detecting basic device-clock rollback. Cloud save service calls `cloud_saves` under RLS when a Supabase session exists, but the visible UI still keeps cloud save unavailable until a safe sync screen/conflict flow is verified.

## Backend Scope Needed For Release Gates

Minimum Supabase backend work still needed to unblock `GLOBAL-001` honestly:

1. Supabase project deployment
   - Enable anonymous sign-ins.
   - Apply `202607170001_stabilization_backend.sql`.
   - Set `.env.local` values and `EXPO_PUBLIC_SUPABASE_ENABLED=true` for a debug verification build.

2. Running-app verification
   - Verify a brand-new online guest creates an anonymous Supabase user.
   - Verify daily verification stores a row in `daily_verifications`.
   - Verify offline within 24 hours passes.
   - Verify offline after expiry blocks.
   - Verify basic device-clock rollback blocks.

3. Cloud conflict UI
   - The `cloud_saves` table and service exist.
   - A user-facing sync/restore/merge screen still needs product-safe conflict handling before claiming cloud save complete.

4. Server-side reward adoption
   - `claim_reward_once(...)` exists for server-authoritative rewards.
   - Current local gameplay rewards still need a full server sync policy before competitive/server rewards can be considered complete.

## Current Release Status

Until the Supabase project is configured and running-app verified, server-authoritative auth remains:

```text
GLOBAL-001: BLOCKED
Release readiness: NO-GO
```
