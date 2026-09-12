import { create } from 'zustand';
import type { ContractOffer } from '../game/career';
import type { SaveGame } from '../domain/types';

export interface SignedPlayerContract {
  saveId: string;
  club: string;
  player: string;
  offer: ContractOffer;
}

/** Ephemeral presentation, never a reward or a replayable save event. */
export const useContractPresentation = create<{
  signed: SignedPlayerContract | null;
  dismiss: () => void;
}>((set) => ({ signed: null, dismiss: () => set({ signed: null }) }));

export function presentSignedPlayerContract(
  save: SaveGame,
  teamId: string | undefined,
  offer: ContractOffer,
) {
  const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const team = teamId ? save.teams[teamId] : undefined;
  if (save.mode !== 'career' || !player || !team) return;
  useContractPresentation.setState({
    signed: {
      saveId: save.id,
      club: team.name,
      player: player.name,
      offer: { ...offer },
    },
  });
}
