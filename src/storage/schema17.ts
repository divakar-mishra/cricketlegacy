import { SaveGame } from '../domain/types';
import {
  activateSeasonPass,
  SEASON_PASS_PERIOD_MS,
  synchronizeSeasonPassState,
} from '../game/seasonPass';

/** Idempotent schema-17 defaults retained for recurring pass migration. */
export function synchronizeSchema17State(save: SaveGame, timestamp: number): void {
  const safeTimestamp =
    Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.UTC(2026, 0, 1);
  save.entitlements ??= { removeAds: false };
  const legacyPass = save.pass as SaveGame['pass'] | undefined;
  const legacyProgress = legacyPass
    ? {
        xp: Math.max(0, legacyPass.xp ?? 0),
        balanceVersion: legacyPass.balanceVersion,
        claimedFree: [...(legacyPass.claimedFree ?? [])],
        claimedPremium: [...(legacyPass.claimedPremium ?? [])],
      }
    : undefined;
  const legacyEntitlement = save.entitlements.seasonPass as
    SaveGame['entitlements']['seasonPass'] | undefined;
  const legacyPremium = Boolean(legacyPass?.premium || legacyEntitlement?.premium);
  const hasRecurringFields = Boolean(
    legacyEntitlement?.expiresAt && legacyEntitlement.periodStartedAt,
  );

  if (legacyPremium && !hasRecurringFields) {
    activateSeasonPass(save, {
      now: safeTimestamp,
      periodStartedAt: safeTimestamp,
      expiresAt: safeTimestamp + SEASON_PASS_PERIOD_MS,
      lastVerifiedAt: safeTimestamp,
      provider: 'LEGACY_MIGRATION',
      willRenew: false,
    });
  } else {
    synchronizeSeasonPassState(save, safeTimestamp);
  }
  if (legacyProgress && legacyPass?.periodStartedAt == null && save.pass) {
    save.pass.xp = legacyProgress.xp;
    save.pass.balanceVersion = legacyProgress.balanceVersion;
    save.pass.claimedFree = legacyProgress.claimedFree;
    save.pass.claimedPremium = legacyProgress.claimedPremium;
    synchronizeSeasonPassState(save, safeTimestamp);
  }

  save.cosmetics ??= {
    avatar: 'avatar_custom',
    kit: 'kit_white',
    celebration: 'cel_wave',
  };
  save.cosmetics.avatar = 'avatar_custom';
  save.cosmetics.profileFrame ??= 'frame_none';
  save.cosmetics.stadiumTheme ??= 'stadium_classic';
  save.cosmetics.officeTheme ??= 'office_classic';
}
