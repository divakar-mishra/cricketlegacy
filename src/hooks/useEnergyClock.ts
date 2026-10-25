import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { energyCapacity, energyRecovery } from '../game/economy';
import { useCareer } from '../state/careerStore';

/** One foreground timer, scheduled at the next point, not a full-career tick. */
export function useEnergyClock(enabled: boolean): void {
  const [active, setActive] = useState(AppState.currentState === 'active');
  const saveId = useCareer((s) => s.save?.id);
  const mode = useCareer((s) => s.save?.mode);
  const energy = useCareer((s) => s.save?.wallet.energy);
  const updatedAt = useCareer((s) => s.save?.wallet.energyUpdatedAt);
  const vip = useCareer((s) => s.save?.entitlements.removeAds);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (enabled && state === 'active') useCareer.getState().synchronizeEnergyClock();
    });
    return () => listener.remove();
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !active || mode !== 'career') return;
    const career = useCareer.getState();
    if (!career.save || career.save.id !== saveId) return;
    if (career.synchronizeEnergyClock()) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleNextPoint = () => {
      const current = useCareer.getState().save;
      if (cancelled || current?.id !== saveId || current.mode !== 'career') return;
      const { nextPointMs } = energyRecovery(
        current.wallet,
        Date.now(),
        energyCapacity(current.entitlements),
      );
      if (nextPointMs <= 0) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        // A clock correction/early timer can yield no point. Re-arm instead of
        // silently stopping recovery until the player navigates somewhere else.
        if (!useCareer.getState().synchronizeEnergyClock()) scheduleNextPoint();
      }, nextPointMs + 25);
    };
    scheduleNextPoint();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, active, saveId, mode, energy, updatedAt, vip]);
}
