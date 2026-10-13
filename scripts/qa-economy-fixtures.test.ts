import fs from 'node:fs';
import path from 'node:path';
import { makeCareerSave, makeManagerSave } from '../src/game/__tests__/_depthHelpers';
import { buildPlayerSeasonCalendar } from '../src/game/playerCalendar';
import { nextUserFixtureId } from '../src/game/season';
import { resolveNextCareerStep } from '../src/game/careerStep';

// Explicitly opt-in emulator fixtures; never changes a real career.
test('emit isolated economy and off-season emulator fixtures', () => {
  const output = process.env.QA_ECONOMY_FIXTURE_DIR;
  if (!output) return;
  const runId = process.env.QA_ECONOMY_RUN_ID ?? '';
  if (runId && !/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('Invalid QA run ID');
  const player = makeCareerSave(99101);
  player.id = 'qa-economy-player-20261011';
  player.players[player.userPlayerId!].name = 'QA Economy Player';
  player.players[player.userPlayerId!].age = 21;
  player.players[player.userPlayerId!].contract = { wage: 1000, yearsLeft: 0 };
  player.careerPathLevel = 'DOMESTIC';
  player.wallet.coins = 1000;
  player.wallet.gems = 100;
  player.inventory = { ...player.inventory, contract_boost_token: 2 };
  if (player.story) {
    player.story.pendingEventIds = [];
    player.story.seenEventIds.push('career_start');
  }

  const offSeason = makeCareerSave(99102);
  offSeason.id = 'qa-off-season-player-20261011';
  offSeason.players[offSeason.userPlayerId!].name = 'QA Off Season';
  offSeason.players[offSeason.userPlayerId!].age = 21;
  offSeason.careerPathLevel = 'DOMESTIC';
  if (offSeason.story) {
    offSeason.story.pendingEventIds = [];
    offSeason.story.seenEventIds.push('career_start');
  }
  nextUserFixtureId(offSeason);
  const pending = Object.values(offSeason.fixtures).find(f =>
    f.competitionId === 't20-league' && f.homeTeamId !== offSeason.userTeamId &&
    f.awayTeamId !== offSeason.userTeamId)!;
  for (const fixture of Object.values(offSeason.fixtures)) {
    fixture.played = fixture.id !== pending.id;
    if (fixture.played) {
      fixture.winnerTeamId = fixture.homeTeamId === offSeason.userTeamId
        ? fixture.awayTeamId : fixture.homeTeamId;
      fixture.resultKind = fixture.winnerTeamId === fixture.homeTeamId ? 'HOME_WIN' : 'AWAY_WIN';
    }
  }
  for (const event of buildPlayerSeasonCalendar(offSeason)!.events) event.completed = true;
  offSeason.currentMonth = 8;
  offSeason.wallet.coins = 0;
  offSeason.wallet.gems = 0;
  offSeason.wallet.energy = 0;
  expect(resolveNextCareerStep(offSeason).action).toBe('ADVANCE_CAREER_CALENDAR');

  const manager = makeManagerSave(99103);
  manager.id = 'qa-economy-manager-20261011';
  manager.inventory = { ...manager.inventory, squad_recovery_token: 2 };
  manager.recoveryCompletedFixtures = 0;
  manager.wallet.coins = 1000;
  const squad = manager.teams[manager.userTeamId!].playerIds.map(id => manager.players[id]);
  squad.forEach((p, index) => {
    delete p.injury;
    p.condition = index < 3 ? 40 : 100;
    p.meta.fitness = 100;
    p.morale = 100;
  });

  const injuredManager = structuredClone(manager);
  injuredManager.id = 'qa-all-injured-manager-20261011';
  injuredManager.wallet.coins = 0;
  injuredManager.wallet.gems = 0;
  injuredManager.teams[injuredManager.userTeamId!].playerIds.forEach((id) => {
    injuredManager.players[id].condition = 40;
    injuredManager.players[id].injury = { type: 'QA recovery', severity: 'SERIOUS', matchesOut: 8 };
  });
  const intro = makeCareerSave(99104);
  intro.id = 'qa-story-player-20261011';
  intro.players[intro.userPlayerId!].name = 'QA Story Player';
  intro.wallet.coins = 0;
  intro.wallet.gems = 0;

  fs.mkdirSync(output, { recursive: true });
  for (const [name, save] of Object.entries({ player, offseason: offSeason, manager, injuredManager, intro })) {
    if (runId) save.id += `-${runId}`;
    fs.writeFileSync(path.join(output, `qa-${name}.json`), JSON.stringify(save));
  }
});
