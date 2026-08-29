import {
  activeSponsorBranding,
  activeSponsorDisplayName,
  acceptSponsorshipOffer,
  grantPremiumSponsorToCurrentSave,
  sponsorshipOffers,
} from '../sponsorship';
import {
  SPONSOR_BRANDS,
  SPONSOR_LOCKUP_BACKGROUND,
  earnedSponsorBrandFor,
  wcagContrastRatio,
} from '../sponsorBrands';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('approved sponsor brands', () => {
  it.each(Object.values(SPONSOR_BRANDS))(
    'keeps $name text and glyph ink WCAG-readable in light and dark app themes',
    (brand) => {
      // The lockup owns one opaque background, so app-theme surfaces cannot
      // weaken either its text or its non-text SVG strokes.
      expect(wcagContrastRatio(brand.primary, SPONSOR_LOCKUP_BACKGROUND)).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        wcagContrastRatio(brand.secondary, SPONSOR_LOCKUP_BACKGROUND),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('maps format identities without changing the contract scope', () => {
    expect(earnedSponsorBrandFor('ALL_FORMATS').name).toBe('Boundary Works');
    expect(earnedSponsorBrandFor('WHITE_BALL').name).toBe('Pulse XI');
    expect(earnedSponsorBrandFor('T20_ONLY').name).toBe('Pulse XI');
    expect(earnedSponsorBrandFor('RED_BALL').name).toBe('Longform');
    expect(earnedSponsorBrandFor('RESULTS').name).toBe('Longform');
    expect(SPONSOR_BRANDS.legacy_crown.name).toBe('Legacy Crown');
  });

  it('persists a distinct brand on all three Manager offers', () => {
    const save = makeManagerSave(37_101);
    const offers = sponsorshipOffers(save);
    expect(offers.map((offer) => offer.brandId)).toEqual([
      'boundary_works',
      'pulse_xi',
      'longform',
    ]);
    expect(offers.map((offer) => offer.scope)).toEqual(['ALL_FORMATS', 'T20_ONLY', 'RESULTS']);
  });

  it('returns earned and premium presentation as independent visible slots', () => {
    const save = makeCareerSave(37_102);
    save.sponsors = [];
    save.sponsorship = {
      seniorDomesticDebutFixtureId: 'verified-domestic-debut',
      offers: [],
      history: [],
      acceptedOfferSeasonIds: [],
      earnedThisSeason: 0,
      legacySponsorMigrationComplete: true,
      premium: {
        productId: 'player_save_sponsor',
        boundSaveId: save.id,
        grantedAt: 1,
        purchaseToken: 'verified-test',
        paidUtcWeekIds: [],
        paidFixtureIds: [],
        totalPaid: 0,
      },
    };
    save.careerPathLevel = 'DOMESTIC';
    const offer = sponsorshipOffers(save)[0];
    expect(acceptSponsorshipOffer(save, offer.id).ok).toBe(true);

    expect(activeSponsorBranding(save)).toEqual({
      earned: { brandId: 'boundary_works', brandName: 'Boundary Works' },
      premium: { brandId: 'legacy_crown', brandName: 'Legacy Crown' },
    });
  });

  it('hides every domestic club mark throughout Manager national duty', () => {
    const save = makeManagerSave(37_103);
    const offer = sponsorshipOffers(save)[0];
    expect(acceptSponsorshipOffer(save, offer.id).ok).toBe(true);
    expect(
      grantPremiumSponsorToCurrentSave(save, 'manager_save_sponsor', 'verified-national-hide').ok,
    ).toBe(true);
    expect(activeSponsorBranding(save).earned?.brandName).toBe('Boundary Works');
    expect(activeSponsorBranding(save).premium?.brandName).toBe('Legacy Crown');

    save.managerCareerLevel = 'NATIONAL';

    expect(activeSponsorBranding(save)).toEqual({});
    expect(activeSponsorDisplayName(save)).toBeUndefined();
  });
});
