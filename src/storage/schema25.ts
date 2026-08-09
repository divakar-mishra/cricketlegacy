import { SaveGame } from '../domain/types';

/**
 * Remove only unplayed knockout placeholders produced by the old eager ICC
 * scheduler. Played history remains untouched and dynamic tournament state is
 * reconstructed from group fixtures by the calendar engine.
 */
export function synchronizeSchema25State(save: SaveGame): void {
  save.internationalTournaments ??= {};

  const obsoleteIds = new Set(
    Object.values(save.fixtures ?? {})
      .filter(
        (fixture) =>
          !fixture.played &&
          fixture.competition === 'INTL_TOURNAMENT' &&
          fixture.competitionId?.startsWith('world-test-championship-') !== true &&
          (fixture.cupRound === 'Semi-Final' || fixture.cupRound === 'Final'),
      )
      .map((fixture) => fixture.id),
  );
  if (!obsoleteIds.size) return;

  for (const fixtureId of obsoleteIds) delete save.fixtures[fixtureId];
  for (const season of Object.values(save.seasons ?? {})) {
    season.fixtureIds = season.fixtureIds.filter((fixtureId) => !obsoleteIds.has(fixtureId));
    for (const competition of season.competitions ?? []) {
      competition.fixtureIds = competition.fixtureIds.filter(
        (fixtureId) => !obsoleteIds.has(fixtureId),
      );
    }
  }
}
