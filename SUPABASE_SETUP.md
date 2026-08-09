# Supabase Setup

Supabase provides the backend foundation for anonymous authentication,
once-per-day online session verification, cloud-save slots, public leaderboard
rows, hidden leaderboard review rows and idempotent reward transactions.

The database and client services are present, but cloud conflict resolution and
the public online leaderboard still need user-facing screens before either
feature should be advertised as complete.

## Dashboard Values

In the Supabase dashboard:

1. Copy the Project URL from `Project Settings -> API`.
2. Copy the publishable key, or the legacy anonymous public key.
3. Enable `Anonymous sign-ins` under `Authentication -> Sign In / Providers`.

Never place a secret or service-role key in the mobile app.

## Local Environment

Copy `.env.example` to `.env.local` and set:

```text
EXPO_PUBLIC_SUPABASE_ENABLED=false
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Leave `EXPO_PUBLIC_SUPABASE_ENABLED=false` until the migration is deployed and
anonymous sign-in is enabled. The app reads these values through
`src/config/supabase.ts`; `app.json` does not contain a second Supabase config.

## Database Migration

Apply this file in the Supabase SQL Editor:

```text
supabase/migrations/202607170001_stabilization_backend.sql
```

It creates:

- `public.daily_verifications`, with Row Level Security restricting each user
  to their own row.
- `public.cloud_saves`, with user-scoped read/write policies.
- `public.reward_transactions`, with one row per authenticated user and
  transaction ID.
- `public.leaderboard`, publicly readable but writable only by the authenticated
  row owner.
- `public.shadow_leaderboard`, a private destination for implausible uploads.
- `public.record_daily_verification(...)`, an authenticated RPC that records
  Supabase server time and returns a 24-hour expiry.
- `public.claim_reward_once(...)`, an authenticated idempotent reward-claim RPC.

No Edge Function deployment is required. The app calls the RPC directly.

## Runtime Wiring

The active files are:

```text
src/config/supabase.ts
src/services/supabaseClient.ts
src/services/auth.ts
src/services/sessionGate.ts
src/services/cloud.ts
src/services/onlineLeaderboard.ts
src/services/antiCheat.ts
```

When enabled, Guest play creates or resumes an anonymous Supabase session.
Daily verification uses server time and then permits offline play for up to 24
hours. The local session gate also rejects a significant backward device-clock
change.

The cloud service can push, pull and list authenticated save slots. Until a
conflict-resolution screen owns local-versus-remote decisions, the Login screen
continues to mark Cloud Backup unavailable.

The online leaderboard service can submit and fetch global scores. Submissions
pass through the client sanity prototype; impossible score, wallet,
score-per-match, titles-per-season and long-sample win-rate combinations are
redirected to `shadow_leaderboard`. This is useful screening groundwork, not a
server-authoritative anti-cheat guarantee.

## Verification Checklist

Before enabling Supabase in a release build:

1. Confirm a new guest creates an anonymous Auth user.
2. Confirm the RPC writes that user's `daily_verifications` row.
3. Confirm offline play succeeds within the verified 24-hour window.
4. Confirm offline play blocks after expiry.
5. Confirm a backward clock change outside tolerance invalidates the cache.
6. Confirm cloud rows can only be read and changed by their owning user.
7. Confirm visible leaderboard writes reject a mismatched `user_id`.
8. Confirm an impossible test submission enters `shadow_leaderboard` and never
   appears in public rankings.

Before claiming Cloud Backup complete, add explicit upload/download conflict
handling and run migration compatibility tests on real saves. Before claiming
Online Leaderboards complete, add the public rankings UI, lifecycle submission
wiring and stronger server-side score validation. Google sign-in remains
separate future product work.
