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

import { makeCareerSave } from '../../game/__tests__/_depthHelpers';
import {
  generateInternationalWindowFixtures,
  nextInternationalFixtureId,
} from '../../game/intlCalendar';
import { buildPlayerSeasonCalendar } from '../../game/playerCalendar';
import { nextUserFixtureId } from '../../game/season';
(global as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
const { useCareer } = jest.requireActual<typeof import('../careerStore')>('../careerStore');

function overlappingTours() {
  const save = makeCareerSave(2031);
  save.capped = true;
  save.careerPathLevel = 'INTERNATIONAL';
  save.userCaps = 12;
  save.nationalRep = 95;
  save.playerCareerResources!.cappedCountry = 'india';
  save.playerCareerResources!.declaredCountry = 'india';
  save.players[save.userPlayerId!].overall = 92;
  save.players[save.userPlayerId!].meta.form = 99;
  save.currentSeasonId = 'season-2031';
  save.seasons[save.currentSeasonId] = {
    id: save.currentSeasonId,
    year: 2031,
    leagueIds: Object.keys(save.leagues),
    fixtureIds: [],
    currentRound: 1,
    competitions: [],
  };
  save.fixtures = {};
  save.playerCalendar = undefined;
  generateInternationalWindowFixtures(save);
  buildPlayerSeasonCalendar(save);
  return save;
}

describe('international Matchday uses the career calendar', () => {
  afterEach(() => useCareer.setState({ save: null, ref: null, targetFixtureId: undefined }));

  it.each(['t20i-series-2031-2', 'odi-series-2031-1'])(
    'opens the advertised second match in %s when another tour shares its week',
    (assignmentId) => {
      const save = overlappingTours();
      const target = `intl-2031-${assignmentId}-2`;
      const calendar = save.playerCalendar!;
      const targetIndex = calendar.events.findIndex((event) => event.fixtureId === target);
      expect(targetIndex).toBeGreaterThan(0);
      for (const event of calendar.events.slice(0, targetIndex)) {
        event.completed = true;
        if (event.fixtureId) save.fixtures[event.fixtureId].played = true;
      }
      expect(nextUserFixtureId(save)).toBe(target);
      // The former launcher sorted same-week fixtures by round, whereas the
      // career calendar orders its assignment events. Both tours remain valid.
      expect(nextInternationalFixtureId(save)).not.toBe(target);
      useCareer.setState({ save, ref: { mode: 'career', slot: 1 } });
      const started = useCareer.getState().beginInternational();
      expect(started?.live.id).toBe(target);
      expect(save.fixtures[target].played).toBe(false);
    },
  );

  it('does not skip a pending calendar decision to open an international fixture', () => {
    const save = overlappingTours();
    expect(nextInternationalFixtureId(save)).toBeDefined();
    expect(save.playerCalendar!.events[0].kind).not.toBe('MATCH');
    useCareer.setState({ save, ref: { mode: 'career', slot: 1 } });
    expect(useCareer.getState().beginInternational()).toBeNull();
  });

  it('does not reopen a completed international schedule', () => {
    const save = overlappingTours();
    for (const fixture of Object.values(save.fixtures)) fixture.played = true;
    for (const event of save.playerCalendar!.events) event.completed = true;
    useCareer.setState({ save, ref: { mode: 'career', slot: 1 } });
    expect(useCareer.getState().beginInternational()).toBeNull();
  });

  it('does not open a domestic fixture through the international launcher', () => {
    const save = overlappingTours();
    const calendar = save.playerCalendar!;
    const index = calendar.events.findIndex((event) => event.kind === 'MATCH');
    for (const event of calendar.events.slice(0, index)) event.completed = true;
    const target = save.fixtures[calendar.events[index].fixtureId!];
    target.competition = 'LEAGUE';
    target.competitionId = 'list-a';
    target.homeTeamId = save.userTeamId!;
    target.awayTeamId = Object.keys(save.teams).find((id) => id !== save.userTeamId)!;
    const refreshed = buildPlayerSeasonCalendar(save)!;
    const domesticIndex = refreshed.events.findIndex((event) => event.fixtureId === target.id);
    expect(domesticIndex).toBeGreaterThanOrEqual(0);
    for (const event of refreshed.events.slice(0, domesticIndex)) {
      event.completed = true;
      if (event.fixtureId) save.fixtures[event.fixtureId].played = true;
    }
    expect(nextUserFixtureId(save)).toBe(target.id);
    useCareer.setState({ save, ref: { mode: 'career', slot: 1 } });
    expect(useCareer.getState().beginInternational()).toBeNull();
    expect(target.played).toBe(false);
  });
});
