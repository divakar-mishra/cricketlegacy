# Reviewer allowance — implementation, not deployed

This adds a separate complimentary Store action, not a purchase/receipt or
restore grant. Existing RevenueCat VIP/bundle grants remain required.

## Operator setup (requires separate deployment approval)

Apply only `supabase/migrations/202609120001_reviewer_access.sql` to the intended
project after review. The migration enrolls nobody. In the authenticated SQL
editor, enroll the verified dedicated Supabase user UUID with:

```sql
insert into public.reviewer_accounts (user_id, enabled)
values ('REPLACE_WITH_VERIFIED_REVIEWER_UUID'::uuid, true)
on conflict (user_id) do update set enabled = excluded.enabled;
```

No email matching, user-editable metadata, client enrollment or service key in
the app. The RPC checks the live allowlist and authenticated UID on every claim.
Disable the row to revoke future claims. Previously granted save-local supplies
are not clawed back. Deleting the auth account cascades its allowlist row.

## Behavior

The authorized account sees Store → Reviewer access · Free. Player: applies
the normal coaching values (form/confidence minimum 99, normal VIP-aware Focus
cap). Domestic Manager: tops up scout and conditioning inventory to one token
each; consume via Transfers and Medical Centre. Repeat as needed, without
stacking unused tokens or granting currency. Save completion is awaited.
Facility upgrades and transfers retain their ordinary Club Balance routes.
Normal accounts see no button and server authorization denies their requests.
No schema migration for saves is needed: existing inventory and readiness fields
are used. Patched client/save tampering is outside this local game's trust model;
this does not create an authoritative server economy.

## Required verification before Console confirmation

- Deploy/enroll only with owner approval; build/install only with approval.
- Test a fresh device/profile with the actual upload candidate and reviewer login.
- Restore both modes, verify VIP and Legend content.
- Claim Player coaching and Manager supplies; consume both token types in normal UI.
- Verify normal/non-allowlisted login cannot claim; offline fails closed.
- Verify save failure reports retry and retries do not stack supplies.
- Include both Restore Purchases and Reviewer access steps in Console instructions.

Do not mark full access complete based on source tests alone.
