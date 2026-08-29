import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Screen, ScreenHeader, AppText as Text } from '../components';
import { isPremiumPassActive } from '../game/domesticBranding';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

export function LeagueEditorScreen({ navigation }: ScreenProps<'LeagueEditor'>) {
  const save = useCareer((state) => state.save);
  const saveBranding = useCareer((state) => state.saveSeasonPassBranding);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const leagueIds = useMemo(() => Object.keys(save?.leagues ?? {}), [save?.leagues]);
  const teamIds = useMemo(
    () =>
      Array.from(new Set(leagueIds.flatMap((leagueId) => save?.leagues[leagueId]?.teamIds ?? []))),
    [leagueIds, save?.leagues],
  );
  const [leagueNames, setLeagueNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(save?.leagues ?? {}).map(([id, league]) => [id, league.name]),
    ),
  );
  const [teamNames, setTeamNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      teamIds.map((id, index) => [id, save?.teams[id]?.name ?? `Team ${index + 1}`]),
    ),
  );

  if (!save) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="League Editor" onBack={() => navigation.goBack()} />
        <Text style={styles.note}>Load a career to edit its domestic competition.</Text>
      </Screen>
    );
  }

  const active = isPremiumPassActive(save);
  const submit = () => {
    const result = saveBranding({ teamNames, leagueNames });
    Alert.alert(
      result.ok ? 'Competition updated' : 'Names not changed',
      result.ok ? 'Your custom names are now used throughout this save.' : result.reason,
    );
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="League Editor"
        onBack={() => navigation.goBack()}
      />

      <View
        style={[styles.statusBand, { borderLeftColor: active ? colors.success : colors.warning }]}
      >
        <Text style={styles.statusTitle}>
          {active ? 'Premium naming active' : 'Premium naming paused'}
        </Text>
        <Text style={styles.note}>
          {active
            ? 'Names apply to this save.'
            : 'Defaults return until Premium is active.'}
        </Text>
      </View>

      <Text style={styles.section}>Competitions</Text>
      {leagueIds.map((id) => (
        <View key={id} style={styles.fieldRow}>
          <Text style={styles.label}>League</Text>
          <TextInput
            accessibilityLabel={`Edit ${save.leagues[id].name}`}
            editable={active}
            maxLength={40}
            value={leagueNames[id] ?? ''}
            onChangeText={(value) => setLeagueNames((current) => ({ ...current, [id]: value }))}
            placeholder="Competition name"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, !active && styles.inputDisabled]}
          />
        </View>
      ))}

      <Text style={styles.section}>Clubs</Text>
      {teamIds.map((id) => {
        const team = save.teams[id];
        if (!team) return null;
        return (
          <View key={id} style={styles.teamRow}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: team.primaryColor, borderColor: team.secondaryColor },
              ]}
            />
            <View style={styles.teamField}>
              <Text style={styles.label}>{team.shortName}</Text>
              <TextInput
                accessibilityLabel={`Edit ${team.name}`}
                editable={active}
                maxLength={32}
                value={teamNames[id] ?? ''}
                onChangeText={(value) => setTeamNames((current) => ({ ...current, [id]: value }))}
                placeholder="Club name"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, !active && styles.inputDisabled]}
              />
            </View>
          </View>
        );
      })}

      <Button
        label={active ? 'Apply Names' : 'Premium Pass Required'}
        variant={active ? 'gold' : 'ghost'}
        disabled={!active}
        onPress={submit}
        style={styles.apply}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    statusBand: {
      borderLeftWidth: 4,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      backgroundColor: colors.surface,
    },
    statusTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.black },
    note: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19, marginTop: spacing.xs },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    fieldRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    swatch: { width: 34, height: 42, borderWidth: 3, borderRadius: radius.sm },
    teamField: { flex: 1 },
    label: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: 4 },
    input: {
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      fontSize: fontSize.md,
    },
    inputDisabled: { color: colors.textMuted, opacity: 0.65 },
    apply: { marginTop: spacing.xl, marginBottom: spacing.xl },
  });
