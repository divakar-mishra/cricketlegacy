import type { SaveGame } from '../domain/types';
import { shortageOffer, type ShortageKind } from '../game/shortageOffers';
import { GlassAlert } from './GlassAlertModal';

/** Only called in response to an explicit user action, never on render/timers. */
export function showShortageOffer(
  save: SaveGame, kind: ShortageKind, openProduct: (id: string) => void, shortfall = 0,
): boolean {
  const offer = shortageOffer(save, kind, shortfall);
  if (!offer) return false;
  GlassAlert.alert(offer.title, offer.body, [
    { text: 'Not now', style: 'cancel' },
    { text: 'View option', onPress: () => openProduct(offer.productId) },
  ], { cancelable: true });
  return true;
}
