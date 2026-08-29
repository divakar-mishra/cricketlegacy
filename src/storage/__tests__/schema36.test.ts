import { SAVE_SCHEMA_VERSION, SponsorshipContract } from '../../domain/types';
import { makeManagerSave } from '../../game/__tests__/_depthHelpers';
import {
  managerClubSponsorshipState,
  sponsorshipOffers,
} from '../../game/sponsorship';
import { runMigrations } from '../migrate';

describe('schema 36 Manager sponsorship ownership', () => {
  it('moves an existing earned deal to its club while preserving the save-owned premium grant', () => {
    const legacy = makeManagerSave(36_001);
    const oldClubId = legacy.userTeamId!;
    const newClubId = Object.keys(legacy.managerClubs!).find((id) => id !== oldClubId)!;
    const offer = sponsorshipOffers(legacy)[0];
    const contract: SponsorshipContract = {
      ...offer,
      acceptedSeasonId: legacy.currentSeasonId!,
      acceptedAt: 100,
      paidFixtureIds: ['legacy-fixture'],
      paidFixtures: 1,
      paidWins: 1,
      seasonRollovers: 0,
      totalPaid: offer.appearancePayout,
      status: 'ACTIVE',
      boundTeamId: oldClubId,
    };

    for (const club of Object.values(legacy.managerClubs!)) {
      delete (club as Partial<typeof club>).sponsorship;
    }
    legacy.schemaVersion = 35;
    legacy.userTeamId = newClubId;
    legacy.sponsorship = {
      offers: [],
      activeEarned: contract,
      history: [],
      acceptedOfferSeasonIds: [legacy.currentSeasonId!],
      earnedThisSeason: offer.appearancePayout,
      earnedSeasonId: legacy.currentSeasonId,
      premiumThisSeason: 30_000,
      premium: {
        productId: 'manager_save_sponsor',
        boundSaveId: legacy.id,
        grantedAt: 50,
        purchaseToken: 'verified-premium',
        paidUtcWeekIds: ['2026-08-10'],
        paidFixtureIds: ['legacy-fixture'],
        totalPaid: 30_000,
      },
      legacySponsorMigrationComplete: true,
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;
    const oldClub = managerClubSponsorshipState(migrated, oldClubId)!;
    const newClub = managerClubSponsorshipState(migrated, newClubId)!;

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(oldClub.activeEarned).toMatchObject({
      id: contract.id,
      boundTeamId: oldClubId,
      paidFixtures: 1,
    });
    expect(oldClub.earnedThisSeason).toBe(offer.appearancePayout);
    expect(newClub.premiumThisSeason).toBe(30_000);
    expect(migrated.sponsorship?.premium).toMatchObject({
      boundSaveId: legacy.id,
      purchaseToken: 'verified-premium',
    });
    expect(migrated.sponsorship?.activeEarned).toBeUndefined();
    expect(sponsorshipOffers(migrated)).toHaveLength(3);
  });

  it('routes a completed current-season deal to its historical club without blocking the new club', () => {
    const legacy = makeManagerSave(36_002);
    const oldClubId = legacy.userTeamId!;
    const newClubId = Object.keys(legacy.managerClubs!).find((id) => id !== oldClubId)!;
    const offer = sponsorshipOffers(legacy)[0];
    const completed: SponsorshipContract = {
      ...offer,
      acceptedSeasonId: legacy.currentSeasonId!,
      acceptedAt: 200,
      paidFixtureIds: ['completed-fixture'],
      paidFixtures: offer.fixtureQuota,
      paidWins: 0,
      seasonRollovers: 0,
      totalPaid: offer.appearancePayout * offer.fixtureQuota,
      status: 'QUOTA_REACHED',
      boundTeamId: oldClubId,
    };

    for (const club of Object.values(legacy.managerClubs!)) {
      delete (club as Partial<typeof club>).sponsorship;
    }
    legacy.schemaVersion = 35;
    legacy.userTeamId = newClubId;
    legacy.sponsorship = {
      offers: [],
      history: [completed],
      acceptedOfferSeasonIds: [legacy.currentSeasonId!],
      earnedThisSeason: completed.totalPaid,
      earnedSeasonId: legacy.currentSeasonId,
      premiumThisSeason: 0,
      legacySponsorMigrationComplete: true,
    };

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;
    const oldClub = managerClubSponsorshipState(migrated, oldClubId)!;
    const newClub = managerClubSponsorshipState(migrated, newClubId)!;

    expect(oldClub.history).toHaveLength(1);
    expect(oldClub.acceptedOfferSeasonIds).toContain(legacy.currentSeasonId);
    expect(oldClub.earnedThisSeason).toBe(completed.totalPaid);
    expect(newClub.acceptedOfferSeasonIds).not.toContain(legacy.currentSeasonId);
    expect(newClub.earnedThisSeason).toBe(0);
    expect(sponsorshipOffers(migrated)).toHaveLength(3);
  });
});
