import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { makeCareerSave } from '../../game/__tests__/_depthHelpers';
import { runMigrations } from '../migrate';

describe('schema 38 off-shirt story endorsements', () => {
  it('retires the temporary kit mirror and carries its payment ledger to the campaign', () => {
    const legacy = makeCareerSave(38_001);
    legacy.schemaVersion = 37;
    legacy.sponsors = [
      {
        id: 'story-sponsor',
        brand: 'Willow & Co.',
        tier: 'LOCAL',
        perMatchCoins: 40,
        signingBonus: 300,
        seasonsLeft: 2,
      },
    ];
    legacy.sponsorship = {
      offers: [],
      activeEarned: {
        id: 'legacy:story-sponsor',
        mode: 'career',
        label: 'Legacy endorsement',
        scope: 'ALL_FORMATS',
        fixtureQuota: Number.MAX_SAFE_INTEGER,
        appearancePayout: 40,
        winBonus: 0,
        signingBonus: 0,
        termSeasonRollovers: 2,
        paymentDestination: 'WALLET_COINS',
        signedStature: 'DOMESTIC',
        acceptedSeasonId: legacy.currentSeasonId!,
        acceptedAt: 100,
        paidFixtureIds: ['already-paid'],
        paidFixtures: 1,
        paidWins: 0,
        seasonRollovers: 0,
        totalPaid: 40,
        status: 'ACTIVE',
        legacySponsorId: 'story-sponsor',
      },
      history: [],
      acceptedOfferSeasonIds: [],
      earnedThisSeason: 40,
      legacySponsorMigrationComplete: true,
    };
    const before = JSON.stringify({ wallet: legacy.wallet, premium: legacy.sponsorship.premium });

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.sponsorship?.activeEarned).toBeUndefined();
    expect(migrated.sponsorship?.history).not.toContainEqual(
      expect.objectContaining({ id: 'legacy:story-sponsor' }),
    );
    expect(migrated.sponsors?.[0]).toMatchObject({
      paidFixtureIds: ['already-paid'],
      totalPaid: 40,
      seasonsLeft: 2,
    });
    expect(
      JSON.stringify({ wallet: migrated.wallet, premium: migrated.sponsorship?.premium }),
    ).toBe(before);
  });

  it('is idempotent and does not create sponsorship state for a save without it', () => {
    const legacy = makeCareerSave(38_002);
    legacy.schemaVersion = 37;
    legacy.sponsorship = undefined;
    legacy.sponsors = [];

    const migrated = runMigrations(JSON.parse(JSON.stringify(legacy)))!;
    const again = runMigrations(JSON.parse(JSON.stringify(migrated)))!;

    expect(migrated.sponsorship).toBeUndefined();
    expect(again).toEqual(migrated);
  });
});
