import fs from 'fs';
import path from 'path';

jest.mock('../supabaseClient', () => ({
  currentRecoverableSupabaseUserId: jest.fn(async () => null),
  getSupabaseClient: jest.fn(() => null),
  isSupabaseBackendEnabled: jest.fn(() => false),
}));

import { makeCareerSave } from '../../game/__tests__/_depthHelpers';
import {
  deletePremiumSponsorExactSave,
  parsePremiumSponsorSaveDeletionResponse,
} from '../premiumSponsorSave';

const root = path.join(__dirname, '..', '..', '..');

function saveWithPremium() {
  const save = makeCareerSave(38_900);
  save.sponsorship = {
    offers: [],
    history: [],
    acceptedOfferSeasonIds: [],
    earnedThisSeason: 0,
    legacySponsorMigrationComplete: true,
    premium: {
      productId: 'player_save_sponsor',
      boundSaveId: save.id,
      grantedAt: 1,
      purchaseToken: 'verified-transaction',
      paidUtcWeekIds: [],
      paidFixtureIds: [],
      totalPaid: 0,
    },
  };
  return save;
}

describe('exact-save premium sponsor deletion', () => {
  it('accepts only an exact, positively counted server confirmation', () => {
    const save = saveWithPremium();
    expect(
      parsePremiumSponsorSaveDeletionResponse(
        {
          ok: true,
          status: 'deleted',
          productId: 'player_save_sponsor',
          saveId: save.id,
          deletedBindings: 1,
        },
        save,
      ),
    ).toEqual({ status: 'DELETED' });
    expect(
      parsePremiumSponsorSaveDeletionResponse(
        {
          ok: true,
          status: 'deleted',
          productId: 'player_save_sponsor',
          saveId: 'career-someone-else',
          deletedBindings: 1,
        },
        save,
      ).status,
    ).toBe('FAILED');
  });

  it('deletes development-only mock grants locally without claiming a server binding', async () => {
    const save = saveWithPremium();
    save.sponsorship!.premium!.purchaseToken = 'mock:player_save_sponsor:1';
    await expect(deletePremiumSponsorExactSave(save)).resolves.toEqual({ status: 'LOCAL_ONLY' });
  });

  it('requires server confirmation before Saved Games removes a purchased local save', () => {
    const screen = fs.readFileSync(
      path.join(root, 'src', 'screens', 'SavedGamesScreen.tsx'),
      'utf8',
    );
    expect(screen.indexOf('deletePremiumSponsorExactSave(save)')).toBeLessThan(
      screen.indexOf('deleteSave(mode, slot)'),
    );
    expect(screen).toContain("result.status !== 'DELETED'");
    expect(screen).toContain('Nothing was deleted.');
  });
});
