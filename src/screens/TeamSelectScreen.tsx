import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  Button,
  CountrySelect,
  Screen,
  ScreenHeader,
  SelectableCard,
  AppText as Text,
} from '../components';
import { getCountry } from '../data/countries';
import { Difficulty } from '../domain/types';
import { createManagerSave } from '../game/createGame';
import { managerDomesticBlueprints } from '../game/domesticBranding';
import { ScreenProps } from '../navigation';
import { analytics } from '../services';
import { useCareer } from '../state/careerStore';
import { firstFreeSlot, listSlots, setLastPlayed, writeSave } from '../storage/saveGames';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD', 'PRO'];

export function TeamSelectScreen({ navigation, route }: ScreenProps<'TeamSelect'>) {
  const setActive = useCareer((state) => state.setActive);
  const styles = useThemedStyles(makeStyles);
  const [countryId, setCountryId] = useState('india');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [creating, setCreating] = useState(false);
  const teams = managerDomesticBlueprints(countryId).filter((team) => team.tier === 3);

  const create = async () => {
    if (!teamId || creating) return;
    setCreating(true);
    try {
      const slots = await listSlots('manager');
      const slot = route?.params?.slot ?? firstFreeSlot(slots);
      if (!slot) {
        Alert.alert('All slots full', 'Delete a manager save from Saved Games first.', [
          { text: 'OK', onPress: () => navigation.navigate('SavedGames') },
        ]);
        return;
      }
      const save = createManagerSave({
        teamId,
        country: countryId,
        difficulty,
        format: 'T20',
      });
      await writeSave('manager', slot, save);
      await setLastPlayed('manager', slot);
      setActive(save, 'manager', slot);
      analytics.setUserProperty('mode', 'manager');
      analytics.logEvent(analytics.EVT.CAREER_START, { mode: 'manager', difficulty });
      navigation.reset({ index: 1, routes: [{ name: 'MainMenu' }, { name: 'ManagerHub' }] });
    } catch {
      Alert.alert(
        'Career not created',
        'The device did not confirm the first save. Check available storage and try again.',
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <View>
          {!teamId ? (
            <Text style={styles.footerHint}>Select a Tier 3 club above to start managing.</Text>
          ) : null}
          <Button
            label="Start Managing"
            variant="gold"
            disabled={!teamId || creating}
            loading={creating}
            onPress={() => void create()}
          />
        </View>
      }
    >
      <ScreenHeader title="Choose your club" onBack={() => navigation.goBack()} />

      <Text style={styles.label}>Difficulty</Text>
      <View style={styles.chips}>
        {DIFFICULTIES.map((item) => {
          const selected = difficulty === item;
          return (
            <Pressable
              key={item}
              onPress={() => setDifficulty(item)}
              style={[styles.chip, selected && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Difficulty ${item}`}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.progressNote}>
        <Text style={styles.progressNoteTitle}>Tier 3 · T20</Text>
      </View>

      <Text style={[styles.label, styles.sectionGap]}>Country</Text>
      <CountrySelect
        value={countryId}
        onChange={(nextCountryId) => {
          setCountryId(nextCountryId);
          setTeamId(null);
        }}
        testID="manager-country-select"
      />

      <Text style={[styles.label, styles.sectionGap]}>Tier 3 clubs</Text>
      {teams.map((team) => (
        <SelectableCard
          key={team.id}
          title={team.name}
          subtitle={`${getCountry(team.country)?.name ?? ''} | Squad strength ${team.strength}`}
          selected={teamId === team.id}
          onPress={() => setTeamId(team.id)}
          style={styles.clubCard}
        />
      ))}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    footerHint: {
      color: colors.warning,
      fontSize: fontSize.xs,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    label: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    sectionGap: { marginTop: spacing.lg },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    chipText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    chipTextActive: { color: colors.white },
    progressNote: {
      marginTop: spacing.lg,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: spacing.md,
    },
    progressNoteTitle: {
      color: colors.primaryLight,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.xs,
    },
    progressNoteText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
    clubCard: { marginBottom: spacing.sm },
  });
