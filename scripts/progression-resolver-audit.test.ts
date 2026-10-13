import type { Difficulty, ManagerCareerLevel, Role, SaveGame } from '../src/domain/types';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

// This is an isolated audit: no device save, account, ads or purchase is touched.
jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (callback: () => void) => {
      callback();
      return { cancel: jest.fn() };
    },
  },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('../src/services/vipArchive', () => ({
  syncVipArchive: jest.fn(async () => undefined),
}));
jest.mock('../src/config/qa', () => ({ QA_TOOLS_ENABLED: false }));
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { COUNTRIES } = jest.requireActual<typeof import('../src/data/countries')>(
  '../src/data/countries',
);
const { buildUserPlayer, createCareerSave, createManagerSave } = jest.requireActual<
  typeof import('../src/game/createGame')
>('../src/game/createGame');
const { playerDomesticBlueprints, managerDomesticBlueprints } = jest.requireActual<
  typeof import('../src/game/domesticBranding')
>('../src/game/domesticBranding');
const { resolveNextCareerStep } = jest.requireActual<typeof import('../src/game/careerStep')>(
  '../src/game/careerStep',
);
const { advisorVisitKey, nextPlayerAdvice } = jest.requireActual<
  typeof import('../src/game/playerAdvisor')
>('../src/game/playerAdvisor');
const { nextUserFixtureId, seasonComplete, applyManagerPreparationToLiveMatch } = jest.requireActual<
  typeof import('../src/game/season')
>('../src/game/season');
const { buildManagerSeasonCalendar } = jest.requireActual<
  typeof import('../src/game/managerCalendar')
>('../src/game/managerCalendar');
const { currentPlayerCalendarEvent } = jest.requireActual<
  typeof import('../src/game/playerCalendar')
>('../src/game/playerCalendar');
const { useCareer } = jest.requireActual<typeof import('../src/state/careerStore')>(
  '../src/state/careerStore',
);
const { ECONOMY } = jest.requireActual<typeof import('../src/data/gameConfig')>(
  '../src/data/gameConfig',
);

const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;
const ROLES: Role[] = ['BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD', 'PRO'];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
let auditNow = Date.UTC(2026, 9, 11);

function active(): SaveGame {
  const save = useCareer.getState().save;
  if (!save) throw new Error('Active career vanished.');
  return save;
}

function activate(save: SaveGame) {
  useCareer.getState().setActive(save, save.mode, 1);
  useCareer.setState({ lastPromotion: null });
}

function playerSave(country: string, role: Role, difficulty: Difficulty, age: number, seed: number) {
  const team = playerDomesticBlueprints(country).find(candidate => candidate.tier === 3)!;
  const bats = role !== 'BOWLER';
  const bowls = role === 'BOWLER' || role === 'ALLROUNDER';
  const player = buildUserPlayer({
    name: `${country} ${role} audit`, nationality: country, role, age,
    battingStyle: seed % 2 ? 'RHB' : 'LHB',
    bowlingStyle: role === 'BOWLER' || role === 'ALLROUNDER' ? 'PACE' : undefined,
    // Legal role-visible allocations, with hidden disciplines left at base 35.
    batting: {
      technique: role === 'ALLROUNDER' || role === 'WK_BATTER' ? 55 : bats ? 50 : 35,
      timing: role === 'WK_BATTER' ? 55 : bats ? 50 : 35,
      power: role === 'WK_BATTER' ? 55 : bats ? 50 : 35,
      footwork: role === 'WK_BATTER' ? 55 : bats ? 50 : 35,
      temperament: role === 'WK_BATTER' ? 55 : bats ? 50 : 35,
      running: role === 'WK_BATTER' ? 55 : bats ? 50 : 35,
    },
    bowling: {
      paceOrSpin: role === 'BOWLER' ? 55 : bowls ? 50 : 35,
      accuracy: role === 'BOWLER' ? 55 : bowls ? 50 : 35,
      movement: role === 'BOWLER' ? 55 : bowls ? 50 : 35,
      variations: bowls ? 50 : 35, stamina: bowls ? 50 : 35,
    },
    fielding: { catching: 35, throwing: 35, agility: 35, keeping: role === 'WK_BATTER' ? 85 : 35 },
    meta: { fitness: 50, confidence: 50, aggression: 50, discipline: 50 },
    attrScale: age === 16 ? 0.52 : age < 20 ? 0.74 : 1,
  });
  return createCareerSave({ player, teamId: team.id, difficulty, seed, now: auditNow });
}

