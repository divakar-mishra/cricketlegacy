import type { SaveGame } from '../../domain/types';

jest.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (callback: () => void) => { callback(); return { cancel: jest.fn() }; },
  },
  Platform: { OS: 'android', select: (values: Record<string, unknown>) => values.android },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('../../services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => {}) }));
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { makeCareerSave, makeManagerSave } = jest.requireActual<
  typeof import('../../game/__tests__/_depthHelpers')
>('../../game/__tests__/_depthHelpers');
const { buildPlayerSeasonCalendar, currentPlayerCalendarEvent, resolvePlayerCalendarEvent } =
  jest.requireActual<typeof import('../../game/playerCalendar')>('../../game/playerCalendar');
const { buildManagerSeasonCalendar } = jest.requireActual<
  typeof import('../../game/managerCalendar')
>('../../game/managerCalendar');
const { resolveNextCareerStep } = jest.requireActual<typeof import('../../game/careerStep')>(
  '../../game/careerStep',
);
const { nextUserFixtureId, seasonComplete, ensurePlayoffs } = jest.requireActual<
  typeof import('../../game/season')
>('../../game/season');
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');

const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function activate(save: SaveGame) {
  useCareer.setState({
    save, ref: { mode: save.mode, slot: 1 }, lastPromotion: null,
    persist: jest.fn(async () => undefined), persistCritical: jest.fn(async () => undefined),
  });
}

function exhaustedPlayerCalendar(month: number) {
  const save = makeCareerSave(8_300 + month);
  save.careerPathLevel = 'DOMESTIC';
  save.players[save.userPlayerId!].age = 21;
  save.wallet.coins = 0;
  save.wallet.gems = 0;
  save.wallet.energy = 0;
  if (save.story) {
    save.story.pendingEventIds = [];
    save.story.seenEventIds.push('career_start');
  }
  nextUserFixtureId(save); // Populate all three domestic competitions first.
  const pendingAI = Object.values(save.fixtures).find(fixture =>
    fixture.competitionId === 't20-league' &&
    fixture.homeTeamId !== save.userTeamId && fixture.awayTeamId !== save.userTeamId,
  )!;
  for (const fixture of Object.values(save.fixtures)) {
    fixture.played = fixture.id !== pendingAI.id;
    if (fixture.played) {
      // The user's club finishes outside the playoffs.
      fixture.winnerTeamId = fixture.homeTeamId === save.userTeamId
        ? fixture.awayTeamId : fixture.homeTeamId;
      fixture.resultKind = fixture.winnerTeamId === fixture.homeTeamId ? 'HOME_WIN' : 'AWAY_WIN';
    }
  }
  for (const event of buildPlayerSeasonCalendar(save)!.events) event.completed = true;
  save.currentMonth = month;
  return { save, pendingAI };
}

describe('off-season progression and stale action recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    useCareer.setState({
      save: null, ref: null, lastPromotion: null, pendingAchievementIds: [],
      persist: originalPersist, persistCritical: originalPersistCritical,
    });
  });

  it('binds press callbacks to the rendered occurrence, even when the same question returns', () => {
    const save = makeManagerSave(8_399);
    save.managerStory = { flags: {}, strings: {}, seenEventIds: [], pendingEventIds: ['press_manager_away_win'] };
    activate(save);
    expect(useCareer.getState().resolvePress('press_manager_away_win', 'first', save.id, 0).ok).toBe(true);
    useCareer.getState().save!.managerStory!.pendingEventIds.push('press_manager_away_win');
    const before = clone(useCareer.getState().save);
    expect(useCareer.getState().resolvePress('press_manager_away_win', 'first', save.id, 0).ok).toBe(false);
    expect(useCareer.getState().save).toEqual(before);
    expect(useCareer.getState().resolvePress('press_manager_away_win', 'first', save.id, 1).ok).toBe(true);
  });

  it('rejects a story callback belonging to another career', () => {
    const first = makeCareerSave(8_398);
    const other = makeCareerSave(8_397);
    other.story!.pendingEventIds = ['career_start'];
    activate(other);
    const before = clone(other);
    expect(useCareer.getState().resolveStory('career_start', 'work', first.id, 0).ok).toBe(false);
    expect(useCareer.getState().save).toEqual(before);
    expect(useCareer.getState().resolveStory('career_start', 'work', other.id, 0).ok).toBe(true);
  });

  it('never resolves the next weekly event using the previous event button', () => {
    const save = makeCareerSave(8_396);
    const calendar = buildPlayerSeasonCalendar(save)!;
    const index = calendar.events.findIndex((event, i) => event.kind !== 'MATCH'
      && calendar.events[i + 1] && calendar.events[i + 1].kind !== 'MATCH');
    expect(index).toBeGreaterThanOrEqual(0);
    for (const event of calendar.events.slice(0, index)) {
      event.completed = true;
      if (event.fixtureId) save.fixtures[event.fixtureId].played = true;
    }
    calendar.cursor = index;
    activate(save);
    const originalId = currentPlayerCalendarEvent(save)!.id;
    expect(useCareer.getState().resolvePlayerWeek('SKILL', originalId, save.id).ok).toBe(true);
    const nextId = currentPlayerCalendarEvent(useCareer.getState().save!)!.id;
    expect(nextId).not.toBe(originalId);
    const before = clone(useCareer.getState().save);
    expect(useCareer.getState().resolvePlayerWeek('SKILL', originalId, save.id).ok).toBe(false);
    expect(useCareer.getState().save).toEqual(before);
  });

  it.each([1, 6, 7, 8, 9, 12])(
    'settles the exhausted Player calendar in month %i for free and rolls age once', month => {
      const { save, pendingAI } = exhaustedPlayerCalendar(month);
      activate(save);
      expect(currentPlayerCalendarEvent(save)).toBeUndefined();
      expect(seasonComplete(save)).toBe(false);
      expect(resolveNextCareerStep(save).action).toBe('ADVANCE_CAREER_CALENDAR');
      const careerStats = clone(save.players[save.userPlayerId!].careerStats ?? {});
      const beforeWallet = clone(save.wallet);
      useCareer.getState().advanceSeason();
      const settled = useCareer.getState().save!;
      expect(settled.fixtures[pendingAI.id].played).toBe(true);
      expect(seasonComplete(settled)).toBe(true);
      expect(resolveNextCareerStep(settled).action).toBe('ADVANCE_SEASON');
      expect(settled.players[settled.userPlayerId!].careerStats ?? {}).toEqual(careerStats);
      expect(settled.wallet).toEqual(beforeWallet);
      const settledFixtures = clone(settled.fixtures);
      useCareer.getState().advanceSeason(); // Repeated tap/re-entry cannot replay settlements.
      expect(useCareer.getState().save!.fixtures).toEqual(settledFixtures);
      const oldSeason = settled.currentSeasonId;
      useCareer.getState().newSeason();
      const rolled = useCareer.getState().save!;
      expect(rolled.currentSeasonId).not.toBe(oldSeason);
      expect(rolled.players[rolled.userPlayerId!].age).toBe(22);
      const rolledWallet = clone(rolled.wallet);
      useCareer.getState().newSeason();
      expect(useCareer.getState().save!.players[rolled.userPlayerId!].age).toBe(22);
      expect(useCareer.getState().save!.wallet).toEqual(rolledWallet);
      expect(currentPlayerCalendarEvent(useCareer.getState().save!)).toBeDefined();
    },
  );

  it('ignores retained Manager calendar metadata in a Player save', () => {
    const { save, pendingAI } = exhaustedPlayerCalendar(8);
    save.managerCalendar = clone(makeManagerSave().managerCalendar!);
    activate(save);
    useCareer.getState().advanceSeason();
    expect(useCareer.getState().save!.fixtures[pendingAI.id].played).toBe(true);
    expect(seasonComplete(useCareer.getState().save!)).toBe(true);
  });

  it('recovers a serialized existing save through the normal load path without restarting the career', () => {
    const { save } = exhaustedPlayerCalendar(8);
    const restored = clone(save);
    const id = restored.id;
    const seasonId = restored.currentSeasonId;
    const oldAge = restored.players[restored.userPlayerId!].age;
    useCareer.getState().setActive(restored, 'career', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });
    expect(resolveNextCareerStep(useCareer.getState().save!).action).toBe('ADVANCE_CAREER_CALENDAR');
    useCareer.getState().advanceSeason();
    const after = useCareer.getState().save!;
    expect(after.id).toBe(id);
    expect(after.currentSeasonId).toBe(seasonId);
    expect(after.players[after.userPlayerId!].age).toBe(oldAge);
    expect(seasonComplete(after)).toBe(true);
  });

  it('does not grant a phantom appearance from an old AI-club roster', () => {
    const { save, pendingAI } = exhaustedPlayerCalendar(8);
    const aiTeam = save.teams[pendingAI.homeTeamId];
    aiTeam.playerIds.unshift(save.userPlayerId!);
    aiTeam.xi = [save.userPlayerId!, ...aiTeam.playerIds.filter(id => id !== save.userPlayerId).slice(0, 10)];
    const beforeStats = clone(save.players[save.userPlayerId!].careerStats ?? {});
    const beforeWallet = clone(save.wallet);
    activate(save);
    useCareer.getState().advanceSeason();
    const after = useCareer.getState().save!;
    expect(after.players[after.userPlayerId!].careerStats ?? {}).toEqual(beforeStats);
    expect(after.wallet).toEqual(beforeWallet);
    expect(after.teams[aiTeam.id].xi).toContain(save.userPlayerId);
  });

  it('cannot skip an unresolved week or a selected/benched match through stale Continue', () => {
    const save = makeCareerSave();
    save.careerPathLevel = 'DOMESTIC';
    save.players[save.userPlayerId!].age = 21;
    if (save.story) save.story.pendingEventIds = [];
    nextUserFixtureId(save);
    activate(save);
    const firstEvent = currentPlayerCalendarEvent(save)!.id;
    const playedBefore = Object.values(save.fixtures).filter(fixture => fixture.played).length;
    useCareer.getState().advanceSeason();
    expect(currentPlayerCalendarEvent(save)?.id).toBe(firstEvent);
    expect(Object.values(save.fixtures).filter(fixture => fixture.played)).toHaveLength(playedBefore);
    for (let guard = 0; guard < 10 && currentPlayerCalendarEvent(save)?.kind !== 'MATCH'; guard++) {
      resolvePlayerCalendarEvent(save);
    }
    const fixtureId = nextUserFixtureId(save)!;
    expect(fixtureId).toBeDefined();
    useCareer.getState().advanceSeason();
    expect(save.fixtures[fixtureId].played).toBe(false);
    expect(nextUserFixtureId(save)).toBe(fixtureId);
    save.players[save.userPlayerId!].condition = 0;
    useCareer.getState().advanceSeason();
    expect(save.fixtures[fixtureId].played).toBe(false);
  });

  it('stops at a newly unlocked Player semifinal rather than skipping it', () => {
    const { save, pendingAI } = exhaustedPlayerCalendar(8);
    for (const fixture of Object.values(save.fixtures)) {
      if (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId) {
        fixture.winnerTeamId = save.userTeamId;
        fixture.resultKind = fixture.homeTeamId === save.userTeamId ? 'HOME_WIN' : 'AWAY_WIN';
      }
    }
    activate(save);
    useCareer.getState().advanceSeason();
    const after = useCareer.getState().save!;
    expect(after.fixtures[pendingAI.id].played).toBe(true);
    const playoffId = nextUserFixtureId(after)!;
    expect(after.fixtures[playoffId]).toMatchObject({ playoff: true, played: false });
    useCareer.getState().advanceSeason();
    expect(useCareer.getState().save!.fixtures[playoffId].played).toBe(false);
    expect(seasonComplete(useCareer.getState().save!)).toBe(false);
  });

  it('gives an unfinished legacy Manager season a settlement action, then a real rollover', () => {
    const save = makeManagerSave(8_320);
    save.managerCalendar = undefined;
    if (save.managerStory) save.managerStory.pendingEventIds = [];
    for (const fixture of Object.values(save.fixtures)) {
      fixture.played = true;
      fixture.winnerTeamId = fixture.homeTeamId === save.userTeamId ? fixture.awayTeamId : fixture.homeTeamId;
    }
    activate(save);
    expect(resolveNextCareerStep(save).action).toBe('ADVANCE_CAREER_CALENDAR');
    useCareer.getState().advanceSeason();
    const settled = useCareer.getState().save!;
    ensurePlayoffs(settled);
    expect(seasonComplete(settled)).toBe(true);
    expect(resolveNextCareerStep(settled).action).toBe('ADVANCE_SEASON');
    const year = settled.seasons[settled.currentSeasonId!].year;
    useCareer.getState().newSeason();
    const rolled = useCareer.getState().save!;
    expect(rolled.seasons[rolled.currentSeasonId!].year).toBe(year + 1);
  });

  it.each(['CLUB', 'STATE', 'ELITE', 'NATIONAL'] as const)(
    'retains the %s Manager off-season rollover without requiring a purchase', level => {
      const save = makeManagerSave(8_330);
      save.managerCareerLevel = level;
      buildManagerSeasonCalendar(save, 2026, 'OFF_SEASON');
      for (const fixture of Object.values(save.fixtures)) {
        fixture.played = true;
        fixture.winnerTeamId = fixture.homeTeamId;
      }
      save.wallet.coins = 0;
      if (save.managerStory) save.managerStory.pendingEventIds = [];
      activate(save);
      expect(resolveNextCareerStep(save).action).toBe('ADVANCE_SEASON');
      useCareer.getState().newSeason();
      expect(useCareer.getState().save!.managerCalendar?.year).toBe(2027);
    },
  );

  it.each(['CLUB', 'NATIONAL'] as const)(
    'repairs missing %s off-season preparation once without getting stuck at Start season', level => {
      const save = makeManagerSave(8_340);
      save.managerCareerLevel = level;
      buildManagerSeasonCalendar(save, 2026, 'OFF_SEASON');
      for (const fixture of Object.values(save.fixtures)) {
        fixture.played = true;
        fixture.winnerTeamId = fixture.homeTeamId;
      }
      save.managerCalendar!.offSeasonPrepared = false;
      if (save.managerStory) save.managerStory.pendingEventIds = [];
      const retainedClub = clone(save.teams[save.userTeamId!]);
      activate(save);
      expect(seasonComplete(save)).toBe(false);
      expect(resolveNextCareerStep(save).action).toBe('ADVANCE_MANAGER_CALENDAR');
      useCareer.getState().advanceManagerCalendar();
      const after = useCareer.getState().save!;
      expect(after.managerCalendar!.offSeasonPrepared).toBe(true);
      expect(seasonComplete(after)).toBe(true);
      expect(resolveNextCareerStep(after).action).toBe('ADVANCE_SEASON');
      if (level === 'NATIONAL') expect(after.teams[save.userTeamId!]).toEqual(retainedClub);
    },
  );

  it('settles a retained off-season AI fixture in bounded batches without replaying or mutating the retained club', () => {
    const save = makeManagerSave(8_341);
    save.managerCareerLevel = 'NATIONAL';
    buildManagerSeasonCalendar(save, 2026, 'OFF_SEASON');
    for (const fixture of Object.values(save.fixtures)) {
      fixture.played = true;
      fixture.winnerTeamId = fixture.homeTeamId;
    }
    const template = Object.values(save.fixtures).find(fixture => save.teams[fixture.homeTeamId]?.isNationalTeam)!;
    expect(template).toBeDefined();
    const otherTeams = Object.values(save.teams).filter(team =>
      team.isNationalTeam && team.id !== save.managerNationalTeamId,
    );
    expect(otherTeams.length).toBeGreaterThanOrEqual(2);
    const pendingId = 'off-season-ai-international';
    save.fixtures[pendingId] = {
      ...template, id: pendingId, played: false, winnerTeamId: undefined, resultKind: undefined,
      homeTeamId: otherTeams[0].id, awayTeamId: otherTeams[1].id,
      managerPhase: 'OFF_SEASON', calendarMonth: 6,
    };
    if (save.managerStory) save.managerStory.pendingEventIds = [];
    const club = clone(save.teams[save.userTeamId!]);
    const wallet = clone(save.wallet);
    activate(save);
    expect(resolveNextCareerStep(save).action).toBe('ADVANCE_MANAGER_CALENDAR');
    expect(useCareer.getState().advanceManagerCalendar(1)?.kind).toBe('IN_PROGRESS');
    const after = useCareer.getState().save!;
    expect(after.fixtures[pendingId].played).toBe(true);
    expect(useCareer.getState().advanceManagerCalendar(1)?.kind).toBe('YEAR_COMPLETE');
    expect(after.wallet).toEqual(wallet);
    expect(after.teams[save.userTeamId!]).toEqual(club);
    expect(seasonComplete(after)).toBe(true);
    const fixtures = clone(after.fixtures);
    useCareer.getState().advanceManagerCalendar(1);
    expect(useCareer.getState().save!.fixtures).toEqual(fixtures);
  });

  it.each(['SCHOOL', 'U19', 'DOMESTIC', 'INTERNATIONAL'] as const)(
    'rejects stale club-transfer callbacks in a %s Player save without spending or changing the squad', level => {
      const save = makeCareerSave(8_350);
      save.careerPathLevel = level;
      save.wallet.coins = 100_000;
      save.wallet.gems = 500;
      save.currentMonth = 6; // An open month must not grant Manager privileges.
      const teammateId = save.teams[save.userTeamId!].playerIds.find(id => id !== save.userPlayerId)!;
      const targetId = save.freeAgents![0];
      const before = clone(save);
      activate(save);
      expect(useCareer.getState().signPlayer(targetId)).toMatchObject({ ok: false, cost: 0 });
      expect(useCareer.getState().releasePlayer(teammateId)).toMatchObject({ ok: false, recouped: 0 });
      expect(useCareer.getState().loanPlayer(targetId).ok).toBe(false);
      expect(useCareer.getState().offerFreeAgentContract(targetId).ok).toBe(false);
      expect(useCareer.getState().recallLoan(teammateId)).toBe(false);
      useCareer.getState().removeFreeAgent(targetId);
      expect(useCareer.getState().save).toEqual(before);
      expect(useCareer.getState().persist).not.toHaveBeenCalled();
    },
  );

  it('rejects closed-window Manager signings, but August calendar off-season signings still work once', () => {
    const save = makeManagerSave(8_360);
    const targetId = save.freeAgents![0];
    const team = save.teams[save.userTeamId!];
    team.budget = 10_000_000;
    save.finances!.wageBudgetPerSeason = 5_000_000;
    save.managerCalendar!.phase = 'FIRST_CLASS';
    save.currentMonth = 1; // Calendar phase owns the window, not January alone.
    activate(save);
    const before = clone(save);
    expect(useCareer.getState().signPlayer(targetId).ok).toBe(false);
    expect(useCareer.getState().loanPlayer(targetId).ok).toBe(false);
    expect(useCareer.getState().offerFreeAgentContract(targetId).ok).toBe(false);
    expect(save).toEqual(before);
    save.managerCalendar!.phase = 'OFF_SEASON';
    save.currentMonth = 8;
    expect(useCareer.getState().signPlayer(targetId).ok).toBe(true);
    const budget = useCareer.getState().save!.teams[team.id].budget;
    expect(useCareer.getState().signPlayer(targetId).ok).toBe(false);
    expect(useCareer.getState().save!.teams[team.id].budget).toBe(budget);
  });

  it('handles absent saves and missing club records without crashing or creating a new save', () => {
    useCareer.setState({ save: null, ref: null });
    expect(() => useCareer.getState().advanceSeason()).not.toThrow();
    expect(useCareer.getState().signPlayer('missing').ok).toBe(false);
    const save = makeManagerSave(8_361);
    delete save.teams[save.userTeamId!];
    activate(save);
    expect(useCareer.getState().signPlayer('missing')).toMatchObject({ ok: false, reason: 'No active club.' });
    expect(useCareer.getState().releasePlayer('missing').ok).toBe(false);
    expect(useCareer.getState().loanPlayer('missing').ok).toBe(false);
    expect(useCareer.getState().offerFreeAgentContract('missing').ok).toBe(false);
  });
});
