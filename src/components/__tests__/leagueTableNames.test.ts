import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(__dirname, '..', 'LeagueTable.tsx'), 'utf8');

describe('league table team labels', () => {
  it('shows the full club identity before its compact abbreviation', () => {
    expect(source).toContain("teams[r.teamId]?.name ?? teams[r.teamId]?.shortName ?? 'Team'");
  });
});