function managerSave(country: string, difficulty: Difficulty, seed: number) {
  const team = managerDomesticBlueprints(country).find(candidate => candidate.tier === 3)!;
  return createManagerSave({ country, teamId: team.id, difficulty, seed, now: auditNow });
}

/** Include the gates the old engine-only audit skips: stories, adviser, energy and jobs. */
function progressSignature(save: SaveGame): string {
  return JSON.stringify({
    season: save.currentSeasonId,
    year: save.managerCalendar?.year,
    phase: save.managerCalendar?.phase,
    cursor: save.playerCalendar?.cursor,
    completedEvents: save.playerCalendar?.events.filter(event => event.completed).length,
    played: Object.values(save.fixtures).filter(fixture => fixture.played).map(fixture => fixture.id).sort(),
    story: save.story?.pendingEventIds,
    press: save.managerStory?.pendingEventIds,
    seen: save.story?.seenEventIds,
    pressSeen: save.managerStory?.seenEventIds,
    flags: save.flags,
    energy: save.wallet.energy,
    age: save.userPlayerId ? save.players[save.userPlayerId]?.age : save.managerAge,
    team: save.userTeamId,
    offer: save.managerJobOffer?.teamId,
    promotion: useCareer.getState().lastPromotion,
  });
}

function completeMatch() {
  const started = useCareer.getState().beginLiveMatch();
  if (!started) throw new Error('Resolver offered Play match but beginLiveMatch rejected it.');
  const { live, fixtureId } = started;
  if (live.tossDecision.userCanCall) live.setTossCall('HEADS');
  if (live.tossDecision.userMayChoose) live.setTossChoice('BAT');
  if (active().mode === 'manager') {
    useCareer.getState().setTactics({ batting: 'BALANCED', bowling: 'CONTAIN', field: 'BALANCED' }, fixtureId);
    if (!applyManagerPreparationToLiveMatch(active(), fixtureId, live)) {
      throw new Error('Matchday could not confirm the manager preparation.');
    }
  }
  let guard = 0;
  while (!live.matchDone && guard++ < 20_000) live.nextBall();
  if (!live.matchDone) throw new Error(`Fixture ${fixtureId} did not finish.`);
  const match = live.finalizeMatch();
  const committed = useCareer.getState().commitLiveMatch(match);
  if (!committed) throw new Error(`Fixture ${fixtureId} could not be committed.`);
  expect(active().flags[`resultCount:${fixtureId}`]).toBe(true);
  // Rapid duplicate result callbacks may not consume energy, pay or add caps twice.
  const after = progressSignature(active());
  const wallet = clone(active().wallet);
  expect(useCareer.getState().commitLiveMatch(match)).toBeNull();
  expect(progressSignature(active())).toBe(after);
  expect(active().wallet).toEqual(wallet);
}

