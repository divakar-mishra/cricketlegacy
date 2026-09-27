import fs from 'node:fs';
import path from 'node:path';
import type { Fixture, MatchState, NewspaperStory, SaveGame } from '../../domain/types';

const { createManagerSave } = jest.requireActual<typeof import('../createGame')>('../createGame');
const { runFixture, applyResult, startNewSeason } =
  jest.requireActual<typeof import('../season')>('../season');
const { buildManagerSeasonCalendar } =
  jest.requireActual<typeof import('../managerCalendar')>('../managerCalendar');

const OUT = path.join(process.cwd(), 'marketing/capture-2026-09/scenario-saves');
const INDIA = 'national-india';
const WTC_CYCLE = 'wtc-2026-2027';

function createScenario(seed: number): SaveGame {
  const save = createManagerSave({
    teamId: 'mumbai_sharks',
    country: 'india',
    difficulty: 'EASY',
    format: 'T20',
    seed,
    now: 1_800_000_000_000 + seed,
  });
  save.id = `manager-canonical-capture-${seed}`;
  (save as SaveGame & { qaCaptureOnly: boolean }).qaCaptureOnly = true;
  // Isolated QA promotion shortcut: the scenario exercises national fixtures,
  // not the domestic career appointment ladder.
  save.managerCareerLevel = 'NATIONAL';
  save.managerNationalTeamId = INDIA;
  return save;
}

function tuneScenarioRatings(save: SaveGame): void {
  for (const team of Object.values(save.teams).filter((candidate) => candidate.isNationalTeam)) {
    const isIndia = team.id === INDIA;
    for (const playerId of team.playerIds) {
      const player = save.players[playerId];
      if (!player) continue;
      const rating = isIndia ? 99 : 38;
      player.overall = rating;
      player.condition = 100;
      player.batting = {
        technique: rating,
        timing: rating,
        power: rating,
        footwork: rating,
        temperament: rating,
        running: rating,
      };
      player.bowling = {
        paceOrSpin: rating,
        accuracy: rating,
        movement: rating,
        variations: rating,
        stamina: rating,
      };
      player.fielding = { catching: rating, throwing: rating, agility: rating, keeping: rating };
      player.meta = {
        fitness: rating,
        confidence: rating,
        aggression: rating,
        discipline: rating,
        form: rating,
      };
    }
    team.reputation = isIndia ? 99 : 30;
  }
}

function ensureAwayTest(save: SaveGame, country: 'australia' | 'england'): string {
  const year = save.seasons[save.currentSeasonId!].year;
  const opponentId = `national-${country}`;
  const fixtureId = `marketing-away-test-${country}-${year}`;
  const fixture: Fixture = {
    id: fixtureId,
    seasonId: save.currentSeasonId!,
    format: 'TEST',
    homeTeamId: opponentId,
    awayTeamId: INDIA,
    venue: country === 'australia' ? 'Melbourne Cricket Ground' : 'Lord’s',
    round: 90 + (country === 'australia' ? 1 : 2),
    played: false,
    competition: 'BILATERAL_SERIES',
    competitionId: `marketing-test-tour-${country}-${year}`,
    managerPhase: 'FIRST_CLASS',
    calendarMonth: 8,
  };
  save.fixtures[fixtureId] = fixture;
  save.seasons[save.currentSeasonId!].fixtureIds.push(fixtureId);
  tuneScenarioRatings(save);
  return fixtureId;
}

function playFixture(
  save: SaveGame,
  fixtureId: string,
  matches?: Map<string, MatchState>,
): MatchState {
  tuneScenarioRatings(save);
  const match = runFixture(save, fixtureId) as MatchState;
  applyResult(save, match);
  if (!save.fixtures[fixtureId]?.played || save.fixtures[fixtureId]?.resultMatchId !== fixtureId) {
    throw new Error(`Canonical finalization did not persist ${fixtureId}`);
  }
  matches?.set(fixtureId, match);
  return match;
}

function playCompetition(
  save: SaveGame,
  competitionId: string,
  matches: Map<string, MatchState>,
): void {
  for (let guard = 0; guard < 12; guard += 1) {
    const fixture = Object.values(save.fixtures)
      .filter((candidate) => candidate.competitionId === competitionId && !candidate.played)
      .sort((left, right) => left.round - right.round)[0];
    if (!fixture) return;
    playFixture(save, fixture.id, matches);
  }
  throw new Error(`Knockout progression exceeded its guard for ${competitionId}`);
}

function playWtcRound(save: SaveGame, matches: Map<string, MatchState>): void {
  for (let guard = 0; guard < 40; guard += 1) {
    const fixture = Object.values(save.fixtures)
      .filter((candidate) => candidate.wtcCycleId === WTC_CYCLE && !candidate.played)
      .sort((left, right) => left.round - right.round)[0];
    if (!fixture) return;
    playFixture(save, fixture.id, matches);
  }
  throw new Error('WTC fixture progression exceeded its guard');
}

