import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  Button,
  Card,
  Screen,
  ScreenHeader,
  SegmentedControl,
  AppText as Text,
} from '../components';
import { GameMode, SaveGame } from '../domain/types';
import { ScreenProps } from '../navigation';
import { premiumSponsorSave } from '../services';
import { assertNoPendingPurchaseForSlot } from '../services/purchaseRecovery';
import { useCareer } from '../state/careerStore';
import { BASE_MAX_SLOTS, deleteSave, listSlotSummaries, loadSave, SummarySlot } from '../storage/saveGames';
import { SaveSummary, summaryHasPremium } from '../storage/saveSummary';
import { fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AccountBackupCard } from '../components/AccountBackupCard';
import { useAccountBackup } from '../services/accountRecovery';

export function SavedGamesScreen({ navigation }: ScreenProps<'SavedGames'>) {
  const [mode, setMode] = useState<GameMode>('career');
  const [loaded, setLoaded] = useState<{ mode: GameMode; slots: SummarySlot[] } | null>(null);
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const focused = useRef(false);
  const actionEpoch = useRef(0);
  const selectedMode = useRef(mode);
  const refreshRequest = useRef(0);
  // Encrypted loads are asynchronous. Never leave the previous mode's actions
  // active while the new tab loads, or accept a late response for another tab.
  const slots = loaded?.mode === mode ? loaded.slots : [];
  const setActive = useCareer((s) => s.setActive);
  const styles = useThemedStyles(makeStyles);
  const backupRefresh = useAccountBackup((state) => state.refresh);
  const premiumSlotUnlocked = slots.some((entry) => summaryHasPremium(entry.summary));

  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; actionEpoch.current += 1; };
  }, []));

  const refresh = useCallback(async () => {
    if (selectedMode.current !== mode) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const request = ++refreshRequest.current;
    const next = await listSlotSummaries(mode, { signal: current.signal }).catch(() => null);
    if (next && request === refreshRequest.current && selectedMode.current === mode) {
      setLoaded({ mode, slots: next });
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        refreshRequest.current += 1;
        controller.current?.abort();
      };
    }, [refresh, backupRefresh]),
  );

  const withVerifiedSave = async (summary: SaveSummary, slot: number, action: (save: SaveGame) => void) => {
    const epoch = actionEpoch.current;
    const active = () => focused.current && selectedMode.current === mode && actionEpoch.current === epoch;
    if (!active() || summary.mode !== mode || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    try {
      const save = await loadSave(mode, slot, { isCurrent: active });
      if (!active()) return;
      if (!save || save.id !== summary.id || save.mode !== mode) throw new Error('This slot changed. Reopen Saved Games and try again.');
      action(save);
    } catch (error) {
      if (active())
        Alert.alert('Career not opened', error instanceof Error ? error.message : 'Please retry. Your data has been kept.');
    } finally { openingRef.current = false; setOpening(false); }
  };

  const onPlay = (summary: SaveSummary, slot: number) => {
    void withVerifiedSave(summary, slot, save => {
      setActive(save, save.mode, slot);
      navigation.navigate(save.mode === 'career' ? 'CareerHub' : 'ManagerHub');
    });
  };

  const onDelete = (slot: number, save: SaveGame) => {
    if (selectedMode.current !== mode || save.mode !== mode) return;
    const permanentSponsor = save.sponsorship?.premium;
    const permanentSponsorWarning = permanentSponsor
      ? permanentSponsor.purchaseToken.startsWith('mock:')
        ? ' This development sponsor exists only on this device and will be permanently destroyed.'
        : ' Reinstall or device-loss recovery can restore this exact purchased save when you sign in. Choosing Delete permanently destroys that server backup and sponsor binding; it can never be moved or recovered afterward.'
      : '';
    Alert.alert('Delete save', `This cannot be undone.${permanentSponsorWarning}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: save.sponsorship?.premium ? 'Delete permanently' : 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!focused.current || selectedMode.current !== mode) return;
          try {
            // Check before any remote exact-save deletion as well as in storage.
            await assertNoPendingPurchaseForSlot(mode, slot);
            if (save.sponsorship?.premium) {
              const result = await premiumSponsorSave.deletePremiumSponsorExactSave(save);
              if (result.status !== 'DELETED' && result.status !== 'LOCAL_ONLY') {
                Alert.alert(
                  'Save not deleted',
                  'error' in result
                    ? result.error
                    : 'The permanent sponsor deletion was not confirmed. Nothing was deleted.',
                );
                return;
              }
            }
            await deleteSave(mode, slot, save.id);
            const active = useCareer.getState();
            if (
              active.save?.id === save.id &&
              active.ref?.mode === mode &&
              active.ref?.slot === slot
            )
              active.clear();
            await refresh();
          } catch (error) {
            Alert.alert(
              'Save not deleted',
              error instanceof Error
                ? error.message
                : 'The device did not confirm deletion. The save has been left in place.',
            );
          }
        },
      },
    ]);
  };

  const onNew = (slot: number) => {
    if (!focused.current || selectedMode.current !== mode || openingRef.current) return;
    if (mode === 'career') navigation.navigate('PlayerCreation', { slot });
    else navigation.navigate('TeamSelect', { slot });
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title="Saved Games"
        subtitle={`${BASE_MAX_SLOTS} standard slots · 1 mode VIP slot`}
        onBack={() => navigation.goBack()}
      />

      <AccountBackupCard onSignIn={() => navigation.navigate('Login')} />

      <SegmentedControl
        value={mode}
        options={[
          { value: 'career', label: 'Player' },
          { value: 'manager', label: 'Manager' },
        ]}
        onChange={(next) => {
          if (selectedMode.current !== next) actionEpoch.current += 1;
          selectedMode.current = next;
          setMode(next);
        }}
        accessibilityLabel="Career mode"
        style={styles.tabs}
      />

      {loaded?.mode !== mode ? <Text style={styles.saveSummary}>Loading saves…</Text> : null}
      {opening ? <Text style={styles.saveSummary}>Opening and verifying career…</Text> : null}

      {slots.map(({ slot, summary: save, unavailable }) => (
        <Card key={slot} style={styles.slot}>
          <View style={styles.slotHeader}>
            <Text style={styles.slotNo}>
              Slot {slot}
              {slot > BASE_MAX_SLOTS ? ' · PASS' : ''}
            </Text>
            {save ? (
              <Text style={styles.slotDate}>{new Date(save.updatedAt).toLocaleDateString()}</Text>
            ) : null}
          </View>

          {unavailable ? (
            <>
              <Text style={styles.saveName}>Save needs recovery</Text>
              <Text style={styles.saveSummary}>
                This save could not be verified or decrypted. Your data is still here. Retry or
                recover your cloud backup; do not uninstall the app.
              </Text>
              <Button label="Retry" onPress={() => void refresh()} />
            </>
          ) : save ? (
            <>
              <Text style={styles.saveName}>{save.title}</Text>
              <Text style={styles.saveSummary}>{save.subtitle}</Text>
              <View style={styles.actions}>
                <Button
                  label="Play"
                  disabled={opening}
                  size="sm"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => onPlay(save, slot)}
                />
                <Button
                  label="Delete"
                  disabled={opening}
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => void withVerifiedSave(save, slot, verified => onDelete(slot, verified))}
                />
              </View>
            </>
          ) : (
            <Pressable
              disabled={slot > BASE_MAX_SLOTS && !premiumSlotUnlocked}
              onPress={() => onNew(slot)}
              style={[
                styles.empty,
                slot > BASE_MAX_SLOTS && !premiumSlotUnlocked && { opacity: 0.45 },
              ]}
            >
              <Text style={styles.emptyPlus}>＋</Text>
              <Text style={styles.emptyText}>
                {slot > BASE_MAX_SLOTS && !premiumSlotUnlocked
                  ? 'Mode VIP slot locked'
                  : `Empty — start a new ${mode === 'career' ? 'player' : 'manager'} career`}
              </Text>
            </Pressable>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabs: { marginBottom: spacing.lg },
    slot: { marginBottom: spacing.md },
    slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    slotNo: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    slotDate: { color: colors.textFaint, fontSize: fontSize.xs },
    saveName: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.sm,
    },
    saveSummary: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    empty: { alignItems: 'center', paddingVertical: spacing.md, gap: 4 },
    emptyPlus: { color: colors.primary, fontSize: 28, fontWeight: fontWeight.bold },
    emptyText: { color: colors.textMuted, fontSize: fontSize.sm },
  });
