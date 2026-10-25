import fs from 'node:fs';
import path from 'node:path';

// QA-only screenshots. Never ship these saves or describe their ratings as
// organically earned gameplay. The app imports them only with QA tools enabled.
const root = process.cwd();
const source = path.join(root, 'marketing/capture-2026-09/scenario-saves');
const destination = path.join(root, 'marketing/rigged-qa-2026-09-29');
fs.mkdirSync(destination, { recursive: true });

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
}

function setRating(player, rating) {
  for (const group of ['batting', 'bowling', 'fielding', 'meta']) {
    for (const key of Object.keys(player[group])) player[group][key] = rating;
  }
  player.overall = rating;
  player.potential = 99;
  player.condition = 100;
}

const career = read('career-capture-only.json');
career.id = 'marketing-99-player-2026-09-29';
career.qaCaptureOnly = true;
setRating(career.players[career.userPlayerId], 99);

const manager = read('manager-capture-only.json');
manager.id = 'marketing-elite-manager-2026-09-29';
manager.qaCaptureOnly = true;
const teams = [manager.userTeamId, manager.managerNationalTeamId].filter(Boolean);
for (const teamId of teams) {
  const ids = manager.teams[teamId]?.playerIds ?? [];
  ids.forEach((playerId, index) => {
    const player = manager.players[playerId];
    if (player) setRating(player, 99 - (index % 3));
  });
}

for (const [name, save] of [
  ['player-99-qa-only.json', career],
  ['manager-elite-qa-only.json', manager],
]) {
  fs.writeFileSync(path.join(destination, name), JSON.stringify(save));
}

console.log(`Wrote QA-only saves to ${destination}`);
