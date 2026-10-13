import type { Fixture, Player, SaveGame } from '../domain/types';

export function recoveredCondition(player: Player, fullFitness = false): number {
  const current = Math.max(0, Math.min(100, player.condition ?? player.meta.fitness ?? 70));
  return fullFitness ? 100 : Math.max(current, Math.min(95, current + 20));
}

export function benefitsFromRecovery(player: Player, fullFitness = false): boolean {
  if (player.injury) return false;
  return recoveredCondition(player, fullFitness) > (player.condition ?? player.meta.fitness ?? 70) ||
    (player.meta.fitness ?? 70) < 100 || (player.morale ?? 70) < 100;
}

/** Carry existing season-relative thresholds onto a lifetime fixture clock. */
export function ensureRecoveryClock(save: SaveGame): number {
  if (save.recoveryCompletedFixtures == null) {
    const played = Object.values(save.fixtures ?? {}).filter(f => f.played &&
      (f.homeTeamId === save.userTeamId || f.awayTeamId === save.userTeamId)).length;
    save.recoveryCompletedFixtures = played;
    // Preserve the remaining legal wait, inventory and real-time deadline.
    if (save.inventory) {
      for (const [key, duration] of [['squad_recovery_next_fixture', 3],
        ['full_fitness_recovery_next_fixture', 5]] as const) {
        if (save.inventory[key] > 0) {
          save.inventory[key] = played + Math.min(duration, Math.max(0, save.inventory[key] - played));
        }
      }
    }
  }
  return save.recoveryCompletedFixtures;
}

/** Called once, before the canonical fixture becomes played. AI fixtures do not count. */
export function recordRecoveryFixture(save: SaveGame, fixture: Fixture): void {
  const count = ensureRecoveryClock(save);
  if (save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL') return;
  if (save.userTeamId &&
      (fixture.homeTeamId === save.userTeamId || fixture.awayTeamId === save.userTeamId)) {
    save.recoveryCompletedFixtures = count + 1;
  }
}
