import type { SaveGame } from '../domain/types';
import { managerClubOperationsPaused } from './managerClubState';

export type ShortageKind = 'energy' | 'coins' | 'transfer' | 'facility' | 'conditioning';
export function shortageOffer(save: SaveGame, kind: ShortageKind, shortfall = 0) {
  if (kind === 'energy' && save.mode === 'career') return {
    productId: 'form_recovery', title: 'Mental Coaching Session',
    body: 'Raises form and confidence to at least 99 and refills Focus to 36, or 60 with VIP, in this Player save. You can also wait for free Focus recovery or review the existing recovery options in the store.',
  };
  if (kind === 'coins' && save.mode === 'career' && shortfall > 0 && shortfall <= 20_000) return {
    productId: shortfall <= 10_000 ? 'coins_medium' : 'coins_large', title: 'Short on training coins?',
    body: 'An optional Wallet Coin pack can cover this session’s shortfall. You can also earn coins through play and return later.',
  };
  if (save.mode !== 'manager' || managerClubOperationsPaused(save)) return null;
  if (kind === 'transfer' && shortfall > 0 && shortfall <= 1_000_000 &&
      !save.flags?.[`budgetBoost:transfer_budget_sm:${save.currentSeasonId ?? 'season'}`]) return {
    productId: 'transfer_budget_sm', title: 'Short on club funds?',
    body: 'Transfer Budget Boost adds $1,000,000 fictional club funds to this save, once per season. It covers this fee shortfall; squad, wage and transfer rules still apply. You can also choose a cheaper target.',
  };
  if (kind === 'facility' && (save.inventory?.facility_upgrade_token ?? 0) === 0) return {
    productId: 'facility_upgrade_token', title: 'Upgrade with a token?',
    body: 'One Instant Facility Upgrade token adds one level to Training Ground, Medical Centre or Youth Academy. Normal upkeep remains. You can also save club funds and upgrade later.',
  };
  if (kind === 'conditioning' && (save.inventory?.squad_recovery_token ?? 0) === 0) return {
    productId: 'recovery_pack', title: 'Squad Conditioning Pack',
    body: 'One token adds 20 condition, 20 fitness and 15 morale to eligible non-injured players in this save. It does not heal injuries. You can also rest and rotate players.',
  };
  return null;
}
