import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Screen, ScreenHeader, AppText as Text } from '../components';
import { StaffRole } from '../domain/types';
import { formatClubCurrency } from '../game/finance';
import {
  calculateClubRating,
  STAFF_ROLES,
  staffByRole,
  staffHireCost,
  superstarAttractionChance,
} from '../game/manager';
import { passStaffSigningMultiplier } from '../game/seasonPass';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import { fontSize, fontWeight, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';

export function StaffRecruitmentScreen({ navigation }: ScreenProps<'StaffRecruitment'>) {
  const save = useCareer((state) => state.save);
  const hireStaff = useCareer((state) => state.hireStaff);
  const { gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [role, setRole] = useState<StaffRole>('BATTING_COACH');
  const [, refresh] = useState(0);
  const candidates = useMemo(
    () => (save?.staffCandidates ?? []).filter((candidate) => candidate.role === role),
    [role, save?.staffCandidates],
  );

  if (!save || save.mode !== 'manager' || !save.userTeamId) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Staff Recruitment" onBack={() => navigation.goBack()} />
        <Text style={styles.note}>Available in Manager Career.</Text>
      </Screen>
    );
  }

  const team = save.teams[save.userTeamId];
  const rating = calculateClubRating(save);
  const attraction = Math.round(superstarAttractionChance(save) * 100);
  const current = staffByRole(save, role);

  const hire = (candidateId: string, name: string) => {
    const result = hireStaff(candidateId);
    Alert.alert(
      result.ok ? 'Appointment confirmed' : 'Appointment failed',
      result.ok ? `${name} has joined the club.` : (result.reason ?? 'Unavailable.'),
    );
    refresh((value) => value + 1);
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Staff Recruitment"
        subtitle={team.name}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.ratingBand}>
        <View>
          <Text style={styles.metricLabel}>Club rating</Text>
          <Text style={styles.metricValue}>{rating.toFixed(1)}</Text>
        </View>
        <View>
          <Text style={styles.metricLabel}>Elite-player appeal</Text>
          <Text style={styles.metricValue}>{attraction}%</Text>
        </View>
        <View>
          <Text style={styles.metricLabel}>Budget</Text>
          <Text style={styles.metricValueSmall}>{formatClubCurrency(team.budget)}</Text>
        </View>
      </View>

      <Text style={styles.note}>
        Squad quality drives the club rating. Better coaches, facilities, reputation and commercial
        leadership add a smaller but visible lift.
      </Text>

      <View accessibilityRole="tablist" style={styles.roleTabs}>
        {STAFF_ROLES.map((entry) => (
          <Pressable
            key={entry.role}
            accessibilityRole="tab"
            accessibilityState={{ selected: role === entry.role }}
            onPress={() => setRole(entry.role)}
            style={[styles.roleTab, role === entry.role && styles.roleTabActive]}
          >
            <Text style={[styles.roleTabText, role === entry.role && styles.roleTabTextActive]}>
              {entry.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.currentBand}>
        <Text style={styles.metricLabel}>CURRENT</Text>
        <Text style={styles.currentName}>{current?.name ?? 'Vacant role'}</Text>
        <Text style={styles.note}>
          {current
            ? `${current.quality} rating · ${current.specialty ?? 'General coaching'}`
            : 'Recruit a specialist below.'}
        </Text>
      </View>

      <Text style={styles.section}>Available Candidates</Text>
      {candidates.map((candidate) => {
        const baseCost = staffHireCost(candidate);
        const cost = Math.round(baseCost * passStaffSigningMultiplier(save));
        const staffCount = Math.max(1, save.staff?.length ?? 1);
        const projectedLift = ((candidate.quality - (current?.quality ?? 40)) / staffCount) * 0.18;
        const commercialLift =
          role === 'MARKETING_DIRECTOR'
            ? Math.round(((candidate.quality - (current?.quality ?? 40)) / 500) * 100)
            : 0;
        return (
          <View key={candidate.id} style={styles.candidateRow}>
            <View style={styles.candidateMain}>
              <Text style={styles.candidateName}>{candidate.name}</Text>
              <Text style={styles.candidateMeta}>
                {candidate.quality} rating · {formatClubCurrency(candidate.wage)}/season
              </Text>
              <Text style={styles.candidateEffect}>
                {candidate.specialty}. Club rating {projectedLift >= 0 ? '+' : ''}
                {projectedLift.toFixed(1)}
                {commercialLift
                  ? ` · Elite appeal ${commercialLift >= 0 ? '+' : ''}${commercialLift}%`
                  : ''}
              </Text>
              {cost < baseCost ? (
                <Text style={styles.passSaving}>
                  Premium Pass saves {formatClubCurrency(baseCost - cost)} on this signing.
                </Text>
              ) : null}
            </View>
            <Button
              label={formatClubCurrency(cost)}
              variant={team.budget >= cost ? 'secondary' : 'ghost'}
              size="sm"
              fullWidth={false}
              disabled={team.budget < cost}
              onPress={() => hire(candidate.id, candidate.name)}
            />
          </View>
        );
      })}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ratingBand: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    metricLabel: { color: colors.textFaint, fontSize: 10, fontWeight: fontWeight.bold },
    metricValue: { color: colors.accent, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
    metricValueSmall: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: 4,
    },
    note: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing.sm },
    roleTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.lg },
    roleTab: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 2,
      borderBottomColor: colors.border,
    },
    roleTabActive: { borderBottomColor: colors.accent },
    roleTabText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    roleTabTextActive: { color: colors.accent },
    currentBand: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    currentName: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    candidateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    candidateMain: { flex: 1 },
    candidateName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    candidateMeta: { color: colors.accent, fontSize: fontSize.xs, marginTop: 2 },
    candidateEffect: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
    passSaving: { color: colors.success, fontSize: 10, lineHeight: 15, marginTop: 3 },
  });
