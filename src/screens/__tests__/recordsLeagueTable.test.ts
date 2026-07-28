import fs from 'fs';
import path from 'path';

const recordsScreen = fs.readFileSync(path.join(__dirname, '..', 'RecordsScreen.tsx'), 'utf8');

describe('manager records league table', () => {
  it('exposes the canonical league table columns in Records', () => {
    expect(recordsScreen).toContain('LeagueTable');
    expect(recordsScreen).toContain("import { standings } from '../game/season'");
    expect(recordsScreen).toContain("save.mode === 'manager' ? standings(save) : []");
    expect(recordsScreen).toContain('League Table');
    expect(recordsScreen).toContain('P W L T NR Pts NRR are rebuilt from the canonical standings.');
    expect(recordsScreen).toContain('highlightTeamId={save.userTeamId}');
  });
});

describe('records achievements economy copy', () => {
  it('shows achievement gem rewards from the canonical tier policy', () => {
    expect(recordsScreen).toContain('achievementGemReward');
    expect(recordsScreen).toContain("from '../game/achievements'");
    expect(recordsScreen).toMatch(/\+\s*\{achievementGemReward\(a\.tier\)\}/);
  });
});

describe('manager Hall of Fame copy', () => {
  it('shows manager-specific legacy fields instead of a player-only board', () => {
    expect(recordsScreen).toContain("type HofTab = 'players' | 'managers'");
    expect(recordsScreen).toMatch(
      /Club\s+trophies, league finishes, win rate and elite players produced\./,
    );
    expect(recordsScreen).toContain('label="Win %"');
    expect(recordsScreen).toContain('label="W-L-D"');
    expect(recordsScreen).toContain('label="Legends"');
  });
});
