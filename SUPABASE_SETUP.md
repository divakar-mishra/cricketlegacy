# Supabase Setup

Supabase provides the optional backend foundation for anonymous authentication,
cloud-save slots, public leaderboard rows and hidden leaderboard review rows.
The local single-player game does not require Supabase or an internet connection.

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
EXPO_PUBLIC_LEADERBOARDS_ENABLED=false
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

Leave `EXPO_PUBLIC_SUPABASE_ENABLED=false` until the migration is deployed and
anonymous sign-in is enabled. The app reads these values through
`src/config/supabase.ts`; `app.json` does not contain a second Supabase config.

## Database Migration

Apply the migrations in filename order. The currently checked-in sequence is:

```text
supabase/migrations/202607170001_stabilization_backend.sql
supabase/migrations/202608090001_harden_online_writes.sql
supabase/migrations/202608200001_account_deletion.sql
supabase/migrations/202608200002_premium_save_sponsor_backend.sql
```

It creates:

- `public.daily_verifications`, with Row Level Security restricting each user
  to their own row.
- `public.cloud_saves`, with user-scoped read/write policies.
- `public.reward_transactions`, retained as a private server-owned audit table.
- `public.leaderboard`, publicly readable but not directly writable by clients.
- `public.shadow_leaderboard`, a private destination for implausible uploads.
- `public.submit_leaderboard_score(...)`, an authenticated RPC that validates
  basic limits on the server and routes suspicious submissions for review.
- Direct client writes to reward, leaderboard and review tables are revoked.
- The former generic reward RPC is revoked because client-provided reward
  amounts are not a safe economy authority.

The leaderboard client calls its RPC directly. Account deletion and premium
sponsor fulfillment use authenticated/server-only Edge Functions because the
mobile app must never receive a service-role key.

## Account deletion

The account-deletion migration creates a private, pseudonymous request-status
table and service-role-only purge functions. Deploy `delete-account` only after
the owner selects and documents the retention periods in
`legal-site/legal.config.json`.

Required function secrets:

```text
SUPABASE_SERVICE_ROLE_KEY=server-only service role key
ACCOUNT_DELETION_HMAC_SECRET=random secret with at least 32 characters
ACCOUNT_DELETION_REQUEST_RETENTION_DAYS=legal.config.json deletionRequestAuditDays
PREMIUM_SPONSOR_TRANSACTION_PEPPER=same sponsor-server pepper
ACCOUNT_DELETION_PURCHASE_AUDIT_DAYS=approved purchase-audit retention
```

Add `ACCOUNT_DELETION_STORAGE_BUCKETS` if user-owned files are introduced. The
function validates the bearer JWT, derives the user from its verified `sub`,
purges known rows and configured storage paths, and only then invokes the Auth
admin deletion API. It never accepts a user ID in request JSON. Do not deploy
it with `--no-verify-jwt`.

The migration also guards leaderboard writes by checking the JWT `session_id`
against `auth.sessions`. Supabase access JWTs can remain cryptographically valid
until expiry after an Auth user is deleted; any future sensitive RPC or Storage
policy must also require `public.has_live_auth_session()` so a stale token cannot
recreate data during that window.

Before sponsor purchases are deleted, the function creates expiring,
pepper-HMAC transaction tombstones. These prevent a consumed store transaction
from being rebound after deletion without retaining the user, save, entitlement
or sponsor branding. The purchase-audit days must equal
`legal.config.json` and its transaction pepper must match every sponsor Edge
Function.

`account_deletion_requests` stores only a keyed one-way reference, status,
timestamps and a generic error code. Configure regular invocation of
`prune_expired_account_deletion_requests()` and
`prune_expired_premium_sponsor_transaction_tombstones()` so both approved
retention limits are met even when deletion traffic is sparse.

Applying database migrations alone does **not** activate purchase verification.
The exact-save sponsor Edge Functions provide that server trust boundary, but
release checkout must remain disabled until KYC, store/RevenueCat products,
secrets, webhook verification, deployment and sandbox tests in
`docs/PREMIUM_SAVE_SPONSOR_CHECKOUT.md` are complete.

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
src/services/accountDeletion.ts
```

When enabled and online, Guest play creates or resumes an anonymous Supabase
session. Offline or failed Supabase sign-in falls back to a stable device-local
guest and never blocks the career.

The cloud service can push, pull and list authenticated save slots. Until a
conflict-resolution screen owns local-versus-remote decisions, the Login screen
continues to mark Cloud Backup unavailable.

The online leaderboard remains disabled unless
`EXPO_PUBLIC_LEADERBOARDS_ENABLED=true`. Submissions use the hardened RPC;
clients have no table-write grants. The RPC applies server-side plausibility
limits, but an offline game still requires stronger proof/attestation before a
global ranking should be treated as cheat-proof.

## Verification Checklist

Before enabling Supabase in a release build:

1. Confirm a new guest creates an anonymous Auth user.
2. Confirm the game still launches and creates a local career while offline.
3. Confirm cloud rows can only be read and changed by their owning user.
4. Confirm authenticated clients cannot insert/update `leaderboard` directly.
5. Confirm authenticated clients cannot insert `reward_transactions` directly.
6. Confirm an impossible RPC submission enters `shadow_leaderboard` and never
   appears in public rankings.
7. Confirm the leaderboard service remains empty while its environment flag is false.
8. Confirm account deletion rejects requests without a valid current session.
9. Confirm deletion removes cloud saves, rankings and sponsor bindings before
   the Auth user, then clears the device only after the server confirms success.
10. Confirm a retry is idempotent and expired pseudonymous request rows are pruned.

Before claiming Cloud Backup complete, add explicit upload/download conflict
handling and run migration compatibility tests on real saves. Before claiming
Online Leaderboards complete, add the public rankings UI, lifecycle submission
wiring and stronger server-side score validation. Google sign-in remains
separate future product work.
