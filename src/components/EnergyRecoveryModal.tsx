import { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { ECONOMY } from '../data/gameConfig';
import { energyCapacity, energyRecovery } from '../game/economy';
import { useAdsReady } from '../hooks/useAdsReady';
import { useEnergyClock } from '../hooks/useEnergyClock';
import { requestRewardedEnergy, useRewardedEnergyPending } from '../services/rewardedEnergy';
import { useCareer } from '../state/careerStore';
import { useEnergyRecovery } from '../state/energyRecoveryStore';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';

export function formatEnergyWait(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m ${remainder}s` : `${minutes}m ${remainder}s`;
}

export function EnergyRecoveryModal({ enabled }: { enabled: boolean }) {
  useEnergyClock(enabled);
  const save = useCareer((s) => s.save);
  const { saveId, close } = useEnergyRecovery();
  const ready = useAdsReady();
  const pending = useRewardedEnergyPending();
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(AppState.currentState === 'active');
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const requested = enabled && save?.mode === 'career' && save.id === saveId;
  const visible = useModalQueue(requested && active, MODAL_PRIORITY.critical, 'energy-recovery');
  useEffect(() => {
    if (saveId && (!enabled || save?.id !== saveId || save.mode !== 'career')) close();
  }, [close, enabled, saveId, save?.id, save?.mode]);
  useEffect(() => {
    setMessage('');
    setNow(Date.now());
  }, [saveId]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      setActive(state === 'active');
      if (state === 'active') setNow(Date.now());
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible]);
  if (!visible || !save || save.id !== saveId) return null;
  const recovery = energyRecovery(save.wallet, now, energyCapacity(save.entitlements));
  const full = recovery.fullMs <= 0;
  const reward = Math.min(
    ECONOMY.rewardedAdEnergy,
    Math.max(0, recovery.cap - recovery.wallet.energy),
  );
  const watchAd = async () => {
    const result = await requestRewardedEnergy(save.id);
    // A late completion must not update another career's dialog.
    if (useEnergyRecovery.getState().saveId !== save.id) return;
    setNow(Date.now());
    setMessage(
      result.ok
        ? `${result.energyAdded ?? 0} energy added. Free recovery continues.`
        : (result.reason ?? 'Ad unavailable.'),
    );
  };
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Dismiss energy recovery"
        />
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.content}
          accessibilityViewIsModal
        >
          <AppText style={styles.title}>Match energy</AppText>
          <AppText style={styles.total}>
            {recovery.wallet.energy} / {recovery.cap}
          </AppText>
          <AppText style={styles.text}>
            {full ? 'Energy full' : `Next +1 energy in ${formatEnergyWait(recovery.nextPointMs)}`}
          </AppText>
          {!full ? (
            <AppText style={styles.text}>
              Full energy in {formatEnergyWait(recovery.fullMs)}
            </AppText>
          ) : null}
          <AppText style={styles.text}>
            Recover 1 energy every {ECONOMY.energyRegenMinutes} minutes, even while away. Waiting is
            free.
          </AppText>
          <Button
            label={full ? 'Energy full' : ready ? `Watch ad · +${reward} energy` : 'Ad unavailable'}
            loading={pending}
            disabled={full || !ready || pending}
            onPress={() => void watchAd()}
          />
          {!full && !ready ? (
            <AppText style={styles.text}>
              No ad is available right now. Free recovery continues.
            </AppText>
          ) : null}
          {message ? (
            <AppText accessibilityLiveRegion="polite" style={styles.text}>
              {message}
            </AppText>
          ) : null}
          <Button label="Close" variant="ghost" onPress={close} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.overlay,
    },
    card: {
      maxHeight: '90%',
      width: '100%',
      maxWidth: 440,
      flexGrow: 0,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    content: { padding: spacing.lg, gap: spacing.md },
    title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
    total: { color: colors.warning, fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
    text: { color: colors.textMuted, fontSize: fontSize.md },
  });
