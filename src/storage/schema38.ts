import { SaveGame } from '../domain/types';
import { synchronizeLegacyEndorsementCampaigns } from '../game/sponsorship';

/**
 * v38 keeps story-event sponsors as off-shirt campaigns and frees the single
 * earned kit-partner slot. Any payout IDs written by the temporary legacy
 * mirror are copied back before that mirror is retired.
 */
export function synchronizeSchema38LegacyEndorsements(save: SaveGame): void {
  synchronizeLegacyEndorsementCampaigns(save);
}
