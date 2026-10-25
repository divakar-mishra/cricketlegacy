import { SAVE_SCHEMA_VERSION, type GameMode, type SaveGame } from '../domain/types';
import { saveSubtitle, saveTitle } from '../game/saveMeta';
import { hasModeVip } from '../game/vip';

/** Disposable display metadata, not a save, entitlement or ownership authority. */
export interface SaveSummary {
  version: 1;
  schemaVersion: number;
  saveSchemaVersion: number;
  id: string;
  mode: GameMode;
  token: string;
  updatedAt: number;
  title: string;
  subtitle: string;
  seasonYear?: number;
  lastMatchWon?: boolean | null;
  hasMatchHistory: boolean;
  coins?: number;
  premiumPermanent: boolean;
  passExpiresAt: number;
  passVerifiedAt: number;
  /** Present only after a cold verified read, using the existing cloud checksum contract. */
  checkedChecksum?: string;
}

export function summarizeSave(save: SaveGame, token: string): SaveSummary {
  return {
    version: 1, schemaVersion: SAVE_SCHEMA_VERSION, saveSchemaVersion: save.schemaVersion,
    id: save.id, mode: save.mode, token, updatedAt: save.updatedAt,
    title: saveTitle(save), subtitle: saveSubtitle(save),
    seasonYear: save.currentSeasonId ? save.seasons?.[save.currentSeasonId]?.year : undefined,
    lastMatchWon: save.lastMatchWon, hasMatchHistory: save.careerWins != null,
    coins: save.wallet?.coins, premiumPermanent: hasModeVip(save),
    passExpiresAt: save.entitlements?.seasonPass?.premium ? save.entitlements.seasonPass.expiresAt : 0,
    passVerifiedAt: save.entitlements?.seasonPass?.lastVerifiedAt ?? 0,
  };
}

export function validSummary(value: unknown, mode: GameMode): value is SaveSummary {
  const v = value as SaveSummary | null;
  return Boolean(v && v.version === 1 && v.schemaVersion === SAVE_SCHEMA_VERSION && v.mode === mode && typeof v.id === 'string' && v.id &&
    Number.isInteger(v.saveSchemaVersion) && v.saveSchemaVersion <= SAVE_SCHEMA_VERSION &&
    typeof v.token === 'string' && v.token && Number.isFinite(v.updatedAt) &&
    typeof v.title === 'string' && typeof v.subtitle === 'string' &&
    typeof v.premiumPermanent === 'boolean' && Number.isFinite(v.passExpiresAt) && Number.isFinite(v.passVerifiedAt));
}

export function summaryHasPremium(summary: SaveSummary | null, now = Date.now()): boolean {
  return Boolean(summary && (summary.premiumPermanent ||
    (summary.passExpiresAt > now && now + 5 * 60 * 1000 >= summary.passVerifiedAt)));
}
