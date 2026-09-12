import type { SaveGame } from '../../domain/types';
import { presentSignedPlayerContract, useContractPresentation } from '../contractPresentationStore';

const save = {
  id: 'career-a',
  mode: 'career',
  userPlayerId: 'player',
  players: { player: { name: 'Ocean' } },
  teams: { domestic: { name: 'Mumbai Northstar' }, franchise: { name: 'Perth Dragons' } },
} as unknown as SaveGame;

describe('signed contract presentation', () => {
  it('preserves the entered name including spaces and accents', () => {
    const enteredName = 'José Dev Mishra';
    const namedSave = {
      ...save,
      players: { player: { ...save.players.player, name: enteredName } },
    };
    presentSignedPlayerContract(namedSave, 'domestic', { wage: 4500, years: 3, signingBonus: 900 });
    expect(useContractPresentation.getState().signed?.player).toBe(enteredName);
  });
  beforeEach(() => useContractPresentation.getState().dismiss());
  it('snapshots the signed terms and the actual contracting club', () => {
    const offer = { wage: 4500, years: 3, signingBonus: 900 };
    presentSignedPlayerContract(save, 'franchise', offer);
    offer.wage = 1;
    expect(useContractPresentation.getState().signed).toEqual({
      saveId: 'career-a',
      player: 'Ocean',
      club: 'Perth Dragons',
      offer: { wage: 4500, years: 3, signingBonus: 900 },
    });
  });
  it('dismisses without changing contract or rewards', () => {
    presentSignedPlayerContract(save, 'domestic', { wage: 4500, years: 3, signingBonus: 900 });
    useContractPresentation.getState().dismiss();
    expect(useContractPresentation.getState().signed).toBeNull();
  });
  it('does not invent missing players or clubs or show the player sheet for a manager', () => {
    const offer = { wage: 4500, years: 3, signingBonus: 900 };
    presentSignedPlayerContract(save, 'missing', offer);
    presentSignedPlayerContract({ ...save, mode: 'manager' }, 'domestic', offer);
    expect(useContractPresentation.getState().signed).toBeNull();
  });
});
