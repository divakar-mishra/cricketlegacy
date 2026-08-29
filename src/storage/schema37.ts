import {
  ManagerClubSponsorshipState,
  SaveGame,
  SponsorshipOffer,
  SponsorshipState,
} from '../domain/types';
import { PREMIUM_SPONSOR_BRAND, withEarnedSponsorBrand } from '../game/sponsorBrands';

type SponsorLedger = Pick<
  SponsorshipState | ManagerClubSponsorshipState,
  'offers' | 'activeEarned' | 'history'
>;

function addEarnedBrandFields(offer: SponsorshipOffer): void {
  // Legacy story endorsements remain untouched until their separate product
  // and payout policy is approved.
  if (offer.id.startsWith('legacy:')) return;
  const branded = withEarnedSponsorBrand(offer);
  if (offer.brandId !== branded.brandId) offer.brandId = branded.brandId;
  if (offer.brandName !== branded.brandName) offer.brandName = branded.brandName;
}

function addLedgerBrandFields(state: SponsorLedger | undefined): void {
  if (!state) return;
  state.offers?.forEach(addEarnedBrandFields);
  if (state.activeEarned) addEarnedBrandFields(state.activeEarned);
  state.history?.forEach(addEarnedBrandFields);
}

/**
 * Persist approved code-native brand identities without changing a contract,
 * payment, balance, club owner or purchase binding.
 */
export function synchronizeSchema37SponsorBranding(save: SaveGame): void {
  addLedgerBrandFields(save.sponsorship);
  if (save.sponsorship?.premium) {
    save.sponsorship.premium.brandId = PREMIUM_SPONSOR_BRAND.id;
    save.sponsorship.premium.brandName = PREMIUM_SPONSOR_BRAND.name;
  }
  for (const club of Object.values(save.managerClubs ?? {})) {
    addLedgerBrandFields(club.sponsorship);
  }
}
