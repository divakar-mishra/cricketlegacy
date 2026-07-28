import fs from 'fs';
import path from 'path';

describe('Supabase configuration', () => {
  it('uses public Expo env variables and never references backend secret keys', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'supabase.ts'), 'utf8');
    const envExample = fs.readFileSync(path.join(__dirname, '..', '..', '..', '.env.example'), 'utf8');
    const leaderboardSource = fs.readFileSync(
      path.join(__dirname, '..', '..', 'services', 'onlineLeaderboard.ts'),
      'utf8',
    );

    expect(source).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(source).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    expect(source).toContain('EXPO_PUBLIC_SUPABASE_ENABLED');
    expect(source).not.toContain('SERVICE_ROLE');
    expect(source).not.toContain('sb_secret');
    expect(envExample).toContain('EXPO_PUBLIC_SUPABASE_ENABLED=false');
    expect(leaderboardSource).toContain('SUPABASE_CONFIG.enabled');
    expect(leaderboardSource).toContain('getSupabaseClient');
  });
});
