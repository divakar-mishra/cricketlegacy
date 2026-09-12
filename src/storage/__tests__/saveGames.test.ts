// Slot eligibility is pure; do not load the native authentication client.
jest.mock('../../services/vipArchive', () => ({ syncVipArchive: jest.fn(async () => {}) }));

import { makeCareerSave } from '../../game/__tests__/_depthHelpers';
import { activateSeasonPass, SEASON_PASS_PERIOD_MS } from '../../game/seasonPass';
import { BASE_MAX_SLOTS, firstFreeSlot, SlotView } from '../saveGames';

function occupiedBaseSlots(): SlotView[] {
  return Array.from({ length: BASE_MAX_SLOTS }, (_, index) => ({
    slot: index + 1,
    save: makeCareerSave(index + 1),
  }));
}

describe('Season Pass save slot', () => {
  const now = Date.now();

  it('keeps slot six locked when no valid pass exists', () => {
    const slots = [...occupiedBaseSlots(), { slot: 6, save: null }];
    expect(firstFreeSlot(slots)).toBeNull();
  });

  it('unlocks slot six while any save in the mode has an active pass', () => {
    const slots = [...occupiedBaseSlots(), { slot: 6, save: null }];
    activateSeasonPass(slots[0].save!, {
      now,
      provider: 'REVENUECAT',
      expiresAt: now + SEASON_PASS_PERIOD_MS,
    });

    expect(firstFreeSlot(slots)).toBe(6);
  });

  it('never treats an occupied premium slot as free after expiry', () => {
    const passSave = makeCareerSave(20);
    activateSeasonPass(passSave, {
      now: now - SEASON_PASS_PERIOD_MS * 2,
      provider: 'REVENUECAT',
      expiresAt: now - SEASON_PASS_PERIOD_MS,
    });
    const slots = [...occupiedBaseSlots(), { slot: 6, save: passSave }];

    expect(firstFreeSlot(slots)).toBeNull();
    expect(slots[5].save).toBe(passSave);
  });
});
