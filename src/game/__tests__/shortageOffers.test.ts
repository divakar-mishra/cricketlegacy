import { makeCareerSave, makeManagerSave } from './_depthHelpers';
import { shortageOffer } from '../shortageOffers';

describe('action-triggered shortage offers', () => {
  it('matches Player shortages without confusing wallet and club funds', () => {
    const save = makeCareerSave();
    expect(shortageOffer(save, 'energy')?.productId).toBe('form_recovery');
    expect(shortageOffer(save, 'coins', 5_000)?.productId).toBe('coins_medium');
    expect(shortageOffer(save, 'coins', 15_000)?.productId).toBe('coins_large');
    expect(shortageOffer(save, 'coins', 25_000)).toBeNull();
    expect(shortageOffer(save, 'transfer', 500_000)).toBeNull();
  });
  it('offers only a boost that covers the fee gap and remains eligible', () => {
    const save = makeManagerSave();
    expect(shortageOffer(save, 'transfer', 1_000_000)?.productId).toBe('transfer_budget_sm');
    expect(shortageOffer(save, 'transfer', 1_000_001)).toBeNull();
    expect(shortageOffer(save, 'transfer', 0)).toBeNull();
    save.flags = { ...save.flags, [`budgetBoost:transfer_budget_sm:${save.currentSeasonId ?? 'season'}`]: true };
    expect(shortageOffer(save, 'transfer', 1)).toBeNull();
    expect(shortageOffer(save, 'energy')).toBeNull();
  });
  it('does not upsell tokens already held or domestic products on national duty', () => {
    const save = makeManagerSave();
    save.inventory = { ...save.inventory, facility_upgrade_token: 1, squad_recovery_token: 1 };
    expect(shortageOffer(save, 'facility')).toBeNull();
    expect(shortageOffer(save, 'conditioning')).toBeNull();
    save.managerCareerLevel = 'NATIONAL';
    expect(shortageOffer(save, 'transfer', 1)).toBeNull();
  });
});
