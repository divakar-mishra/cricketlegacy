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

(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;

const { buildUserPlayer, createCareerSave } =
  jest.requireActual<typeof import('../../game/createGame')>('../../game/createGame');
const { recordU19WorldCupMerit } =
  jest.requireActual<typeof import('../../game/u19WorldCup')>('../../game/u19WorldCup');
const { ensurePlayerCareerResources } =
  jest.requireActual<typeof import('../../game/career')>('../../game/career');
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');

const originalPersist = useCareer.getState().persist;
const originalPersistCritical = useCareer.getState().persistCritical;

function selectedSave() {
  const player = buildUserPlayer({
    name: 'National Youth Player',
    age: 18,
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 67, timing: 67, power: 65, footwork: 65, temperament: 67, running: 63 },
    bowling: { paceOrSpin: 35, accuracy: 35, movement: 34, variations: 34, stamina: 42 },
    fielding: { catching: 62, throwing: 60, agility: 62, keeping: 35 },
    meta: { fitness: 74, confidence: 70, aggression: 58, discipline: 68 },
  });
  const save = createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: 1919,
  });
  const regional = Object.values(save.fixtures)
    .filter(
      (fixture) =>
        fixture.competitionId === 'youth-u19' &&
        (fixture.homeTeamId === save.careerPathTeamId ||
          fixture.awayTeamId === save.careerPathTeamId),
    )
    .sort((left, right) => left.round - right.round);
  for (const fixture of regional.slice(0, 3)) {
    recordU19WorldCupMerit(save, {
      fixtureId: fixture.id,
      runs: 75,
      wickets: 0,
      rating: 7,
    });
  }
  for (const fixture of regional) fixture.played = true;
  save.playerCalendar = undefined;
  save.wallet.energy = 36;
  return save;
}

function regionalU19Save() {
  const player = buildUserPlayer({
    name: 'Regional Youth Player',
    age: 17,
    nationality: 'india',
    role: 'BATTER',
    battingStyle: 'RHB',
    batting: { technique: 52, timing: 52, power: 50, footwork: 50, temperament: 52, running: 50 },
    bowling: { paceOrSpin: 32, accuracy: 32, movement: 31, variations: 31, stamina: 40 },
    fielding: { catching: 52, throwing: 50, agility: 52, keeping: 30 },
    meta: { fitness: 68, confidence: 60, aggression: 55, discipline: 62 },
  });
  const save = createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: 1717,
  });
  save.wallet.energy = 36;
  return save;
}

describe('career store U19 World Cup match flow', () => {
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

  it('commits through normal Matchday without granting a senior cap', () => {
    const save = selectedSave();
    save.players[save.userPlayerId!].overall = 90;
    save.nationalRep = 99;
    useCareer.getState().setActive(save, 'career', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });
    const seniorTournamentsBefore = JSON.stringify(
      useCareer.getState().save?.internationalTournaments,
    );

    const started = useCareer.getState().beginLiveMatch()!;
    expect(started.live.controlledTeamId).toBe(save.u19WorldCup?.controlledTeamId);
    let guard = 0;
    while (!started.live.matchDone && guard++ < 10_000) started.live.nextBall();
    const match = started.live.finalizeMatch();

    const result = useCareer.getState().commitLiveMatch(match)!;
    const committed = useCareer.getState().save!;
    expect(result.selected).toBe(true);
    expect(committed.fixtures[started.fixtureId].played).toBe(true);
    expect(['SELECTED', 'ELIMINATED', 'RUNNER_UP', 'CHAMPION']).toContain(
      committed.u19WorldCup?.status,
    );
    expect(committed.capped).not.toBe(true);
    expect(committed.userCaps ?? 0).toBe(0);
    expect(JSON.stringify(committed.internationalTournaments)).toBe(seniorTournamentsBefore);
  });

  it('counts a selected regional U19 batter who was not required to bat or bowl', () => {
    const save = regionalU19Save();
    useCareer.getState().setActive(save, 'career', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });

    const started = useCareer.getState().beginLiveMatch()!;
    expect(save.fixtures[started.fixtureId].competitionId).toBe('youth-u19');
    expect(save.teams[started.live.controlledTeamId!].xi).toContain(save.userPlayerId);
    let guard = 0;
    while (!started.live.matchDone && guard++ < 10_000) started.live.nextBall();
    const match = started.live.finalizeMatch();
    for (const innings of match.innings) {
      innings.batting = innings.batting.filter((entry) => entry.playerId !== save.userPlayerId);
      innings.bowling = innings.bowling.filter((entry) => entry.playerId !== save.userPlayerId);
    }

    const matchesBefore = save.careerPathMatches ?? 0;
    const meritBefore = save.u19WorldCup?.merit.appearances ?? 0;
    const energyBefore = save.wallet.energy;
    const result = useCareer.getState().commitLiveMatch(match)!;
    const committed = useCareer.getState().save!;

    expect(result.selected).toBe(true);
    expect(result.rating).toBe(5);
    expect(committed.careerPathMatches).toBe(matchesBefore + 1);
    expect(committed.u19WorldCup?.merit.appearances).toBe(meritBefore + 1);
    expect(committed.wallet.energy).toBeLessThan(energyBefore);
  });

  it('advances benched fixtures off-screen without crediting a player appearance', () => {
    const save = regionalU19Save();
    const user = save.players[save.userPlayerId!];
    user.meta.form = 34;
    const resources = ensurePlayerCareerResources(save)!;
    resources.form = 34;
    const pathTeam = save.teams[save.careerPathTeamId!];
    for (const playerId of pathTeam.playerIds) {
      const player = save.players[playerId];
      if (player && player.id !== user.id && player.role === user.role) {
        player.overall = Math.min(player.overall, 35);
        player.meta.form = 35;
      }
    }
    useCareer.getState().setActive(save, 'career', 1);
    useCareer.setState({ persist: jest.fn(async () => undefined) });
    const matchesBefore = user.careerStats?.matches ?? 0;
    const coinsBefore = save.wallet.coins;

    const outcome = useCareer.getState().advanceWhileBenched();
    const committed = useCareer.getState().save!;

    expect(outcome).toMatchObject({ ok: true, simulated: 1 });
    expect(committed.players[committed.userPlayerId!].careerStats?.matches ?? 0).toBe(
      matchesBefore,
    );
    expect(committed.players[committed.userPlayerId!].meta.form).toBe(40);
    expect(committed.wallet.coins).toBeGreaterThan(coinsBefore);
    expect(outcome.nextFixtureId).toBeTruthy();
  });
});
