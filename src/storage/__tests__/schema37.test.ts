import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { makeCareerSave, makeManagerSave } from '../../game/__tests__/_depthHelpers';
import {
  acceptSponsorshipOffer,
  activeEarnedSponsorContract,
  ensureSponsorshipState,
  grantPremiumSponsorToCurrentSave,
  sponsorshipOffers,
} from '../../game/sponsorship';
import { runMigrations } from '../migrate';

describe('schema 37 dynamic sponsor branding', () => {
  function eraseBrandFields(save: ReturnType<typeof makeCareerSave>): void {
    const eraseLedger = (ledger: typeof save.sponsorship | undefined) => {
      if (!ledger) return;
      for (const record of [
        ...(ledger.offers ?? []),
        ...(ledger.activeEarned ? [ledger.activeEarned] : []),
        ...(ledger.history ?? []),
      ]) {
        delete record.brandId;
        delete record.brandName;
      }
    };
    eraseLedger(save.sponsorship);
    if (save.sponsorship?.premium) {
      delete save.sponsorship.premium.brandId;
      delete save.sponsorship.premium.brandName;
    }
    for (const club of Object.values(save.managerClubs ?? {})) {
      eraseLedger(club.sponsorship as typeof save.sponsorship);
    }
  }

  it('brands old Player contracts and grants without changing economy or purchase binding', () => {
    const legacy = makeCareerSave(37_201);
    legacy.sponsors = [];
    legacy.careerPathLevel = 'DOMESTIC';
    const state = ensureSponsorshipState(legacy);
    state.seniorDomesticDebutFixtureId = 'verified-domestic-debut';
    const offer = sponsorshipOffers(legacy).find((candidate) => candidate.scope === 'RED_BALL')!;
    acceptSponsorshipOffer(legacy, offer.id, 100);
    grantPremiumSponsorToCurrentSave(legacy, 'player_save_sponsor', 'verified-token', 200);
    delete legacy.sponsorship?.activeEarned?.brandId;
    delete legacy.sponsorship?.activeEarned?.brandName;
    if (legacy.sponsorship?.premium) {
      delete legacy.sponsorship.premium.brandId;
      delete legacy.sponsorship.premium.brandName;
    }
    legacy.schemaVersion = 36;
    const balancesBefore = JSON.stringify({ wallet: legacy.wallet, totalPaid: state.premium?.totalPaid });

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.sponsorship?.activeEarned).toMatchObject({
      brandId: 'longform',
      brandName: 'Longform',
      scope: 'RED_BALL',
    });
    expect(migrated.sponsorship?.premium).toMatchObject({
      brandId: 'legacy_crown',
      brandName: 'Legacy Crown',
      boundSaveId: legacy.id,
      purchaseToken: 'verified-token',
    });
    expect(JSON.stringify({
      wallet: migrated.wallet,
      totalPaid: migrated.sponsorship?.premium?.totalPaid,
    })).toBe(balancesBefore);
  });

  it('brands club-owned Manager contracts without moving their owner', () => {
    const legacy = makeManagerSave(37_202);
    const teamId = legacy.userTeamId!;
    const offer = sponsorshipOffers(legacy).find((candidate) => candidate.scope === 'RESULTS')!;
    acceptSponsorshipOffer(legacy, offer.id, 300);
    const contract = activeEarnedSponsorContract(legacy)!;
    delete contract.brandId;
    delete contract.brandName;
    legacy.schemaVersion = 36;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;

    expect(activeEarnedSponsorContract(migrated)).toMatchObject({
      brandId: 'longform',
      brandName: 'Longform',
      scope: 'RESULTS',
      boundTeamId: teamId,
    });
  });

  it('changes only brand fields, never debut, economy, ownership or ledger state', () => {
    const legacy = makeManagerSave(37_203);
    const teamId = legacy.userTeamId!;
    const offer = sponsorshipOffers(legacy)[0];
    acceptSponsorshipOffer(legacy, offer.id, 444);
    legacy.schemaVersion = 36;
    const clubLedger = legacy.managerClubs![teamId].sponsorship;
    clubLedger.earnedThisSeason = -27;
    clubLedger.premiumThisSeason = -31;
    clubLedger.acceptedOfferSeasonIds.push('sentinel-season');
    clubLedger.activeEarned!.paidFixtureIds.push('sentinel-fixture');
    legacy.sponsorship ??= ensureSponsorshipState(legacy);
    delete legacy.sponsorship.seniorDomesticDebutFixtureId;
    legacy.sponsorship.legacySponsorMigrationComplete = false;
    legacy.sponsorship.earnedThisSeason = -45;
    legacy.sponsorship.premiumThisSeason = -63;
    const expected = JSON.parse(JSON.stringify(legacy));
    eraseBrandFields(legacy);
    eraseBrandFields(expected);
    expected.schemaVersion = SAVE_SCHEMA_VERSION;
    // Later migrations add empty VIP collection bookkeeping, not ownership or rewards.
    expected.vipCollections = {
      version: 1, mode: 'manager', owned: [], settledSeasons: [], credits: 0,
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;
    eraseBrandFields(migrated);

    expect(migrated).toEqual(expected);
    expect(migrated.sponsorship?.seniorDomesticDebutFixtureId).toBeUndefined();
    expect(migrated.sponsorship?.legacySponsorMigrationComplete).toBe(false);
    expect(migrated.managerClubs?.[teamId].sponsorship.activeEarned?.boundTeamId).toBe(teamId);
  });

  it('does not create sponsorship state when schema 36 had none', () => {
    const legacy = makeCareerSave(37_204);
    legacy.schemaVersion = 36;
    legacy.sponsorship = undefined;

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.sponsorship).toBeUndefined();
  });
});
