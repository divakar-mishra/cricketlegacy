import fs from 'fs';
import path from 'path';

describe('Supabase backend integration source', () => {
  it('persists auth sessions and uses anonymous Supabase auth for guest play', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'supabaseClient.ts'), 'utf8');

    expect(source).toContain("require('react-native-url-polyfill/auto')");
    expect(source).toContain('storage: AsyncStorage');
    expect(source).toContain('persistSession: true');
    expect(source).toContain('signInAnonymously');
    expect(source).toContain('currentRecoverableSupabaseUserId');
    expect(source).toContain('supabase.auth.getUser()');
    expect(source).toContain("rpc('record_daily_verification'");
    expect(source).not.toContain('SERVICE_ROLE');
    expect(source).not.toContain('sb_secret');
  });

  it('ships RLS-protected cloud infrastructure and revokes direct economy/ranking writes', () => {
    const baseSql = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'supabase',
        'migrations',
        '202607170001_stabilization_backend.sql',
      ),
      'utf8',
    );
    const hardeningSql = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'supabase',
        'migrations',
        '202608090001_harden_online_writes.sql',
      ),
      'utf8',
    );

    expect(baseSql).toContain('alter table public.daily_verifications enable row level security');
    expect(baseSql).toContain('alter table public.cloud_saves enable row level security');
    expect(baseSql).toContain('alter table public.reward_transactions enable row level security');
    expect(baseSql).toContain('alter table public.leaderboard enable row level security');
    expect(baseSql).toContain('alter table public.shadow_leaderboard enable row level security');
    expect(baseSql).toContain('auth.uid() = user_id');
    expect(hardeningSql).toContain('revoke insert, update on public.leaderboard');
    expect(hardeningSql).toContain('revoke insert on public.reward_transactions');
    expect(hardeningSql).toContain('revoke all on function public.claim_reward_once');
    expect(hardeningSql).toContain('create or replace function public.submit_leaderboard_score');
    expect(hardeningSql).toContain('grant execute on function public.submit_leaderboard_score');
  });
});
