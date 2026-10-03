import { useSyncExternalStore } from 'react';
import * as ads from '../services/ads';

/** Keep ad-dependent controls current while UMP and the SDK initialize. */
export function useAdsReady(): boolean {
  return useSyncExternalStore(ads.subscribeAdsState, ads.isAdsReady, () => false);
}