function runResolver(save: SaveGame, seasons: number, resume = true, stopAtRollover = false,
  stopWhen?: (current: SaveGame) => boolean) {
  activate(save);
  const initialYear = active().seasons[active().currentSeasonId!].year;
  let actions = 0;
  let rollovers = 0;
  while (rollovers < seasons && actions++ < seasons * 1200) {
    const current = active();
    if (stopWhen?.(current)) return;
    const step = resolveNextCareerStep(current, {
      pendingPromotion: Boolean(useCareer.getState().lastPromotion?.promoted),
    });
    if (stopAtRollover && step.action === 'ADVANCE_SEASON') return;
    const before = progressSignature(current);
    try {
      switch (step.action) {
        case 'ACKNOWLEDGE_PROMOTION': useCareer.getState().clearPromotion(); break;
        case 'OPEN_STORY': {
          const pending = useCareer.getState().pendingStory();
          if (pending) {
            expect(pending.choices.length).toBeGreaterThan(0);
            expect(useCareer.getState().resolveStory(pending.event.id, pending.choices[0].id).ok).toBe(true);
          }
          break;
        }
        case 'OPEN_ADVISER': {
          const advice = nextPlayerAdvice(current, nextUserFixtureId(current));
          if (!advice) throw new Error('Required adviser has no available conversation.');
          // The visible Carry on action, not a purchase or a training bypass.
          useCareer.getState().markFlagSeen(advice.key);
          useCareer.getState().markFlagSeen(advisorVisitKey(current));
          break;
        }
        case 'OPEN_TRAINING':
        case 'RESOLVE_CALENDAR':
          // These are the free Skill work / Study / Attend camp buttons on the hub.
          expect(useCareer.getState().resolvePlayerWeek(
            step.mode === 'career' && step.calendarEvent?.kind === 'EXAM' ? 'STUDY'
              : step.mode === 'career' && step.calendarEvent?.kind === 'NCA_CAMP' ? 'ATTEND' : 'SKILL',
            currentPlayerCalendarEvent(current)!.id, current.id,
          ).ok).toBe(true);
          break;
        case 'REFILL_ENERGY':
          // Exercise genuine elapsed-time recovery with no rewarded ad, gems or IAP.
          auditNow += ECONOMY.energyMax * ECONOMY.energyRegenMinutes * 60_000;
          useCareer.getState().refreshEnergy();
          break;
        case 'PLAY_MATCH': completeMatch(); break;
        case 'SIMULATE_MATCH': {
          const stats = clone(current.players[current.userPlayerId!].careerStats ?? {});
          const energy = current.wallet.energy;
          const outcome = useCareer.getState().advanceWhileBenched();
          expect(outcome.ok).toBe(true);
          expect(outcome.simulated).toBeGreaterThan(0);
          expect(active().wallet.energy).toBe(energy);
          expect(active().players[current.userPlayerId!].careerStats ?? {}).toEqual(stats);
          break;
        }
        case 'ADVANCE_CAREER_CALENDAR': useCareer.getState().advanceSeason(); break;
        case 'ADVANCE_MANAGER_CALENDAR': {
          const result = useCareer.getState().advanceManagerCalendar(12);
          expect(result).not.toBeNull();
          break;
        }
        case 'ADVANCE_SEASON': {
          expect(seasonComplete(current)).toBe(true);
          const year = current.seasons[current.currentSeasonId!].year;
          const age = current.userPlayerId ? current.players[current.userPlayerId].age : current.managerAge;
          useCareer.getState().newSeason();
          expect(active().seasons[active().currentSeasonId!].year).toBe(year + 1);
          const newAge = active().userPlayerId ? active().players[active().userPlayerId!].age : active().managerAge;
          expect(newAge).toBe(age! + 1);
          rollovers++;
          break;
        }
        case 'OPEN_PRESS': {
          const pending = useCareer.getState().pendingPress();
          if (pending) {
            expect(pending.choices.length).toBeGreaterThan(0);
            expect(useCareer.getState().resolvePress(pending.id, pending.choices[0].id).ok).toBe(true);
          }
          break;
        }
        case 'OPEN_JOB_OFFER': useCareer.getState().declineManagerJobOffer(); break;
        case 'OPEN_JOB_SEARCH': {
          const tier = current.userDivision === 1 ? current.divisions?.tier1
            : current.userDivision === 2 ? current.divisions?.tier2 : current.divisions?.tier3;
          const candidate = tier?.find(id => id !== current.userTeamId && current.teams[id]);
          if (!candidate) throw new Error('Sacked manager has no visible eligible appointment.');
          useCareer.getState().takeNewJob(candidate);
          break;
        }
        default: throw new Error(`Unmapped action: ${step.action}`);
      }
      if (progressSignature(active()) === before) throw new Error('Continue made no progress.');
      expect(Number.isFinite(active().wallet.coins)).toBe(true);
      expect(active().wallet.coins).toBeGreaterThanOrEqual(0);
      if (resume && actions % 23 === 0) {
        const currentId = active().id;
        const year = active().seasons[active().currentSeasonId!].year;
        activate(clone(active())); // Serialized save re-entry through the real load hook.
        expect(active().id).toBe(currentId);
        expect(active().seasons[active().currentSeasonId!].year).toBe(year);
      }
    } catch (error) {
      throw new Error(`${save.mode}/${save.id}: action ${actions} ${step.action}; ` +
        `year=${active().seasons[active().currentSeasonId!].year}; ` +
        `level=${active().careerPathLevel ?? active().managerCareerLevel}; ` +
        `phase=${active().managerCalendar?.phase}; cursor=${active().playerCalendar?.cursor}`, { cause: error });
    }
  }
  expect(rollovers).toBe(seasons);
  expect(active().seasons[active().currentSeasonId!].year).toBe(initialYear + seasons);
}

