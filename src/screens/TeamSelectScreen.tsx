import { useRef, useState } from 'react';
import { GuideTarget } from '../components/CareerGuide';
import { CreationOverview } from '../components/CreationOverview';
import { guideAction } from '../game/coachGuide';
import { StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  Button,
  CountrySelect,
  Screen,
  ScreenHeader,
  SelectableCard,
  AppText as Text,
  SegmentedControl,
} from '../components';
import { getCountry } from '../data/countries';
import { Difficulty } from '../domain/types';
import { createManagerSave } from '../game/createGame';
import { managerDomesticBlueprints } from '../game/domesticBranding';
import { ScreenProps } from '../navigation';
import { analytics } from '../services';
import { useCareer } from '../state/careerStore';
import { findCreationSlot, setLastPlayed, writeSave } from '../storage/saveGames';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HARD', label: 'Hard' },
  { value: 'PRO', label: 'Pro' },
];

export function TeamSelectScreen({ navigation, route }: ScreenProps<'TeamSelect'>) {
  const setActive = useCareer((state) => state.setActive);
  const styles = useThemedStyles(makeStyles);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const teams = countryId ? managerDomesticBlueprints(countryId).filter((team) => team.tier === 3) : [];

  const create = async () => {
    if (!countryId || !teamId || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      const slot = await findCreationSlot('manager', route?.params?.slot);
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
      // A failed resume pointer does not undo a confirmed first save.
      try {
        await setLastPlayed('manager', slot);
      } catch {
        console.warn('Manager career created; last-played metadata could not be updated.');
      }
      setActive(save, 'manager', slot);
      analytics.setUserProperty('mode', 'manager');
      analytics.logEvent(analytics.EVT.CAREER_START, { mode: 'manager', difficulty });
      guideAction('manager-created');
      navigation.reset({ index: 1, routes: [{ name: 'MainMenu' }, { name: 'ManagerHub' }] });
    } catch {
      Alert.alert(
        'Career not created',
        'The device did not confirm the first save. Check available storage and try again.',
      );
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <View>
          {creating ? <Text accessibilityLiveRegion="polite" style={styles.footerHint}>Creating and saving your career…</Text> : null}
          {!countryId || !teamId ? (
            <Text style={styles.footerHint}>{!countryId ? 'Choose your country, then a Tier 3 club.' : 'Select a Tier 3 club above to start managing.'}</Text>
          ) : null}
          <GuideTarget id="create-manager"><Button
            label="Start Managing"
            variant="gold"
            disabled={!countryId || !teamId || creating}
            loading={creating}
            onPress={create}
          /></GuideTarget>
        </View>
      }
    >
      <ScreenHeader title="Choose your club" onBack={() => { if (!creatingRef.current) navigation.goBack(); }} />
      <CreationOverview chapter="manager.creation" />

      <Text style={styles.label}>Difficulty</Text>
      <GuideTarget id="difficulty"><SegmentedControl
        value={difficulty}
        options={DIFFICULTIES}
        onChange={setDifficulty}
        accessibilityLabel="Manager career difficulty"
      /></GuideTarget>

      <View style={styles.progressNote}>
        <Text style={styles.progressNoteTitle}>Tier 3 · T20</Text>
      </View>

      <Text style={[styles.label, styles.sectionGap]}>Country</Text>
      <GuideTarget id="country" ready={Boolean(countryId)}><CountrySelect
        value={countryId}
        onChange={(nextCountryId) => {
          setCountryId(nextCountryId);
          setTeamId(null);
        }}
        testID="manager-country-select"
      /></GuideTarget>

      <Text style={[styles.label, styles.sectionGap]}>Tier 3 clubs</Text>
      <GuideTarget id="clubs" ready={Boolean(teamId)}>{teams.map((team) => (
        <SelectableCard
          key={team.id}
          title={team.name}
          subtitle={`${getCountry(team.country)?.name ?? ''} | Squad strength ${team.strength}`}
          selected={teamId === team.id}
          onPress={() => { setTeamId(team.id); guideAction('manager-club'); }}
          style={styles.clubCard}
        />
      ))}</GuideTarget>
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
