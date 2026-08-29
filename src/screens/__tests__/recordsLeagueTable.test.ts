import fs from 'fs';
import path from 'path';

const recordsScreen = fs.readFileSync(path.join(__dirname, '..', 'RecordsScreen.tsx'), 'utf8');

describe('manager records league table', () => {
  it('keeps detailed manager-level progression in Records instead of cluttering Home', () => {
    expect(recordsScreen).toContain('Manager Career');
    expect(recordsScreen).toContain('MANAGER_LEVEL_LABEL[level]');
    expect(recordsScreen).toContain('allowedCompetitionIds(level)');
    expect(recordsScreen).toContain('checkManagerLevelPromotion(save)');
    expect(recordsScreen).toContain('upcomingIccEvents(year, 4)');
  });

  it('exposes the canonical league table columns in Records', () => {
    expect(recordsScreen).toContain('LeagueTable');
    expect(recordsScreen).toContain(
      "import { activeCompetitionTable } from '../game/competitionTable'",
    );
    expect(recordsScreen).toContain(
      "save.mode === 'manager' ? activeCompetitionTable(save) : null",
    );
    expect(recordsScreen).toContain('League Table');
    expect(recordsScreen).toContain('highlightTeamId={save.userTeamId}');
    expect(recordsScreen).not.toContain(
      'P W L T NR Pts NRR are rebuilt from the canonical standings.',
    );
    expect(recordsScreen.indexOf("managerCompetitionTable?.title ?? 'League Table'")).toBeLessThan(
      recordsScreen.indexOf('managerRecords.competitionLabel} Season Leaders'),
    );
  });

  it('shows only the active manager format and marks managed players in gold', () => {
    expect(recordsScreen).toContain('activeManagerRecords(save)');
    expect(recordsScreen).not.toContain('Only {managerRecords.competitionLabel} performances');
    expect(recordsScreen).toContain('{managerRecords.competitionLabel} Season Leaders');
    expect(recordsScreen).toContain('managerRecordRowManaged');
    expect(recordsScreen).toContain('row.isManagedPlayer && styles.managerRecordGold');
    expect(recordsScreen).toContain('Most Runs');
    expect(recordsScreen).toContain('Most Wickets');
    expect(recordsScreen).toContain('High Scores');
    expect(recordsScreen).toContain('Best Bowling');
  });
});

describe('records achievements economy copy', () => {
  it('shows achievement gem rewards from the canonical tier policy', () => {
    expect(recordsScreen).toContain('achievementGemReward');
    expect(recordsScreen).toContain("from '../game/achievements'");
    expect(recordsScreen).toMatch(/\+\s*\{achievementGemReward\(a\.tier\)\}/);
  });
});

describe('player competition records', () => {
  it('separates Grade A, domestic formats and senior international formats', () => {
    for (const scope of [
      'GRADE_A',
      'U19',
      'U19_WORLD_CUP',
      'DOMESTIC_T20',
      'LIST_A',
      'FIRST_CLASS',
      'T20I',
      'ODI',
      'TEST',
    ]) {
      expect(recordsScreen).toContain(`'${scope}'`);
    }
    expect(recordsScreen).toContain('me.competitionStats?.[statView]');
  });
});

describe('manager Hall of Fame copy', () => {
  it('shows manager-specific legacy fields instead of a player-only board', () => {
    expect(recordsScreen).toContain("type HofTab = 'players' | 'managers'");
    expect(recordsScreen).not.toMatch(/Club\s+trophies, league finishes/);
    expect(recordsScreen).toContain('Current Manager Career');
    expect(recordsScreen).toContain('label="Win %"');
    expect(recordsScreen).toContain('label="W-L-D"');
    expect(recordsScreen).toContain('label="Legends"');
  });
});
