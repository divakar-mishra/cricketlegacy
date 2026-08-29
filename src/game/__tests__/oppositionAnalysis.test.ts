import { isFieldSettingLegal } from '../../engine/intent';
import { nextUserFixtureId } from '../season';
import { buildOppositionReport } from '../oppositionAnalysis';
import { makeManagerSave } from './_depthHelpers';

function makeNeutralFieldRecommendation() {
  const save = makeManagerSave();
  const fixtureId = nextUserFixtureId(save)!;
  const initialReport = buildOppositionReport(save, fixtureId)!;
  const opponent = save.teams[initialReport.opponentTeamId];
  const selectedIds = opponent.xi?.length ? opponent.xi : opponent.playerIds.slice(0, 11);

  for (const playerId of selectedIds) {
    const player = save.players[playerId];
    player.batting.technique = 60;
    player.batting.footwork = 70;
    player.batting.temperament = 70;
  }

  return { save, fixtureId };
}

describe('opposition analysis recommendations', () => {
  it.each(['T20', 'ODI'] as const)('returns a legal opening field for a %s powerplay', (format) => {
    const { save, fixtureId } = makeNeutralFieldRecommendation();
    save.fixtures[fixtureId].format = format;

    const report = buildOppositionReport(save, fixtureId)!;

    expect(report.recommendedTactics.field).toBe('ATTACKING');
    expect(isFieldSettingLegal(report.recommendedTactics.field!, format, 0)).toBe(true);
  });

  it('keeps a balanced recommendation when the opening phase has no field restriction', () => {
    const { save, fixtureId } = makeNeutralFieldRecommendation();
    save.fixtures[fixtureId].format = 'TEST';

    const report = buildOppositionReport(save, fixtureId)!;

    expect(report.recommendedTactics.field).toBe('BALANCED');
    expect(isFieldSettingLegal(report.recommendedTactics.field!, 'TEST', 0)).toBe(true);
  });
});
