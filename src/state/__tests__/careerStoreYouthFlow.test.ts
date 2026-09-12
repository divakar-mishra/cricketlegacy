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
jest.mock('../../services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => {}) }));

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { activeCompetitionTable } = jest.requireActual<typeof import('../../game/competitionTable')>(
  '../../game/competitionTable',
);
const { makeCareerSave } = jest.requireActual<typeof import('../../game/__tests__/_depthHelpers')>(
  '../../game/__tests__/_depthHelpers',
);
const { runFixture } = jest.requireActual<typeof import('../../game/season')>('../../game/season');
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');

const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;

describe('career store youth live-match flow', () => {
  it.each(['autosave', 'caller'] as const)('uses one persistence owner for %s completion', (persistence) => {
    const save = makeCareerSave(919);
    save.players[save.userPlayerId!].age = 18;
    save.careerPathLevel = 'U19';
    save.playerCalendar = undefined;
    useCareer.getState().setActive(save, 'career', 1);
    const persist = jest.fn(async () => undefined);
    useCareer.setState({ persist });
    const started = useCareer.getState().beginLiveMatch()!;
    const match = runFixture(useCareer.getState().save!, started.fixtureId);
    persist.mockClear();
    expect(useCareer.getState().commitLiveMatch(match, persistence)).not.toBeNull();
    expect(persist).toHaveBeenCalledTimes(persistence === 'autosave' ? 1 : 0);
    expect(useCareer.getState().save!.fixtures[match.id].played).toBe(true);
    expect(useCareer.getState().commitLiveMatch(match, persistence)).toBeNull();
    expect(persist).toHaveBeenCalledTimes(persistence === 'autosave' ? 1 : 0);
  });
  afterEach(() => {
    useCareer.setState({
      save: null,
      ref: null,
      pendingAchievementIds: [],
      lastPromotion: null,
      persistenceError: null,
      persist: originalPersist,
      persistCritical: originalPersistCritical,
    });
  });

  it('catches up the youth round before a live match and commits table and rival progress', () => {
    const save = makeCareerSave(919);
    save.players[save.userPlayerId!].age = 18;
    save.careerPathLevel = 'U19';
    save.playerCalendar = undefined;
    useCareer.getState().setActive(save, 'career', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });

    const started = useCareer.getState().beginLiveMatch()!;
    const afterStart = useCareer.getState().save!;
    const fixture = afterStart.fixtures[started.fixtureId];
    const opponentId =
      fixture.homeTeamId === afterStart.careerPathTeamId ? fixture.awayTeamId : fixture.homeTeamId;
    const rivalId = afterStart.rivalPlayerId!;

    expect(afterStart.teams[opponentId].xi).toContain(rivalId);
    expect(
      Object.values(afterStart.fixtures).filter(
        (candidate) =>
          candidate.competitionId === fixture.competitionId &&
          candidate.round === fixture.round &&
          candidate.id !== fixture.id &&
          candidate.played,
      ),
    ).toHaveLength(3);

    const match = runFixture(afterStart, started.fixtureId);
    match.result = {
      winnerTeamId: afterStart.careerPathTeamId,
      margin: 'Won by 5 wickets',
    };
    useCareer.getState().commitLiveMatch(match);

    const committed = useCareer.getState().save!;
    const table = activeCompetitionTable(committed);
    expect(table.rows.find((row) => row.teamId === committed.careerPathTeamId)).toMatchObject({
      played: 1,
      won: 1,
      points: 2,
    });
    expect(committed.players[rivalId].seasonStats?.matches).toBe(1);
  });

  it('repairs an in-session stale fixture bit and never commits that result twice', () => {
    const save = makeCareerSave(920);
    save.players[save.userPlayerId!].age = 18;
    save.careerPathLevel = 'U19';
    save.playerCalendar = undefined;
    useCareer.getState().setActive(save, 'career', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });

    const started = useCareer.getState().beginLiveMatch()!;
    const active = useCareer.getState().save!;
    const match = runFixture(active, started.fixtureId);
    expect(useCareer.getState().commitLiveMatch(match)).not.toBeNull();

    const committed = useCareer.getState().save!;
    const matchesAfterFirstCommit = committed.players[committed.userPlayerId!].careerStats?.matches;
    const calendarItem = committed.playerCalendar?.events.find(
      (event) => event.fixtureId === started.fixtureId,
    );

    // Reproduce the old race: a stale write restores the fixture/calendar bits,
    // while the exactly-once result ledger from the completed match survives.
    committed.fixtures[started.fixtureId].played = false;
    if (calendarItem) calendarItem.completed = false;
    useCareer.setState({ targetFixtureId: started.fixtureId });

    expect(useCareer.getState().commitLiveMatch(match)).toBeNull();
    expect(committed.players[committed.userPlayerId!].careerStats?.matches).toBe(
      matchesAfterFirstCommit,
    );

    const next = useCareer.getState().beginLiveMatch();
    expect(committed.fixtures[started.fixtureId].played).toBe(true);
    expect(next?.fixtureId).not.toBe(started.fixtureId);
  });
});
