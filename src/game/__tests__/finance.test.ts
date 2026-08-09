import { TEAM_BLUEPRINTS } from '../../content/teams';
import { Player } from '../../domain/types';
import { createManagerSave } from '../createGame';
import {
  boardTargetFor,
  computeValue,
  formatClubCurrency,
  MIN_SQUAD,
  maxSquadSize,
  prizeFor,
  releasePlayer,
  signFreeAgent,
} from '../finance';

const makeSave = () =>
  createManagerSave({ teamId: TEAM_BLUEPRINTS[0].id, difficulty: 'NORMAL', seed: 999 });

describe('computeValue', () => {
  it('rises with overall and falls with age', () => {
    expect(computeValue({ overall: 85, age: 24 } as Player)).toBeGreaterThan(
      computeValue({ overall: 60, age: 24 } as Player),
    );
    expect(computeValue({ overall: 80, age: 24 } as Player)).toBeGreaterThan(
      computeValue({ overall: 80, age: 34 } as Player),
    );
  });
});

describe('formatClubCurrency', () => {
  it('formats manager club money separately from wallet coins and real-money prices', () => {
    expect(formatClubCurrency(49)).toBe('$49');
    expect(formatClubCurrency(49_000)).toBe('$49k');
    expect(formatClubCurrency(500_000)).toBe('$500k');
    expect(formatClubCurrency(12_000_000)).toBe('$12.00m');
    expect(formatClubCurrency(-500_000)).toBe('-$500k');
  });
});

describe('transfers', () => {
  it('signs a free agent: budget down, squad up, removed from market', () => {
    const save = makeSave();
    const team = save.teams[save.userTeamId!];
    const faId = save.freeAgents![0];
    const budget = team.budget;
    const size = team.playerIds.length;

    const r = signFreeAgent(save, faId);
    expect(r.ok).toBe(true);
    expect(team.playerIds).toContain(faId);
    expect(save.freeAgents).not.toContain(faId);
    expect(team.budget).toBe(budget - r.cost);
    expect(team.playerIds.length).toBe(size + 1);
  });

  it('releases a player: budget up, squad down, back on the market', () => {
    const save = makeSave();
    const team = save.teams[save.userTeamId!];
    const id = team.playerIds[team.playerIds.length - 1];
    const budget = team.budget;
    const size = team.playerIds.length;

    const r = releasePlayer(save, id);
    expect(r.ok).toBe(true);
    expect(team.playerIds).not.toContain(id);
    expect(save.freeAgents).toContain(id);
    expect(team.budget).toBe(budget + r.recouped);
    expect(team.playerIds.length).toBe(size - 1);
  });

  it('will not release below the minimum squad size', () => {
    const save = makeSave();
    const team = save.teams[save.userTeamId!];
    while (team.playerIds.length > MIN_SQUAD) {
      releasePlayer(save, team.playerIds[team.playerIds.length - 1]);
    }
    expect(team.playerIds.length).toBe(MIN_SQUAD);
    expect(releasePlayer(save, team.playerIds[0]).ok).toBe(false);
  });

  it('will not sign beyond the maximum squad size', () => {
    const save = makeSave();
    const team = save.teams[save.userTeamId!];
    team.budget = 999_999_999; // remove budget as the limiter
    for (const id of [...(save.freeAgents ?? [])]) {
      if (team.playerIds.length >= maxSquadSize(save)) break;
      signFreeAgent(save, id);
    }
    expect(team.playerIds.length).toBe(maxSquadSize(save));
    const leftover = save.freeAgents![0];
    expect(signFreeAgent(save, leftover).ok).toBe(false);
  });
});

describe('season rewards & board', () => {
  it('prize money decreases with position; board target is stricter for stronger squads', () => {
    expect(prizeFor(1)).toBeGreaterThan(prizeFor(4));
    expect(prizeFor(4)).toBeGreaterThan(prizeFor(8));
    expect(boardTargetFor(70)).toBeLessThan(boardTargetFor(63));
  });
});
