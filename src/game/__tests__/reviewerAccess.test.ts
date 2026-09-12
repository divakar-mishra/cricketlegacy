import { applyReviewerSupplies } from '../reviewerAccess';
import type { SaveGame } from '../../domain/types';
function fixture(mode = 'career'): SaveGame {
  return { mode, userPlayerId: 'p', players: { p: { meta: { form: 40, confidence: 50 } } },
    inventory: {}, wallet: { coins: 123, gems: 4, energy: 5 } } as unknown as SaveGame;
}
test('coaching preserves currency and higher values', () => {
  const save = fixture();
  expect(applyReviewerSupplies(save, 60)).toBe(true);
  expect(save.players.p.meta.form).toBe(99);
  expect(save.wallet).toMatchObject({ coins: 123, gems: 4, energy: 60 });
  save.players.p.meta.form = 100;
  save.wallet.energy = 70;
  applyReviewerSupplies(save, 60);
  expect(save.players.p.meta.form).toBe(100);
  expect(save.wallet.energy).toBe(70);
});
test('tokens top up without stacking; other inventory remains unchanged', () => {
  const save = fixture('manager');
  save.inventory = { facility_upgrade_token: 3 };
  applyReviewerSupplies(save, 36);
  applyReviewerSupplies(save, 36);
  expect(save.inventory).toEqual({ facility_upgrade_token: 3, scout_full_reveal_token: 1, squad_recovery_token: 1 });
  save.inventory.scout_full_reveal_token = 4;
  applyReviewerSupplies(save, 36);
  expect(save.inventory.scout_full_reveal_token).toBe(4);
});
test('national duty and missing player fail without granting', () => {
  const manager = fixture('manager');
  manager.managerCareerLevel = 'NATIONAL';
  expect(applyReviewerSupplies(manager, 36)).toBe(false);
  expect(manager.inventory).toEqual({});
  const player = fixture();
  player.players = {};
  expect(applyReviewerSupplies(player, 36)).toBe(false);
  expect(player.wallet.energy).toBe(5);
});
