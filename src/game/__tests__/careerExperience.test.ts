import { MatchState } from '../../domain/types';
import {
  buildMatchImpactSummary,
  captureExperienceSnapshot,
  describeMatchup,
  ensureCareerExperience,
  managerIdentityLine,
  playerIdentityLine,
  playerOfMatchExplanation,
} from '../careerExperience';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

function match(playerId: string, teamId: string, opponentId: string): MatchState {
  return {
    id: 'experience-match',
    seed: 42,
    format: 'T20',
    conditions: { pitch: 'GREEN', weather: 'OVERCAST' },
    homeTeamId: teamId,
    awayTeamId: opponentId,
    innings: [
      {
        battingTeamId: teamId,
        bowlingTeamId: opponentId,
        runs: 164,
        wickets: 6,
        overs: 20,
        balls: 120,
        events: [],
        batting: [
          {
            playerId,
            runs: 78,
            balls: 49,
            fours: 8,
            sixes: 2,
            out: true,
            battedOrder: 1,
          },
        ],
        bowling: [],
      },
      {
        battingTeamId: opponentId,
        bowlingTeamId: teamId,
        runs: 151,
        wickets: 9,
        overs: 20,
        balls: 120,
        events: [],
        batting: [],
        bowling: [],
        target: 165,
      },
    ],
    result: { winnerTeamId: teamId, margin: '13 runs', playerOfMatchId: playerId },
  };
}

describe('career experience layer', () => {
  it('preserves a chosen archetype and creates deterministic supporting identities', () => {
    const save = makeCareerSave();
    save.experience = { playerArchetype: 'COMEBACK' };

    const first = ensureCareerExperience(save);
    const second = ensureCareerExperience(save);

    expect(first.playerArchetype).toBe('COMEBACK');
    expect(first.coachPersonality).toBeDefined();
    expect(second).toEqual(first);
    expect(playerIdentityLine(save)).toContain('Comeback Story');
  });

  it('gives Manager Career a separate club and philosophy identity', () => {
    const save = makeManagerSave();
    const identity = managerIdentityLine(save);

    expect(save.experience?.clubCulture).toBeDefined();
    expect(save.experience?.managerPhilosophy).toBeDefined();
    expect(identity).toContain(' | ');
  });

  it('explains a live matchup from player strength, form, pitch and chase pressure', () => {
    const save = makeCareerSave();
    const batter = save.players[save.userPlayerId!];
    const bowler = Object.values(save.players).find((player) => player.id !== batter.id)!;
    batter.overall = 90;
    batter.meta.form = 90;
    bowler.overall = 45;
    bowler.meta.form = 45;

    const insight = describeMatchup(batter, bowler, { pitch: 'GREEN', weather: 'OVERCAST' }, 11);

    expect(insight?.edge).toBe('BATTER');
    expect(insight?.detail).toContain('green surface');
    expect(insight?.detail).toContain('Chase pressure');
  });

  it('records visible post-match deltas and explains Player of the Match', () => {
    const save = makeCareerSave();
    const playerId = save.userPlayerId!;
    const teamId = save.userTeamId!;
    const opponentId = Object.keys(save.teams).find((id) => id !== teamId)!;
    const played = match(playerId, teamId, opponentId);
    const before = captureExperienceSnapshot(save);
    save.wallet.coins += 250;
    save.players[playerId].meta.form += 4;
    save.tactics = { batting: 'AGGRESSIVE', bowling: 'ATTACK', field: 'CATCHING' };
    save.experience!.pendingTeamTalk = {
      tone: 'FIRE_UP',
      formDelta: 5,
      volatility: 0.4,
      result: 'The speech landed.',
    };

    const summary = buildMatchImpactSummary(
      save,
      played,
      before,
      { won: true, tie: false, selected: true, rating: 8.2 },
      123,
    );

    expect(summary.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Coins', delta: 250 }),
        expect.objectContaining({ label: 'Form', delta: 4 }),
      ]),
    );
    expect(summary.why).toContain('Your match rating was 8.2.');
    expect(summary.playerOfMatchReason).toContain('78 runs');
    expect(summary.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ decision: 'Fire Them Up', confidence: 'OBSERVED' }),
        expect.objectContaining({ decision: 'Aggressive batting', confidence: 'ESTIMATED' }),
      ]),
    );
    expect(save.experience?.pendingTeamTalk).toBeUndefined();
    expect(playerOfMatchExplanation(played, (id) => save.players[id]?.name ?? id)).toContain(
      'strike rate',
    );
  });
});
