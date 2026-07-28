import {
  contractOffer,
  ensureUserContract,
  maybeNationalCaptaincy,
  signUserContract,
  tickUserContract,
  userContractExpiring,
} from '../career';
import { makeCareerSave } from './_depthHelpers';

describe('career contracts', () => {
  it('gives the user a starting contract (idempotent)', () => {
    const save = makeCareerSave();
    ensureUserContract(save);
    const c = save.players[save.userPlayerId!].contract;
    expect(c).toBeDefined();
    expect(c!.yearsLeft).toBeGreaterThan(0);
    const wageBefore = c!.wage;
    ensureUserContract(save); // no-op second time
    expect(save.players[save.userPlayerId!].contract!.wage).toBe(wageBefore);
  });

  it('offers a bigger deal to capped internationals', () => {
    const save = makeCareerSave();
    const uncapped = contractOffer(save);
    save.capped = true;
    save.userCaps = 20;
    const capped = contractOffer(save);
    expect(capped.wage).toBeGreaterThan(uncapped.wage);
    expect(capped.signingBonus).toBeGreaterThan(0);
  });

  it('signing applies the deal and pays a bonus; ticking expires it', () => {
    const save = makeCareerSave();
    const offer = contractOffer(save);
    const bonus = signUserContract(save, offer);
    expect(bonus).toBeGreaterThan(0);
    const c = save.players[save.userPlayerId!].contract!;
    expect(c.yearsLeft).toBe(offer.years);
    expect(userContractExpiring(save)).toBe(false);
    for (let i = 0; i < offer.years; i++) tickUserContract(save);
    expect(userContractExpiring(save)).toBe(true);
  });
});

describe('national captaincy', () => {
  it('is not offered before enough caps', () => {
    const save = makeCareerSave();
    save.capped = true;
    save.userCaps = 3;
    save.players[save.userPlayerId!].overall = 90;
    expect(maybeNationalCaptaincy(save)).toBe(false);
    expect(save.captainCountry).toBeFalsy();
  });

  it('appoints an experienced, top-rated capped player', () => {
    const save = makeCareerSave();
    save.capped = true;
    save.userCaps = 15;
    save.players[save.userPlayerId!].overall = 99; // clearly the best in the nation
    expect(maybeNationalCaptaincy(save)).toBe(true);
    expect(save.captainCountry).toBe(true);
    // Idempotent once appointed.
    expect(maybeNationalCaptaincy(save)).toBe(false);
  });
});