function matchScore(match: MatchState, teamId: string): string {
  return match.innings
    .filter((innings) => innings.battingTeamId === teamId)
    .map((innings) => `${innings.runs}/${innings.wickets}`)
    .join(' & ') || 'Result recorded';
}

function clipping(input: {
  id: string;
  format: 'TEST' | 'T20';
  headline: string;
  subheadline: string;
  body: string;
  competition: string;
  opponent: string;
  venue?: string;
  trophy?: string;
  match?: MatchState;
  season?: number;
}): NewspaperStory {
  const story: NewspaperStory = {
    id: input.id,
    matchId: input.match?.id ?? input.id,
    createdAt: 1_800_000_000_000,
    season: input.season ?? 2026,
    kind: input.trophy ? 'TROPHY' : 'MATCH',
    newspaperCategory: input.trophy ? 'TROPHY' : 'CLOSE_WIN',
    headlineFamily: input.trophy ? 'TROPHY_FOCUS' : 'TEAM_RESULT',
    trophyNames: input.trophy ? [input.trophy] : undefined,
    format: input.format,
    edition: 'NATIONAL SPORTS EDITION',
    kicker: 'INDIA NATIONAL XI · MATCH REPORT',
    headline: input.headline,
    subheadline: input.subheadline,
    body: input.body,
    playerName: 'India National XI',
    opponentName: input.opponent,
    result: 'WIN',
    runs: 0,
    balls: 0,
    wickets: 0,
    teamName: 'India National XI',
    teamScore: input.match ? matchScore(input.match, INDIA) : undefined,
    opponentScore: input.match
      ? matchScore(input.match, input.match.homeTeamId === INDIA ? input.match.awayTeamId : input.match.homeTeamId)
      : undefined,
    resultLine: input.match?.result?.margin ?? 'Champions',
    competitionName: input.competition,
    venueName: input.venue,
  };
  return story;
}

