/**
 * Reactive access to the all-time Hall of Fame for the UI. Loads the durable
 * board (players + managers) from storage; the career store ingests into it at
 * milestones (match end, season rollover, retirement, new job).
 */
import { create } from 'zustand';
import { emptyHallOfFame, HallOfFame } from '../game/hallOfFame';
import { loadHallOfFame } from '../storage/hallOfFame';

interface HofState {
  board: HallOfFame;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useHallOfFame = create<HofState>((set) => ({
  board: emptyHallOfFame(),
  loaded: false,
  load: async () => {
    const board = await loadHallOfFame();
    set({ board, loaded: true });
  },
}));