function loanOnlyManagerSave(seed: number) {
  // Reach a genuine completed off-season through the actual Continue flow.
  runResolver(managerSave('india', 'NORMAL', seed), 1, true, true);
  expect(active().managerCalendar?.phase).toBe('OFF_SEASON');
  active().teams[active().userTeamId!].budget = 500_000_000;
  while (active().teams[active().userTeamId!].playerIds.length > 11) {
    expect(useCareer.getState().releasePlayer(active().teams[active().userTeamId!].playerIds[0]).ok).toBe(true);
  }
  const owned = [...active().teams[active().userTeamId!].playerIds];
  const loans = active().freeAgents!.filter(id => !active().players[id].loanedFrom).slice(0, 11);
  expect(loans).toHaveLength(11);
  for (const id of loans) expect(useCareer.getState().loanPlayer(id, 1).ok).toBe(true);
  for (const id of owned) expect(useCareer.getState().releasePlayer(id).ok).toBe(true);
  return { save: clone(active()), loans };
}

jest.setTimeout(180_000);
beforeEach(() => {
  auditNow = Date.UTC(2026, 9, 11);
  jest.spyOn(Date, 'now').mockImplementation(() => auditNow);
  useCareer.setState({
    save: null, ref: null, targetFixtureId: undefined, lastPromotion: null,
    persist: jest.fn(async () => undefined), persistCritical: jest.fn(async () => undefined),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  useCareer.setState({
    save: null, ref: null, targetFixtureId: undefined, lastPromotion: null,
    pendingAchievementIds: [], persistenceError: null,
    persist: originalPersist, persistCritical: originalPersistCritical,
  });
});

describe('whole-app failure-path audit', () => {
  it('the three-fixture squad recovery cooldown carries across a season boundary', () => {
    const playedCount = (save: SaveGame) => Object.values(save.fixtures).filter(fixture =>
      fixture.played && (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId),
    ).length;
    runResolver(managerSave('india', 'NORMAL', 87999), 1, true, true);
    expect(playedCount(active())).toBeGreaterThan(3);
    for (const id of active().teams[active().userTeamId!].playerIds) {
      active().players[id].condition = 40;
      active().players[id].injury = undefined;
    }
    active().inventory = { ...active().inventory, squad_recovery_token: 2 };
    expect(useCareer.getState().applySquadRecovery('token', 'audit:season-end').ok).toBe(true);
    const dayDeadline = active().inventory!.squad_recovery_next_at;
    useCareer.getState().newSeason();
    expect(playedCount(active())).toBe(0);
    runResolver(clone(active()), 1, true, false, save => playedCount(save) >= 3);
    expect(playedCount(active())).toBeGreaterThanOrEqual(3);
    expect(Date.now()).toBeLessThan(dayDeadline);
    for (const id of active().teams[active().userTeamId!].playerIds) {
      active().players[id].condition = 40;
      active().players[id].injury = undefined;
    }
    expect(active().inventory!.squad_recovery_token).toBeGreaterThan(0);
    expect(active().managerCareerLevel).not.toBe('NATIONAL');
    const result = useCareer.getState().applySquadRecovery('token', 'audit:next-year');
    expect({ ok: result.ok, reason: result.reason }).toEqual({ ok: true, reason: undefined });
  });

  it('a home win cannot select an away-win press story', () => {
    const { MANAGER_EVENTS, queueManagerEvent, nextManagerEvent } = jest.requireActual<
      typeof import('../src/game/managerEvents')
    >('../src/game/managerEvents');
    const save = managerSave('india', 'NORMAL', 87998);
    const homeFixture = Object.values(save.fixtures).find(fixture => fixture.homeTeamId === save.userTeamId)!;
    expect(homeFixture).toBeTruthy();
    homeFixture.played = true;
    homeFixture.winnerTeamId = save.userTeamId;
    expect(Object.values(save.fixtures).some(fixture => fixture.played && fixture.awayTeamId === save.userTeamId)).toBe(false);
    save.managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
    const candidates = MANAGER_EVENTS.filter(event =>
      (Array.isArray(event.trigger) ? event.trigger : [event.trigger]).includes('POST_WIN') &&
      (!event.condition || event.condition(save)),
    );
    const priority = Math.max(...candidates.map(event => event.priority ?? 0));
    const pool = candidates.filter(event => (event.priority ?? 0) === priority);
    const index = pool.findIndex(event => event.id === 'press_manager_away_win');
    if (index === -1) return; // Correct future eligibility filtering excludes it.
    const total = pool.reduce((sum, event) => sum + (event.weight ?? 1), 0);
    const point = (pool.slice(0, index).reduce((sum, event) => sum + (event.weight ?? 1), 0)
      + (pool[index].weight ?? 1) / 2) / total;
    expect(queueManagerEvent(save, 'POST_WIN', () => point)).toBe(true);
    expect(nextManagerEvent(save)?.id).not.toBe('press_manager_away_win');
  });

  it('a repeated contract-sign callback cannot pay a second signing bonus', () => {
    const { contractOffer } = jest.requireActual<typeof import('../src/game/career')>('../src/game/career');
    const save = playerSave('india', 'BATTER', 'NORMAL', 22, 88001);
    activate(save);
    active().players[active().userPlayerId!].contract!.yearsLeft = 0;
    const offer = contractOffer(active());
    expect(offer.signingBonus).toBeGreaterThan(0);
    expect(useCareer.getState().signNegotiatedContract(offer).ok).toBe(true);
    const coins = active().wallet.coins;
    useCareer.getState().signNegotiatedContract(offer);
    expect(active().wallet.coins).toBe(coins);
  });

  it('squad recovery does not reduce healthy teammates from 100 to 95 condition', () => {
    activate(managerSave('india', 'NORMAL', 88002));
    const squad = active().teams[active().userTeamId!].playerIds;
    squad.forEach((id, index) => {
      active().players[id].condition = index < 3 ? 40 : 100;
      active().players[id].injury = undefined;
    });
    active().inventory = { ...active().inventory, squad_recovery_token: 1 };
    // Three tired players make this action visible in Medical Centre.
    expect(useCareer.getState().applySquadRecovery('token').ok).toBe(true);
    expect(active().players[squad[3]].condition).toBe(100);
  });

  it('a recovery token is not consumed when all eligible tired players are injured', () => {
    activate(managerSave('india', 'NORMAL', 88003));
    for (const id of active().teams[active().userTeamId!].playerIds) {
      active().players[id].condition = 40;
      active().players[id].injury = { type: 'HAMSTRING', severity: 'STRAIN', matchesOut: 2 };
    }
    active().inventory = { ...active().inventory, squad_recovery_token: 1 };
    const result = useCareer.getState().applySquadRecovery('token');
    expect({ ok: result.ok, tokens: active().inventory!.squad_recovery_token })
      .toEqual({ ok: false, tokens: 1 });
  });

  it('failed gem conversion preserves a reward earned while the save write was pending', async () => {
    activate(playerSave('india', 'BATTER', 'NORMAL', 22, 88004));
    active().wallet.gems = 100;
    const before = active().wallet.coins;
    let rejectWrite!: (error: Error) => void;
    useCareer.setState({ persistCritical: () => new Promise<void>((_, reject) => { rejectWrite = reject; }) });
    const conversion = useCareer.getState().convertPlayerGems(25);
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(useCareer.getState().grantAdReward(100, 'audit:concurrent-reward').ok).toBe(true);
    rejectWrite(new Error('Disk full'));
    expect((await conversion).ok).toBe(false);
    expect(active().wallet.coins).toBe(before + 100);
  });

  it('failed gem conversion cannot replace a newly selected career with the old career', async () => {
    activate(playerSave('india', 'BATTER', 'NORMAL', 22, 88005));
    active().wallet.gems = 100;
    let rejectWrite!: (error: Error) => void;
    useCareer.setState({ persistCritical: () => new Promise<void>((_, reject) => { rejectWrite = reject; }) });
    const conversion = useCareer.getState().convertPlayerGems(25);
    await new Promise<void>(resolve => setImmediate(resolve));
    const other = managerSave('australia', 'NORMAL', 88006);
    useCareer.getState().setActive(other, 'manager', 2);
    rejectWrite(new Error('Disk full'));
    await conversion;
    expect({ id: active().id, mode: active().mode, ref: useCareer.getState().ref })
      .toEqual({ id: other.id, mode: 'manager', ref: { mode: 'manager', slot: 2 } });
  });

  it('failed career import leaves the original active career intact', async () => {
    activate(playerSave('india', 'BATTER', 'NORMAL', 22, 88007));
    const originalId = active().id;
    auditNow += 1;
    const other = playerSave('england', 'BOWLER', 'NORMAL', 22, 88008);
    expect(other.id).not.toBe(originalId);
    useCareer.setState({ persistCritical: jest.fn(async () => { throw new Error('Save slot is occupied.'); }) });
    expect((await useCareer.getState().importCareerBackup(JSON.stringify(other))).ok).toBe(false);
    expect(active().id).toBe(originalId);
  });

  it('national manager press choices do not modify the retained domestic club', () => {
    const { queueManagerEvent, nextManagerEvent } = jest.requireActual<typeof import('../src/game/managerEvents')>('../src/game/managerEvents');
    const save = managerSave('india', 'NORMAL', 88009);
    save.managerCareerLevel = 'NATIONAL';
    buildManagerSeasonCalendar(save, 2026);
    activate(save);
    active().managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: [] };
    expect(queueManagerEvent(active(), 'POST_WIN', () => 0)).toBe(true);
    const event = nextManagerEvent(active())!;
    expect(event).not.toBeNull();
    const clubId = active().userTeamId!;
    expect(active().managerNationalTeamId).toBeTruthy();
    expect(active().managerNationalTeamId).not.toBe(clubId);
    const clubMorale = () => active().teams[clubId].playerIds
      .map(id => ({ id, morale: active().players[id].morale ?? 70 }));
    const before = clubMorale();
    expect(useCareer.getState().resolvePress(event.id, event.choices[0].id).ok).toBe(true);
    expect(clubMorale()).toEqual(before);
  });

  it('claiming the same daily reward twice preserves the first credited balance', () => {
    activate(playerSave('india', 'BATTER', 'NORMAL', 22, 88010));
    active().lastDailyClaim = undefined;
    expect(useCareer.getState().claimDaily().ok).toBe(true);
    const wallet = clone(active().wallet);
    expect(useCareer.getState().claimDaily().ok).toBe(false);
    expect(active().wallet).toEqual(wallet);
  });

  it('duplicate ad completion cannot credit the reward twice', () => {
    activate(managerSave('india', 'NORMAL', 88011));
    const club = active().teams[active().userTeamId!].budget;
    expect(useCareer.getState().grantAdReward(100, 'audit:ad').ok).toBe(true);
    const wallet = clone(active().wallet);
    expect(useCareer.getState().grantAdReward(100, 'audit:ad').ok).toBe(false);
    expect(active().wallet).toEqual(wallet);
    expect(active().teams[active().userTeamId!].budget).toBe(club);
  });

  it('portfolio buy and partial/full sell preserve wallet value without a season change', () => {
    const { STOCK_COMPANIES } = jest.requireActual<typeof import('../src/data/stockCompanies')>('../src/data/stockCompanies');
    activate(playerSave('india', 'BATTER', 'NORMAL', 22, 88012));
    active().wallet.coins = 100_000;
    const id = STOCK_COMPANIES[0].id;
    expect(useCareer.getState().investStocksAction(id, 10_000).ok).toBe(true);
    expect(useCareer.getState().withdrawStocksAction(id, 3_000).ok).toBe(true);
    expect(useCareer.getState().withdrawStocksAction(id).ok).toBe(true);
    expect(active().wallet.coins).toBe(100_000);
    expect(useCareer.getState().withdrawStocksAction(id).ok).toBe(false);
    expect(active().wallet.coins).toBe(100_000);
  });

  it('a capped training focus never charges coins for zero improvement', async () => {
    activate(playerSave('india', 'BATTER', 'NORMAL', 22, 88013));
    const player = active().players[active().userPlayerId!];
    Object.keys(player.batting).forEach(key => { (player.batting as unknown as Record<string, number>)[key] = 99; });
    active().wallet.coins = 100_000;
    expect((await useCareer.getState().train('batting')).ok).toBe(false);
    expect(active().wallet.coins).toBe(100_000);
  });
});

describe('resolver-led no-spend progression audit', () => {
  it.each(COUNTRIES.map((country, i) => [country.id, i] as const))(
    'continues both careers in %s, including serialized save re-entry', (country, index) => {
      const difficulty = DIFFICULTIES[index % DIFFICULTIES.length];
      runResolver(playerSave(country, ROLES[index % ROLES.length], difficulty, 16, 9100 + index), 1);
      runResolver(managerSave(country, difficulty, 9200 + index), 1);
    },
  );

  it.each(ROLES.flatMap((role, i) => DIFFICULTIES.map((difficulty, j) => [role, difficulty, i * 4 + j] as const)))(
    'continues %s / %s through five youth and senior years without spending', (role, difficulty, index) => {
      runResolver(playerSave('india', role, difficulty, 16, 9300 + index), 5);
    },
  );

  it.each(ROLES.map((role, i) => [role, i] as const))(
    'does not trap a zero-wallet injured or low-form senior %s', (role, index) => {
      const save = playerSave('india', role, DIFFICULTIES[index], 21, 9400 + index);
      save.wallet.coins = 0;
      save.wallet.gems = 0;
      save.wallet.energy = 0;
      save.players[save.userPlayerId!].meta.form = 0;
      save.players[save.userPlayerId!].injury = { type: 'Audit recovery', severity: 'SERIOUS', matchesOut: 8 };
      runResolver(save, 2);
    },
  );

  it.each(['CLUB', 'STATE', 'ELITE', 'NATIONAL'] as ManagerCareerLevel[])(
    'continues %s manager phases without paid recovery or transfers', level => {
      const save = managerSave('england', 'PRO', 9500);
      save.managerCareerLevel = level;
      buildManagerSeasonCalendar(save, 2026);
      save.wallet.coins = 0;
      save.wallet.gems = 0;
      runResolver(save, 2);
    },
  );
});

describe('negative progression audit', () => {
  it('continues after accepting an eligible manager appointment and reloading', () => {
    const save = managerSave('india', 'PRO', 9599);
    const teamId = save.divisions!.tier3!.find(id => id !== save.userTeamId)!;
    save.managerJobOffer = {
      teamId, clubName: save.teams[teamId].name,
      reputation: save.teams[teamId].reputation,
      salaryPromise: 1_000_000, reason: 'Audit appointment',
    };
    activate(save);
    expect(useCareer.getState().acceptManagerJobOffer().ok).toBe(true);
    expect(active().userTeamId).toBe(teamId);
    runResolver(clone(active()), 2);
  });

  it('survives ten manager years without transfers, renewals, recovery purchases or ads', () => {
    const save = managerSave('india', 'PRO', 9600);
    save.wallet.coins = 0;
    save.wallet.gems = 0;
    save.teams[save.userTeamId!].budget = 0;
    runResolver(save, 10);
  });

  it('continues with an injured minimum squad and a stale duplicate XI after reload', () => {
    const save = managerSave('india', 'HARD', 9601);
    activate(save);
    while (active().teams[active().userTeamId!].playerIds.length > 11) {
      const id = active().teams[active().userTeamId!].playerIds[0];
      expect(useCareer.getState().releasePlayer(id).ok).toBe(true);
    }
    const team = active().teams[active().userTeamId!];
    expect(useCareer.getState().releasePlayer(team.playerIds[0]).ok).toBe(false);
    team.xi = Array(11).fill(team.playerIds[0]);
    team.budget = 0;
    for (const id of team.playerIds) {
      active().players[id].condition = 0;
      active().players[id].injury = { type: 'Audit recovery', severity: 'SERIOUS', matchesOut: 4 };
    }
    runResolver(clone(active()), 2);
  });

  it('continues a State match with an injured minimum squad and no paid recovery', () => {
    const save = managerSave('india', 'PRO', 9610);
    save.managerCareerLevel = 'STATE';
    activate(save);
    while (active().teams[active().userTeamId!].playerIds.length > 11) {
      expect(useCareer.getState().releasePlayer(active().teams[active().userTeamId!].playerIds[0]).ok).toBe(true);
    }
    for (const id of active().teams[active().userTeamId!].playerIds) {
      active().players[id].injury = { type: 'Audit recovery', severity: 'SERIOUS', matchesOut: 4 };
      active().players[id].condition = 0;
    }
    active().wallet.coins = 0;
    active().wallet.gems = 0;
    runResolver(clone(active()), 1);
  });

  it('does not let a stale weekly-choice callback complete a different calendar event', () => {
    const save = playerSave('india', 'BATTER', 'NORMAL', 21, 9611);
    const calendar = save.playerCalendar!;
    const index = calendar.events.findIndex((event, i) =>
      event.kind !== 'MATCH' && calendar.events[i + 1] && calendar.events[i + 1].kind !== 'MATCH',
    );
    expect(index).toBeGreaterThanOrEqual(0);
    for (const event of calendar.events.slice(0, index)) {
      event.completed = true;
      if (event.fixtureId) save.fixtures[event.fixtureId].played = true;
    }
    calendar.cursor = index;
    activate(save);
    const originalId = currentPlayerCalendarEvent(active())!.id;
    expect(useCareer.getState().resolvePlayerWeek('SKILL', originalId, save.id).ok).toBe(true);
    const nextId = currentPlayerCalendarEvent(active())!.id;
    expect(nextId).not.toBe(originalId);
    useCareer.getState().resolvePlayerWeek('SKILL', originalId, save.id); // Same rendered button's callback.
    expect(currentPlayerCalendarEvent(active())?.id).toBe(nextId);
  });

  it('recovers orphaned player story and manager press IDs without losing the career', () => {
    const player = playerSave('india', 'WK_BATTER', 'PRO', 21, 9602);
    player.story = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: ['removed-audit-story'] };
    runResolver(player, 1);
    const manager = managerSave('india', 'PRO', 9603);
    manager.managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: ['removed-audit-press'] };
    runResolver(manager, 1);
  });

  it('continues after a serialized sacking and a new appointment', () => {
    const save = managerSave('india', 'PRO', 9604);
    save.flags.sacked = true;
    save.boardConfidence = 0;
    runResolver(clone(save), 2);
  });

  it('does not apply a player story choice twice through a stale callback', () => {
    const save = playerSave('india', 'BATTER', 'NORMAL', 21, 9605);
    save.story = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: ['career_start'] };
    activate(save);
    expect(useCareer.getState().resolveStory('career_start', 'work').ok).toBe(true);
    const after = clone(active());
    const discipline = active().players[active().userPlayerId!].meta.discipline;
    const duplicate = useCareer.getState().resolveStory('career_start', 'work');
    expect(active().players[active().userPlayerId!].meta.discipline).toBe(discipline);
    expect(duplicate.ok).toBe(false);
    expect(active()).toEqual(after);
  });

  it('does not apply a manager press choice twice through a stale callback', () => {
    const save = managerSave('india', 'NORMAL', 9606);
    save.boardConfidence = 50;
    save.managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: ['m_unveiling'] };
    activate(save);
    expect(useCareer.getState().resolvePress('m_unveiling', 'promise').ok).toBe(true);
    const after = clone(active());
    const confidence = active().boardConfidence;
    const duplicate = useCareer.getState().resolvePress('m_unveiling', 'promise');
    expect(active().boardConfidence).toBe(confidence);
    expect(duplicate.ok).toBe(false);
    expect(active()).toEqual(after);
  });

  it('does not permit loan returns to leave a manager with no players for the next match', () => {
    const { save, loans } = loanOnlyManagerSave(9607);
    activate(save);
    // Club Office exposes Renew 2yr even for borrowed players. It extends the
    // contract but retains the one-year loan and its visible Recall action.
    for (const id of loans) {
      expect(useCareer.getState().renewDeal(id, 2).ok).toBe(false);
      // Reproduce already-corrupted saves made by the previous build as well.
      active().players[id].contract!.yearsLeft = 3;
    }
    useCareer.getState().newSeason();
    // Rollover adds replacement players, but Release and Recall remain visible
    // during the new season. Keep the renewed loans, release the replacements,
    // then return the loans while matches are still pending.
    const team = active().teams[active().userTeamId!];
    expect(loans.every(id => team.playerIds.includes(id))).toBe(true);
    for (const id of [...team.playerIds].filter(id => !loans.includes(id))) {
      expect(useCareer.getState().releasePlayer(id).ok).toBe(true);
    }
    for (const id of loans) useCareer.getState().recallLoan(id);
    const depleted = active().teams[active().userTeamId!].playerIds.length;
    try {
      runResolver(clone(active()), 1);
    } catch (error) {
      throw new Error(`Loan/Release/Recall left ${depleted} players and blocked continuation.`, { cause: error });
    }
    expect(depleted).toBeGreaterThanOrEqual(11);
  });

  it('does not strand a loan-only squad when the loans expire automatically', () => {
    const { save } = loanOnlyManagerSave(9608);
    // No manual Recall: the next rollover should retain a playable team or
    // expose a safe recovery route when all eleven one-year loans expire.
    runResolver(save, 2);
  });
});
