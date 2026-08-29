import type { Fixture, SaveGame } from '../domain/types';

/** True for the separate Player Career T20 affiliation, including its playoffs. */
export function isPlayerFranchiseFixture(fixture?: Fixture): boolean {
  if (!fixture || fixture.competition === 'CUP') return false;
  if (fixture.competitionId === 't20-league') return true;
  return (
    fixture.format === 'T20' &&
    (fixture.playoff === true || !fixture.competitionId)
  );
}

/** Team whose contract owns this Player Career competition. */
export function playerAffiliationTeamId(
  save: SaveGame,
  competitionId?: string,
): string | undefined {
  if (save.mode === 'career' && competitionId === 't20-league') {
    return save.franchiseTeamId ?? save.userTeamId;
  }
  return save.userTeamId;
}
