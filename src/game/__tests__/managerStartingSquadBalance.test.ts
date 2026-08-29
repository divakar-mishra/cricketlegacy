import { buildManagerLeagueWorld } from '../../generation/world';

function tierAverage(world: ReturnType<typeof buildManagerLeagueWorld>, tier: 1 | 2 | 3): number {
  const teamIds =
    tier === 1
      ? world.divisions.tier1
      : tier === 2
        ? world.divisions.tier2
        : world.divisions.tier3!;
  const ratings = teamIds.flatMap((teamId) =>
    world.teams[teamId].playerIds.map((playerId) => world.players[playerId].overall),
  );
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

describe('manager starting squad balance', () => {
  it.each(['india', 'australia', 'south_africa', 'ireland'])(
    'genuinely scales %s squads down across each lower tier',
    (country) => {
      const world = buildManagerLeagueWorld(20260811, {
        country,
        userDivision: 3,
        requiredTeamId: `manager_${country}_t3_1`,
      });
      const tier1 = tierAverage(world, 1);
      const tier2 = tierAverage(world, 2);
      const tier3 = tierAverage(world, 3);

      expect(tier1 - tier2).toBeGreaterThan(5);
      expect(tier2 - tier3).toBeGreaterThan(5);
    },
  );
});
