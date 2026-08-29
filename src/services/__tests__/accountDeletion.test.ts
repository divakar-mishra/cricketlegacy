import fs from 'fs';
import path from 'path';

jest.mock('../supabaseClient', () => ({
  currentSupabaseSession: jest.fn(),
  getSupabaseClient: jest.fn(),
  isSupabaseBackendEnabled: jest.fn(() => false),
}));

import { parseAccountDeletionResponse } from '../accountDeletion';

const root = path.join(__dirname, '..', '..', '..');

describe('account deletion boundary', () => {
  it('accepts only a durable success response with an opaque request id', () => {
    const requestId = 'a'.repeat(64);
    expect(parseAccountDeletionResponse({ status: 'deleted', requestId })).toEqual({
      status: 'DELETED',
      requestId,
    });
    expect(parseAccountDeletionResponse({ status: 'deleted', requestId: 'user-id' }).status).toBe(
      'FAILED',
    );
    expect(parseAccountDeletionResponse({ status: 'processing' }).status).toBe('FAILED');
  });

  it('does not send a client-controlled account id to the Edge Function', () => {
    const client = fs.readFileSync(
      path.join(root, 'src', 'services', 'accountDeletion.ts'),
      'utf8',
    );
    const edge = fs.readFileSync(
      path.join(root, 'supabase', 'functions', 'delete-account', 'index.ts'),
      'utf8',
    );
    expect(client).toContain("functions.invoke('delete-account'");
    expect(client).toContain('body: {}');
    expect(client).not.toMatch(/body:\s*\{[^}]*user(Id|_id)/s);
    expect(edge).toContain('userClient.auth.getClaims(token)');
    expect(edge).toContain("'tombstone_premium_sponsor_transactions'");
    expect(edge.indexOf("'tombstone_premium_sponsor_transactions'")).toBeLessThan(
      edge.indexOf('await purgeStorage(service, userId)'),
    );
    expect(edge.indexOf("'tombstone_premium_sponsor_transactions'")).toBeLessThan(
      edge.indexOf('await deleteRevenueCatCustomer(userId, revenueCatDeletion)'),
    );
    expect(edge.indexOf('await deleteRevenueCatCustomer(userId, revenueCatDeletion)')).toBeLessThan(
      edge.indexOf('await purgeStorage(service, userId)'),
    );
    expect(edge.indexOf("'tombstone_premium_sponsor_transactions'")).toBeLessThan(
      edge.indexOf("'purge_user_data_for_account_deletion'"),
    );
    expect(edge).toContain('service.auth.admin.deleteUser(userId, false)');
    expect(edge).toContain('REVENUECAT_CUSTOMER_DELETION_SECRET_API_KEY');
    expect(edge).toContain('v2 customer erasure is server-only');
    expect(edge).toContain('REVENUECAT_ANY_IAP_ENABLED');
    expect(edge).toContain('REVENUECAT_USES_SUPABASE_UUID_IDENTITY');
    expect(edge).toContain('invalid_revenuecat_iap_deletion_contract');
  });

  it('keeps deletion RPCs unavailable to client roles', () => {
    const migration = fs.readFileSync(
      path.join(root, 'supabase', 'migrations', '202608200001_account_deletion.sql'),
      'utf8',
    );
    expect(migration).toContain(
      'revoke all on function public.purge_user_data_for_account_deletion(uuid) from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant execute on function public.purge_user_data_for_account_deletion(uuid) to service_role',
    );
    expect(migration).toContain("request_key ~ '^[a-f0-9]{64}$'");
    expect(migration).toContain('create or replace function public.has_live_auth_session()');
    expect(migration).toContain('leaderboard_live_session_guard');
    expect(migration).toContain('from auth.sessions s');
    const requestTable = migration.match(
      /create table if not exists public\.account_deletion_requests \(([\s\S]*?)\n\);/,
    )?.[1];
    expect(requestTable).toBeDefined();
    expect(requestTable).not.toMatch(/\buser_id\b/);
  });
});
