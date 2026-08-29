import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, Screen, ScreenHeader, AppText as Text } from '../components';
import { GameMode, SaveGame } from '../domain/types';
import { saveSubtitle, saveTitle } from '../game/saveMeta';
import { isSeasonPassActive } from '../game/seasonPass';
import { ScreenProps } from '../navigation';
import { premiumSponsorSave } from '../services';
import { useCareer } from '../state/careerStore';
import { BASE_MAX_SLOTS, deleteSave, listSlots, SlotView } from '../storage/saveGames';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

export function SavedGamesScreen({ navigation }: ScreenProps<'SavedGames'>) {
  const [mode, setMode] = useState<GameMode>('career');
  const [slots, setSlots] = useState<SlotView[]>([]);
  const setActive = useCareer((s) => s.setActive);
  const styles = useThemedStyles(makeStyles);
  const premiumSlotUnlocked = slots.some((entry) => isSeasonPassActive(entry.save ?? undefined));

  const refresh = useCallback(async () => {
    setSlots(await listSlots(mode));
  }, [mode]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onPlay = (save: SaveGame, slot: number) => {
    setActive(save, mode, slot);
    navigation.navigate(mode === 'career' ? 'CareerHub' : 'ManagerHub');
  };

  const onDelete = (slot: number, save: SaveGame) => {
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
            await deleteSave(mode, slot);
            await refresh();
          } catch {
            Alert.alert(
              'Save not deleted',
              'The device did not confirm deletion. The save has been left in place.',
            );
          }
        },
      },
    ]);
  };

  const onNew = (slot: number) => {
    if (mode === 'career') navigation.navigate('PlayerCreation', { slot });
    else navigation.navigate('TeamSelect', { slot });
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title="Saved Games"
        subtitle={`${BASE_MAX_SLOTS} standard slots · 1 Premium Pass slot`}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.tabs}>
        <Tab label="Player" active={mode === 'career'} onPress={() => setMode('career')} />
        <Tab label="Manager" active={mode === 'manager'} onPress={() => setMode('manager')} />
      </View>

      {slots.map(({ slot, save }) => (
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

          {save ? (
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
                  ? 'Premium Pass slot locked'
                  : `Empty — start a new ${mode === 'career' ? 'player' : 'manager'} career`}
              </Text>
            </Pressable>
          )}
        </Card>
      ))}
    </Screen>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    tab: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: colors.surfaceAlt, borderColor: colors.primary },
    tabText: { color: colors.textMuted, fontWeight: fontWeight.bold, fontSize: fontSize.md },
    tabTextActive: { color: colors.white },
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
