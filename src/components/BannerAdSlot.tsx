import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Entitlements } from '../domain/types';
import { areAdsRemoved } from '../game/economy';
import { useTheme } from '../theme';
import * as ads from '../services/ads';

type Props = {
  entitlements: Entitlements | undefined;
};

/**
 * A low-profile inline banner for quiet, non-match career information screens.
 * It is absent unless age eligibility, UMP consent, SDK initialization and a
 * banner unit ID are all available; entitlement holders never mount the ad.
 */
export function BannerAdSlot({ entitlements }: Props) {
  const { colors } = useTheme();
  const [ready, setReady] = useState(ads.isAdsReady());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const update = () => setReady(ads.isAdsReady());
    const unsubscribe = ads.subscribeAdsState(update);
    update();
    return unsubscribe;
  }, []);

  if (!ready || failed || areAdsRemoved(entitlements)) return null;
  const unitId = ads.getBannerAdUnitId();
  if (!unitId) return null;

  let BannerAd: any;
  let BannerAdSize: any;
  try {
    // Keep native AdMob module access behind the consent-aware service gate.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('react-native-google-mobile-ads');
    BannerAd = module.BannerAd;
    BannerAdSize = module.BannerAdSize;
  } catch {
    return null;
  }
  if (!BannerAd || !BannerAdSize?.BANNER) return null;

  return (
    <View style={[styles.slot, { borderTopColor: colors.border }]}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    minHeight: 58,
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
