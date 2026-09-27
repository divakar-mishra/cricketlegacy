import { PRESS_APPEARANCE_GAP } from '../careerEvents';
import { advisorVisitKey, nextPlayerAdvice } from '../playerAdvisor';
import { emptyStats } from '../stats';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('free player career adviser', () => {
  it('prioritizes an injury without charging or mutating the save', () => {
    const save = makeCareerSave();
    const player = save.players[save.userPlayerId!];
    player.injury = { type: 'Hamstring strain', severity: 'STRAIN', matchesOut: 2 };
    const coins = save.wallet.coins;
    const advice = nextPlayerAdvice(save, 'upcoming-fixture');
    expect(advice?.kind).toBe('INJURY');
    expect(advice?.message).toContain('Resting is free');
    expect(save.wallet.coins).toBe(coins);
    expect(player.injury.matchesOut).toBe(2);
  });

  it('offers analysis for a form slump with an upcoming fixture', () => {
    const save = makeCareerSave();
    const player = save.players[save.userPlayerId!];
    player.meta.form = 39;
    const advice = nextPlayerAdvice(save, 'upcoming-fixture');
    expect(advice?.kind).toBe('ANALYST');
  });

  it('can suggest an unlocked Portfolio, but never invests automatically', () => {
    const save = makeCareerSave();
    const player = save.players[save.userPlayerId!];
    player.age = 22;
    save.careerPathLevel = 'DOMESTIC';
    save.wallet.coins = 20_000;
    save.playerLife = { ...save.playerLife!, personalCoaches: {
      BATTING: { discipline: 'BATTING', hiredYear: 2026, seasonsRemaining: 1 },
    } };
    save.flags = { ...(save.flags ?? {}), [`advisor:coach:${save.currentSeasonId ?? 'season'}`]: true };
    const advice = nextPlayerAdvice(save);
    expect(advice?.kind).toBe('INVEST');
    expect(save.stockPortfolio?.holdings ?? {}).toEqual({});
  });

  it('honors accept/decline flags for a topic and the current appearance', () => {
    const save = makeCareerSave();
    const player = save.players[save.userPlayerId!];
    player.injury = { type: 'Knock', severity: 'KNOCK', matchesOut: 1 };
    const first = nextPlayerAdvice(save)!;
    save.flags = { ...(save.flags ?? {}), [first.key]: true, [advisorVisitKey(save)]: true };
    expect(nextPlayerAdvice(save)).toBeUndefined();
    player.careerStats = { ...emptyStats(), matches: 1 };
    expect(nextPlayerAdvice(save)?.kind).not.toBe('INJURY');
  });

  it('never appears in Manager Career', () => {
    expect(nextPlayerAdvice(makeManagerSave())).toBeUndefined();
  });

  it('does not queue generic introductions or another money tip after every appearance', () => {
    const save = makeCareerSave();
    const player = save.players[save.userPlayerId!];
    player.meta.form = 99;
    player.meta.confidence = 99;
    save.wallet.coins = 100_000;
    expect(nextPlayerAdvice(save, 'fixture')?.kind).toBe('COACH');
    const first = nextPlayerAdvice(save, 'fixture')!;
    save.flags = { ...(save.flags ?? {}), [first.key]: true, [advisorVisitKey(save)]: true };
    for (let appearance = 1; appearance < PRESS_APPEARANCE_GAP; appearance += 1) {
      player.careerStats = { ...emptyStats(), matches: appearance };
      expect(nextPlayerAdvice(save, 'fixture')).toBeUndefined();
    }
    player.careerStats = { ...emptyStats(), matches: PRESS_APPEARANCE_GAP };
    expect(nextPlayerAdvice(save, 'fixture')?.kind).toBe('INVEST');
    expect(save.wallet.coins).toBe(100_000);
  });

  it('allows a fresh injury to interrupt the usual advice gap', () => {
    const save = makeCareerSave();
    const player = save.players[save.userPlayerId!];
    save.flags = { ...(save.flags ?? {}), [advisorVisitKey(save)]: true };
    player.injury = { type: 'Hamstring strain', severity: 'STRAIN', matchesOut: 2 };
    expect(nextPlayerAdvice(save, 'fixture')?.kind).toBe('INJURY');
  });
});
