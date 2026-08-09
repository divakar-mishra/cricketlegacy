import {
  executeManagerResourceAction,
  MANAGER_ELITE_STAFF_SEARCH_GEMS,
  MANAGER_EMERGENCY_TEAM_TALK_COINS,
  MANAGER_FAST_TRACK_SCOUT_COINS,
  MANAGER_MATCH_ANALYSIS_COINS,
} from '../managerResources';
import { ensureNationalTeam } from '../intlCalendar';
import { buildManagerSeasonCalendar } from '../managerCalendar';
import { buildOppositionReport } from '../oppositionAnalysis';
import { nextUserFixtureId } from '../season';
import { makeManagerSave } from './_depthHelpers';

describe('Manager wallet resource desk', () => {
  it('spends coins once per fixture and applies a small visible XI preparation effect', () => {
    const save = makeManagerSave();
    save.wallet.coins = 5_000;
    const team = save.teams[save.userTeamId!];
    const player = save.players[(team.xi?.length ? team.xi : team.playerIds)[0]];
    const formBefore = player.meta.form;
    const moraleBefore = player.morale ?? 70;
    const report = buildOppositionReport(save, nextUserFixtureId(save))!;

    const first = executeManagerResourceAction(save, 'MATCH_ANALYSIS', 100);
    const second = executeManagerResourceAction(save, 'MATCH_ANALYSIS', 101);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(save.wallet.coins).toBe(5_000 - MANAGER_MATCH_ANALYSIS_COINS);
    expect(player.meta.form).toBe(Math.min(99, formBefore + 2));
    expect(player.morale).toBe(Math.min(100, moraleBefore + 1));
    expect(first.detail).toContain(report.topBatter.name);
    expect(first.detail).toContain(report.topBowler.name);
    expect(first.detail).toContain('Recommended plan');
    expect(save.managerResources?.transactions).toHaveLength(1);
  });

  it('spends gems once per season and adds stronger budget-gated staff candidates', () => {
    const save = makeManagerSave();
    save.wallet.gems = 100;
    const beforeIds = new Set((save.staffCandidates ?? []).map((candidate) => candidate.id));

    const first = executeManagerResourceAction(save, 'ELITE_STAFF_SEARCH', 200);
    const second = executeManagerResourceAction(save, 'ELITE_STAFF_SEARCH', 201);
    const added = (save.staffCandidates ?? []).filter((candidate) => !beforeIds.has(candidate.id));

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(save.wallet.gems).toBe(100 - MANAGER_ELITE_STAFF_SEARCH_GEMS);
    expect(added).toHaveLength(3);
    expect(added.every((candidate) => candidate.quality >= 68)).toBe(true);
    expect(save.managerResources?.transactions).toHaveLength(1);
  });

  it('lifts exactly the three lowest-morale players before a match', () => {
    const save = makeManagerSave();
    save.wallet.coins = 20_000;
    const team = save.teams[save.userTeamId!];
    team.playerIds.forEach((playerId, index) => {
      save.players[playerId].morale = 20 + index;
    });
    const lowest = team.playerIds.slice(0, 3);

    const result = executeManagerResourceAction(save, 'EMERGENCY_TEAM_TALK', 300);

    expect(result.ok).toBe(true);
    expect(result.affectedPlayerIds).toEqual(lowest);
    expect(lowest.map((playerId) => save.players[playerId].morale)).toEqual([25, 26, 27]);
    expect(save.players[team.playerIds[3]].morale).toBe(23);
    expect(save.wallet.coins).toBe(20_000 - MANAGER_EMERGENCY_TEAM_TALK_COINS);
    expect(executeManagerResourceAction(save, 'EMERGENCY_TEAM_TALK', 301).ok).toBe(false);
  });

  it('adds 25 Scout Confidence points to one report once per season', () => {
    const save = makeManagerSave();
    save.wallet.coins = 20_000;
    const targetId = save.freeAgents![0];
    const target = save.players[targetId];
    save.scoutReports = [
      {
        playerId: targetId,
        knownOverall: Math.max(1, target.overall - 10),
        uncertainty: 0.6,
        scoutedYear: 2026,
        recommended: false,
      },
    ];

    const result = executeManagerResourceAction(save, 'FAST_TRACK_SCOUT', targetId, 400);

    expect(result.ok).toBe(true);
    expect(save.scoutReports![0].uncertainty).toBeCloseTo(0.35);
    expect(save.wallet.coins).toBe(20_000 - MANAGER_FAST_TRACK_SCOUT_COINS);
    expect(executeManagerResourceAction(save, 'FAST_TRACK_SCOUT', targetId, 401).ok).toBe(false);
  });

  it('applies matchday services to the national XI for a national head coach', () => {
    const save = makeManagerSave();
    save.managerCareerLevel = 'NATIONAL';
    save.managerNationalTeamId = ensureNationalTeam(save, 'india');
    buildManagerSeasonCalendar(save, 2026);
    save.wallet.coins = 5_000;

    const national = save.teams[save.managerNationalTeamId];
    const nationalPlayer =
      save.players[(national.xi?.length ? national.xi : national.playerIds)[0]];
    const nonNationalPlayerId = Object.keys(save.players).find(
      (playerId) => !national.playerIds.includes(playerId),
    )!;
    const clubPlayer = save.players[nonNationalPlayerId];
    const nationalFormBefore = nationalPlayer.meta.form;
    const clubFormBefore = clubPlayer.meta.form;

    const result = executeManagerResourceAction(save, 'MATCH_ANALYSIS', 500);

    expect(result.ok).toBe(true);
    expect(nationalPlayer.meta.form).toBe(Math.min(99, nationalFormBefore + 2));
    expect(clubPlayer.meta.form).toBe(clubFormBefore);
  });
});
