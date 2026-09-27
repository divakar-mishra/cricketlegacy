import fs from 'node:fs';
import path from 'node:path';

import type { Fixture, SaveGame } from '../src/domain/types';

const { runFixture, applyResult } =
  jest.requireActual<typeof import('../src/game/season')>('../src/game/season');
const { buildNewspaperStory, archiveNewspaperStory } =
  jest.requireActual<typeof import('../src/game/newspaper')>('../src/game/newspaper');

const output = path.join(process.cwd(), 'marketing/capture-2026-09/scenario-saves');
const source = path.join(process.cwd(), 'test-artifacts/capture-saves/career-81001.json');

function freshSave(): SaveGame {
  const save = JSON.parse(fs.readFileSync(source, 'utf8')) as SaveGame;
  save.id = 'marketing-engine-capture';
  save.mode = 'career';
  save.userTeamId = 'national-india';
  save.userPlayerId = 'user';
  save.userCaps = Math.max(10, save.userCaps ?? 0);
  save.flags = { ...save.flags, retired: false };
  save.experience = { ...save.experience, mediaScrapbook: [], pendingNewspaperId: undefined };
  const player = save.players.user;
  player.name = 'Aarav Sen';
  player.age = 25;
  player.retired = false;
  player.condition = 100;
  player.overall = 99;
  player.batting = {
    technique: 99,
    timing: 99,
    power: 99,
    footwork: 99,
    temperament: 99,
    running: 99,
  };
  player.bowling = { paceOrSpin: 99, accuracy: 99, movement: 99, variations: 99, stamina: 99 };
  player.meta = { fitness: 99, confidence: 99, aggression: 99, discipline: 99, form: 99 };
  for (const teamId of ['national-india', 'national-australia', 'national-england']) {
    const team = save.teams[teamId];
    if (!team) throw new Error(`Missing national team ${teamId}`);
    team.isNationalTeam = true;
  }
  const india = save.teams['national-india'];
  if (!india.playerIds.includes(player.id)) india.playerIds.unshift(player.id);
  india.xi = [player.id, ...(india.xi ?? []).filter((id) => id !== player.id)];
  for (const teamId of ['national-australia', 'national-england']) {
    const team = save.teams[teamId];
    for (const id of team.playerIds) {
      const opposition = save.players[id];
      if (!opposition) continue;
      opposition.overall = 20;
      opposition.batting = {
        technique: 20,
        timing: 20,
        power: 20,
        footwork: 20,
        temperament: 20,
        running: 20,
      };
      opposition.bowling = {
        paceOrSpin: 20,
        accuracy: 20,
        movement: 20,
        variations: 20,
        stamina: 20,
      };
    }
  }
  return save;
}

function freshBowlingSave(): SaveGame {
  const save = freshSave();
  (save as SaveGame & { qaCaptureOnly?: boolean }).qaCaptureOnly = true;
  const player = save.players.user;
  player.role = 'BOWLER';
  player.batting = {
    technique: 20,
    timing: 20,
    power: 20,
    footwork: 20,
    temperament: 20,
    running: 20,
  };
  player.bowlingStyle = 'PACE';
  save.tactics = {
    batting: save.tactics?.batting ?? 'BALANCED',
    bowling: 'ATTACK',
    field: save.tactics?.field,
  };
  for (const teamId of ['national-australia', 'national-england']) {
    const team = save.teams[teamId];
    for (const id of team.playerIds) {
      const opponent = save.players[id];
      if (!opponent) continue;
      opponent.overall = 85;
      opponent.batting = {
        technique: 85,
        timing: 85,
        power: 85,
        footwork: 85,
        temperament: 85,
        running: 85,
      };
    }
  }
  return save;
}

function testFixture(id: string, opponent: string): Fixture {
  return {
    id,
    seasonId: 'season-2050',
    format: 'TEST',
    homeTeamId: 'national-india',
    awayTeamId: `national-${opponent}`,
    venue: opponent === 'australia' ? 'Melbourne Cricket Ground' : 'Lord’s',
    round: 1,
    played: false,
    competition: 'BILATERAL_SERIES',
    competitionId: opponent === 'australia' ? 'TEST Tour of Australia' : 'TEST Tour of England',
  };
}

function selectedRuns(match: ReturnType<typeof runFixture>, playerId: string): number {
  return match.innings
    .flatMap((innings) => innings.batting)
    .filter((row) => row.playerId === playerId)
    .reduce((sum, row) => sum + row.runs, 0);
}

function addMatch(save: SaveGame, opponent: string, fixtureId: string, seedNumber: number) {
  const fixture = testFixture(fixtureId, opponent);
  save.fixtures[fixture.id] = fixture;
  save.id = `marketing-engine-seed-${seedNumber}`;
  const match = runFixture(save, fixture.id);
  applyResult(save, match);
  const runs = selectedRuns(match, save.userPlayerId!);
  const wickets = match.innings
    .flatMap((innings) => innings.bowling)
    .filter((row) => row.playerId === save.userPlayerId)
    .reduce((sum, row) => sum + row.wickets, 0);
  const story = buildNewspaperStory(save, match, {
    selected: true,
    runs,
    balls: match.innings
      .flatMap((innings) => innings.batting)
      .filter((row) => row.playerId === save.userPlayerId)
      .reduce((sum, row) => sum + row.balls, 0),
    wickets,
  });
  if (story) archiveNewspaperStory(save, story);
  return { match, runs, wickets, story };
}

describe('marketing capture engine scenarios', () => {
  jest.setTimeout(180_000);
  it('creates a deterministic engine-produced Player five-wicket capture save', () => {
    fs.mkdirSync(output, { recursive: true });
    const save = freshBowlingSave();
    const { match, wickets, story } = addMatch(save, 'england', 'capture-wicket-2', 2);

    expect(wickets).toBeGreaterThanOrEqual(5);
    expect(story?.newspaperCategory).toBe('FIVE_WICKET');
    expect(story?.wickets).toBe(wickets);
    expect(match.innings.flatMap((innings) => innings.bowling).some((row) => row.wickets >= 5)).toBe(
      true,
    );

    const file = path.join(output, 'player-engine-wicket-spell.json');
    fs.writeFileSync(file, JSON.stringify(save));
  });
  it('finds deterministic engine-produced Player Career centuries and away wins', () => {
    fs.mkdirSync(output, { recursive: true });
    const targets = [100, 200, 300];
    const chosen: SaveGame[] = [];
    let seed = 1;
    for (const target of targets) {
      let found: SaveGame | undefined;
      for (; seed < 3000; seed++) {
        const save = freshSave();
        const opponent = seed % 2 ? 'australia' : 'england';
        const { runs, wickets, story } = addMatch(save, opponent, `capture-test-${seed}`, seed);
        const won = save.fixtures[`capture-test-${seed}`].winnerTeamId === 'national-india';
        if (runs >= target && won && story) {
          chosen.push(save);
          found = save;
          seed++;
          break;
        }
        seed++;
        void wickets;
      }
      expect(found).toBeDefined();
    }
    for (const [index, save] of chosen.entries()) {
      const file = path.join(output, `player-engine-${[100, 200, 300][index]}.json`);
      fs.writeFileSync(file, JSON.stringify(save));
    }
  });

});
