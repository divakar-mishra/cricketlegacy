import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, Screen, ScreenHeader, SegmentedControl, AppText as Text } from '../components';
import { GameMode, SaveGame } from '../domain/types';
import { saveSubtitle, saveTitle } from '../game/saveMeta';
import { isSeasonPassActive } from '../game/seasonPass';
import { ScreenProps } from '../navigation';
import { premiumSponsorSave } from '../services';
import { assertNoPendingPurchaseForSlot } from '../services/purchaseRecovery';
import { useCareer } from '../state/careerStore';
import { BASE_MAX_SLOTS, deleteSave, listSlots, SlotView } from '../storage/saveGames';
import { fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AccountBackupCard } from '../components/AccountBackupCard';
import { useAccountBackup } from '../services/accountRecovery';

export function SavedGamesScreen({ navigation }: ScreenProps<'SavedGames'>) {
  const [mode, setMode] = useState<GameMode>('career');
  const [loaded, setLoaded] = useState<{ mode: GameMode; slots: SlotView[] } | null>(null);
  const selectedMode = useRef(mode);
  const refreshRequest = useRef(0);
  // Encrypted loads are asynchronous. Never leave the previous mode's actions
  // active while the new tab loads, or accept a late response for another tab.
  const slots = loaded?.mode === mode ? loaded.slots : [];
  const setActive = useCareer((s) => s.setActive);
  const styles = useThemedStyles(makeStyles);
  const backupRefresh = useAccountBackup((state) => state.refresh);
  const premiumSlotUnlocked = slots.some((entry) => isSeasonPassActive(entry.save ?? undefined));

  const refresh = useCallback(async () => {
    if (selectedMode.current !== mode) return;
    const request = ++refreshRequest.current;
    const next = await listSlots(mode);
    if (request === refreshRequest.current && selectedMode.current === mode) {
      setLoaded({ mode, slots: next });
    }
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => { refreshRequest.current += 1; };
    }, [refresh, backupRefresh]),
  );

  const onPlay = (save: SaveGame, slot: number) => {
    if (selectedMode.current !== mode || save.mode !== mode) return;
    setActive(save, save.mode, slot);
    navigation.navigate(save.mode === 'career' ? 'CareerHub' : 'ManagerHub');
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
            if (active.save?.id === save.id && active.ref?.mode === mode && active.ref?.slot === slot) active.clear();
            await refresh();
          } catch (error) {
            Alert.alert(
              'Save not deleted',
              error instanceof Error ? error.message
                : 'The device did not confirm deletion. The save has been left in place.',
            );
          }
        },
      },
    ]);
  };

  const onNew = (slot: number) => {
    if (selectedMode.current !== mode) return;
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
        onChange={(next) => { selectedMode.current = next; setMode(next); }}
        accessibilityLabel="Career mode"
        style={styles.tabs}
      />

      {loaded?.mode !== mode ? <Text>Loading saves…</Text> : null}

      {slots.map(({ slot, save, unavailable }) => (
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
              <Text style={styles.saveName}>{saveTitle(save)}</Text>
              <Text style={styles.saveSummary}>{saveSubtitle(save)}</Text>
              <View style={styles.actions}>
                <Button
                  label="Play"
                  size="sm"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => onPlay(save, slot)}
                />
                <Button
                  label="Delete"
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => onDelete(slot, save)}
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
