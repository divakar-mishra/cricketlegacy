import { create } from 'zustand';
import { useCareer } from './careerStore';

/** Ephemeral UI only: never persist a dialog or replay an ad after restart. */
export const useEnergyRecovery = create<{
  saveId: string | null;
  open: () => void;
  close: () => void;
}>((set) => ({
  saveId: null,
  open: () => {
    const career = useCareer.getState();
    if (career.save?.mode !== 'career') return;
    career.synchronizeEnergyClock();
    set({ saveId: career.save.id });
  },
  close: () => set({ saveId: null }),
}));