function runSeed(seed: number): SaveGame | undefined {
  const save = createScenario(seed);
  const matches = new Map<string, MatchState>();
  buildManagerSeasonCalendar(save, 2026, 'LIST_A');
  tuneScenarioRatings(save);

  const australiaId = ensureAwayTest(save, 'australia');
  const australiaMatch = playFixture(save, australiaId, matches);
  if (save.fixtures[australiaId].winnerTeamId !== INDIA) return undefined;
  const australiaFixtureEvidence = { ...save.fixtures[australiaId] };
  const englandId = ensureAwayTest(save, 'england');
  const englandMatch = playFixture(save, englandId, matches);
  if (save.fixtures[englandId].winnerTeamId !== INDIA) return undefined;
  const englandFixtureEvidence = { ...save.fixtures[englandId] };

  playCompetition(save, 't20-world-cup-2026', matches);
  const worldCup = save.internationalTournaments?.['t20-world-cup-2026'];
  if (worldCup?.stage !== 'COMPLETE' || worldCup.championCountryId !== 'india') return undefined;
  const worldCupFinal = save.fixtures[worldCup.finalFixtureId!];
  const worldCupMatch = matches.get(worldCup.finalFixtureId!);
  if (!worldCupFinal || !worldCupMatch) return undefined;
  const australiaMatchEvidence = australiaMatch;
  const englandMatchEvidence = englandMatch;

  playWtcRound(save, matches);
  startNewSeason(save);
  tuneScenarioRatings(save);
  playWtcRound(save, matches);
  const cycle = save.wtcCycles?.[WTC_CYCLE];
  if (cycle?.championCountryId !== 'india' || !cycle.finalFixtureId) return undefined;
  const final = save.fixtures[cycle.finalFixtureId];
  if (!final?.played || final.winnerTeamId !== INDIA || final.resultMatchId !== final.id) return undefined;

  const wtcFinalMatch = save.fixtures[final.id];
  const wtcFinalMatchState = matches.get(final.id);
  if (!wtcFinalMatchState) throw new Error('Missing canonical final match output');
  const storyList = [
    clipping({
      id: 'canonical-manager-world-cup-2026',
      format: 'T20',
      headline: 'WORLD CUP CHAMPIONS',
      subheadline: 'India finish the 2026 campaign on top.',
      body: `India National XI won the T20 World Cup Final against ${save.teams[worldCupFinal.awayTeamId]?.name ?? 'the finalists'}. The title is backed by the completed canonical tournament fixtures in this QA save.`,
      competition: 'T20 World Cup 2026',
      opponent: save.teams[worldCupFinal.awayTeamId]?.name ?? 'Finalists',
      trophy: 'T20 World Cup 2026',
      match: worldCupMatch,
    }),
    clipping({
      id: 'canonical-manager-wtc-2027',
      format: 'TEST',
      headline: 'WORLD TEST CHAMPIONSHIP SECURED',
      subheadline: 'India win the 2027 final after qualifying through the cycle.',
      body: `India National XI defeated ${save.teams[wtcFinalMatch.awayTeamId]?.name ?? 'the finalists'} in the completed World Test Championship Final. The cycle standings, final fixture, and result are stored in this isolated QA save.`,
      competition: 'World Test Championship Final 2027',
      opponent: save.teams[wtcFinalMatch.awayTeamId]?.name ?? 'Finalists',
      trophy: 'World Test Championship 2027',
      match: wtcFinalMatchState,
      season: 2027,
    }),
    clipping({
      id: 'canonical-manager-australia-test-2026',
      format: 'TEST',
      headline: 'A TEST WIN IN AUSTRALIA',
      subheadline: `India secure the away result at ${australiaFixtureEvidence.venue}.`,
      body: `India National XI won the canonical Test at Australia’s home venue, ${australiaFixtureEvidence.venue}. Scorecard: India ${matchScore(australiaMatch, INDIA)}; Australia ${matchScore(australiaMatch, 'national-australia')}.`,
      competition: 'Test Tour of Australia 2026',
      opponent: 'Australia National XI',
      venue: australiaFixtureEvidence.venue,
      match: australiaMatch,
    }),
    clipping({
      id: 'canonical-manager-england-test-2026',
      format: 'TEST',
      headline: 'A TEST WIN IN ENGLAND',
      subheadline: `India claim the away Test at ${englandFixtureEvidence.venue}.`,
      body: `India National XI won the canonical Test at England’s home venue, ${englandFixtureEvidence.venue}. Scorecard: India ${matchScore(englandMatch, INDIA)}; England ${matchScore(englandMatch, 'national-england')}.`,
      competition: 'Test Tour of England 2026',
      opponent: 'England National XI',
      venue: englandFixtureEvidence.venue,
      match: englandMatch,
    }),
  ];
  save.experience ??= {};
  save.experience.mediaScrapbook = [
    ...(save.experience.mediaScrapbook ?? []),
    ...storyList,
  ];
  save.flags['qaCanonicalManagerCapture'] = true;
  save.flags['qaNationalAppointmentShortcut'] = true;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'manager-canonical-milestones-qa-only.json'), `${JSON.stringify(save)}\n`);
  fs.writeFileSync(
    path.join(OUT, 'manager-canonical-milestones-report.json'),
    `${JSON.stringify({
      seed,
      controlledCountry: 'india',
      nationalAppointmentGateBypassedForQA: true,
      ratingOverrides: { India: 99, opposition: 38 },
      worldCup: {
        status: worldCup.stage,
        championCountryId: worldCup.championCountryId,
        finalFixture: worldCupFinal,
      },
      wtc: {
        championCountryId: cycle.championCountryId,
        finalFixture: final,
        recordedFixtureIds: cycle.recordedFixtureIds,
      },
      awayTests: [
        { fixture: australiaFixtureEvidence, result: australiaMatchEvidence.result, innings: australiaMatchEvidence.innings },
        { fixture: englandFixtureEvidence, result: englandMatchEvidence.result, innings: englandMatchEvidence.innings },
      ],
      clips: storyList.map(({ id, headline, body }) => ({ id, headline, body })),
    }, null, 2)}\n`,
  );
  return save;
}

describe('canonical Manager marketing capture scenarios', () => {
  jest.setTimeout(240_000);

  it('records a seeded World Cup, WTC and away-Test sweep through canonical fixtures', () => {
    let completed: SaveGame | undefined;
    let chosenSeed = 90_000;
    for (let seed = 90_000; seed < 90_120 && !completed; seed += 1) {
      completed = runSeed(seed);
      chosenSeed = seed;
    }
    expect(completed).toBeDefined();
    const exported = JSON.parse(
      fs.readFileSync(path.join(OUT, 'manager-canonical-milestones-qa-only.json'), 'utf8'),
    ) as SaveGame;
    expect((exported as SaveGame & { qaCaptureOnly?: boolean }).qaCaptureOnly).toBe(true);
    expect(exported.flags.qaCanonicalManagerCapture).toBe(true);
    expect(exported.internationalTournaments?.['t20-world-cup-2026']).toMatchObject({
      stage: 'COMPLETE',
      championCountryId: 'india',
    });
    expect(exported.wtcCycles?.[WTC_CYCLE]?.championCountryId).toBe('india');
    expect(chosenSeed).toBeGreaterThanOrEqual(90_000);
  });
});
