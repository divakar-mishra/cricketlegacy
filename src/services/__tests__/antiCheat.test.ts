import { leaderboardSanityCheck } from '../antiCheat';

describe('leaderboardSanityCheck', () => {
  it('allows plausible early-career scores', () => {
    expect(
      leaderboardSanityCheck({
        scoreType: 'career_runs',
        score: 640,
        seasonsCompleted: 1,
        walletCoins: 2_000,
        matchesPlayed: 12,
        wins: 7,
      }).severity,
    ).toBe('clean');
  });

  it('shadowbans impossible season-one uploads', () => {
    const verdict = leaderboardSanityCheck({
      scoreType: 'career_runs',
      score: 25_000,
      seasonsCompleted: 1,
      walletCoins: 500_000_000,
      walletGems: 100_000,
      matchesPlayed: 30,
      wins: 30,
    });

    expect(verdict.severity).toBe('shadowban');
    expect(verdict.reasons).toContain('season_one_coin_balance_impossible');
  });

  it('shadows impossible score-per-match uploads', () => {
    const verdict = leaderboardSanityCheck({
      scoreType: 'career_wickets',
      score: 121,
      seasonsCompleted: 2,
      matchesPlayed: 10,
      wins: 6,
    });

    expect(verdict.severity).toBe('shadowban');
    expect(verdict.reasons).toContain('score_above_match_limit:10');
  });

  it('shadows suspicious long-sample win rates', () => {
    const verdict = leaderboardSanityCheck({
      scoreType: 'gamerscore',
      score: 12_000,
      seasonsCompleted: 4,
      matchesPlayed: 50,
      wins: 50,
      losses: 0,
      ties: 0,
    });

    expect(verdict.severity).toBe('shadowban');
    expect(verdict.reasons).toContain('suspicious_near_perfect_win_rate');
  });

  it('shadows manager titles that exceed completed seasons', () => {
    const verdict = leaderboardSanityCheck({
      scoreType: 'manager_titles',
      score: 8,
      seasonsCompleted: 3,
      matchesPlayed: 40,
      wins: 24,
    });

    expect(verdict.severity).toBe('shadowban');
    expect(verdict.reasons).toContain('manager_titles_above_seasons_impossible');
  });
});
