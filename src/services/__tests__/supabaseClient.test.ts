import fs from 'fs';
import path from 'path';

describe('Supabase backend integration source', () => {
  it('persists auth sessions and uses anonymous Supabase auth for guest play', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'supabaseClient.ts'), 'utf8');

    expect(source).toContain("require('react-native-url-polyfill/auto')");
    expect(source).toContain('storage: AsyncStorage');
    expect(source).toContain('persistSession: true');
    expect(source).toContain('signInAnonymously');
    expect(source).toContain("rpc('record_daily_verification'");
    expect(source).not.toContain('SERVICE_ROLE');
    expect(source).not.toContain('sb_secret');
  });

  it('ships Supabase SQL with RLS and idempotent reward transactions', () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '202607170001_stabilization_backend.sql'),
      'utf8',
    );

    expect(sql).toContain('alter table public.daily_verifications enable row level security');
    expect(sql).toContain('alter table public.cloud_saves enable row level security');
    expect(sql).toContain('alter table public.reward_transactions enable row level security');
    expect(sql).toContain('auth.uid() = user_id');
    expect(sql).toContain('primary key (user_id, transaction_id)');
    expect(sql).toContain('on conflict (user_id, transaction_id) do nothing');
    expect(sql).toContain('grant execute on function public.record_daily_verification');
  });

  it('keeps the Edge Function behind Supabase JWT verification', () => {
    const config = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'config.toml'), 'utf8');
    const fn = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'supabase', 'functions', 'daily-verification', 'index.ts'),
      'utf8',
    );

    expect(config).toContain('[functions.daily-verification]');
    expect(config).toContain('verify_jwt = true');
    expect(fn).toContain("req.headers.get('Authorization')");
    expect(fn).toContain("rpc('record_daily_verification'");
  });
});
