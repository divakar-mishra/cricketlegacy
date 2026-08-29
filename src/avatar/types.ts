export type AvatarSex = 'male' | 'female';

export type AvatarToneBand = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * Persisted avatar identity. Only stable portrait IDs are stored; image modules
 * and asset paths stay in the generated registry.
 */
export interface AvatarConfig {
  sex: AvatarSex;
  portraitId: string;
  frameId?: string;
}

export interface PortraitAssetMetadata {
  id: string;
  sex: AvatarSex;
  toneBand: AvatarToneBand;
  /** One-based position within the 64 portraits for this sex. */
  index: number;
}
