/**
 * AcademyManagementScreen — personal cricket academy manager.
 * Feature 2: shows current tier, students, revenue, upgrade path, founding year.
 */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { ACADEMY_COSTS, ACADEMY_REVENUE, ACADEMY_STUDENTS } from '../game/career';
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

const TIER_NAME: Record<1 | 2 | 3, string> = {
  1: 'Local Coaching School',
  2: 'Regional Academy',
  3: 'Elite National Academy',
};

export function AcademyManagementScreen({ navigation }: ScreenProps<'AcademyManagement'>) {
  const save = useCareer((s) => s.save);
  const fundAcademy = useCareer((s) => s.fundAcademy);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [academyName, setAcademyName] = useState('');

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="Cricket Academy" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active save.</Text>
      </Screen>
    );
  }

  const academy = save.personalAcademy;
  const currentYear = save.currentSeasonId
    ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
    : 2026;

  const handleFund = (tier: 1 | 2 | 3) => {
    const name = academyName.trim() || (academy?.name ?? 'My Cricket Academy');
    if (!academy && !academyName.trim()) {
      Alert.alert('Name your academy', 'Please give your academy a name before opening it.', [
        { text: 'OK' },
      ]);
      return;
    }
    const cost = ACADEMY_COSTS[tier];
    Alert.alert(
      `Open Tier ${tier} Academy`,
      `Cost: ${cost.toLocaleString()} coins\nRevenue: ${ACADEMY_REVENUE[tier].toLocaleString()} coins/season\nStudents: ${ACADEMY_STUDENTS[tier]}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            const res = fundAcademy(tier, name);
            if (!res.ok) {
              Alert.alert('Cannot open', res.reason ?? 'Unknown error.');
            } else {
              setAcademyName('');
              Alert.alert(
                'Academy Founded!',
                `${name} (Tier ${tier}) is now open and earning revenue each season.`,
              );
            }
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Cricket Academy" onBack={() => navigation.goBack()} />

      {academy ? (
        <>
          {/* Current academy overview */}
          <Animated.View entering={FadeInDown.duration(300)}>
            <Card style={styles.academyCard}>
              <Text style={styles.academyName}>{academy.name}</Text>
              <Text style={styles.academyTier}>
                Tier {academy.tier} — {TIER_NAME[academy.tier]}
              </Text>
              <View style={styles.statsRow}>
                <StatPill
                  label="Students"
                  value={String(academy.studentsCount)}
                  color={colors.primaryLight}
                />
                <StatPill
                  label="Revenue/Season"
                  value={`${academy.revenuePerSeason.toLocaleString()} coins`}
                  color={colors.success}
                />
                <StatPill
                  label="Founded"
                  value={String(academy.foundedYear)}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.yearsOpen}>
                {currentYear - academy.foundedYear} year
                {currentYear - academy.foundedYear !== 1 ? 's' : ''} in operation
              </Text>
            </Card>
          </Animated.View>

          {/* Upgrade tiers */}
          {([2, 3] as const).map((tier, idx) => {
            if (academy.tier >= tier) return null;
            const cost = ACADEMY_COSTS[tier];
            const revUplift = ACADEMY_REVENUE[tier] - academy.revenuePerSeason;
            const studentUplift = ACADEMY_STUDENTS[tier] - academy.studentsCount;
            const canAfford = save.wallet.coins >= cost;
            return (
              <Animated.View key={tier} entering={FadeInDown.duration(320).delay(80 + idx * 40)}>
                <Card style={[styles.upgradeCard, !canAfford && { opacity: 0.6 }]}>
                  <Text style={styles.upgradeTier}>Upgrade to Tier {tier}</Text>
                  <Text style={styles.upgradeName}>{TIER_NAME[tier]}</Text>
                  <View style={styles.upgradeDetails}>
                    <Text style={styles.upgradeDetail}>Cost: {cost.toLocaleString()} coins</Text>
                    <Text style={[styles.upgradeDetail, { color: colors.success }]}>
                      +{studentUplift} students · +{revUplift.toLocaleString()} coins/season revenue
                    </Text>
                  </View>
                  <Button
                    label={
                      canAfford ? `Upgrade to Tier ${tier}` : `Need ${cost.toLocaleString()} coins`
                    }
                    variant={canAfford ? 'primary' : 'secondary'}
                    disabled={!canAfford}
                    style={{ marginTop: spacing.sm }}
                    onPress={() => handleFund(tier)}
                  />
                </Card>
              </Animated.View>
            );
          })}
        </>
      ) : (
        <>
          {/* No academy yet — first-time setup */}
          <Animated.View entering={FadeInDown.duration(300)}>
            <Card style={styles.setupCard}>
              <Text style={styles.setupTitle}>Found Your Cricket Academy</Text>
              <Text style={styles.setupDesc}>
                Invest in the next generation. A cricket academy generates passive income every
                season and cements your legacy in the sport.
              </Text>
              <Text style={styles.inputLabel}>Name your academy</Text>
              <TextInput
                style={styles.input}
                value={academyName}
                onChangeText={setAcademyName}
                placeholder="e.g. Virat Kohli Cricket Academy"
                placeholderTextColor={colors.textFaint}
                maxLength={40}
              />
            </Card>
          </Animated.View>

          {([1, 2, 3] as const).map((tier, idx) => {
            const cost = ACADEMY_COSTS[tier];
            const canAfford = save.wallet.coins >= cost;
            return (
              <Animated.View key={tier} entering={FadeInDown.duration(340).delay(60 + idx * 60)}>
                <Card style={[styles.upgradeCard, !canAfford && { opacity: 0.6 }]}>
                  <Text style={styles.upgradeTier}>Tier {tier}</Text>
                  <Text style={styles.upgradeName}>{TIER_NAME[tier]}</Text>
                  <View style={styles.upgradeDetails}>
                    <Text style={styles.upgradeDetail}>Cost: {cost.toLocaleString()} coins</Text>
                    <Text style={[styles.upgradeDetail, { color: colors.success }]}>
                      {ACADEMY_STUDENTS[tier]} students · {ACADEMY_REVENUE[tier].toLocaleString()}{' '}
                      coins/season
                    </Text>
                  </View>
                  <Button
                    label={
                      canAfford
                        ? `Open Tier ${tier} Academy`
                        : `Need ${cost.toLocaleString()} coins`
                    }
                    variant={canAfford ? 'primary' : 'secondary'}
                    disabled={!canAfford}
                    style={{ marginTop: spacing.sm }}
                    onPress={() => handleFund(tier)}
                  />
                </Card>
              </Animated.View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: fontSize.md, fontWeight: fontWeight.heavy }}>{value}</Text>
      <Text
        style={{ color: colors.textFaint, fontSize: 10, textTransform: 'uppercase', marginTop: 2 }}
      >
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.lg },
    academyCard: { marginTop: spacing.lg },
    academyName: { color: colors.accent, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
    academyTier: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
      marginBottom: spacing.md,
    },
    statsRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
      gap: spacing.sm,
    },
    yearsOpen: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.md,
      fontStyle: 'italic',
    },
    setupCard: { marginTop: spacing.lg },
    setupTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.heavy,
      marginBottom: spacing.sm,
    },
    setupDesc: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    inputLabel: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.sm,
      color: colors.text,
      fontSize: fontSize.md,
      backgroundColor: colors.surfaceAlt,
    },
    upgradeCard: { marginTop: spacing.md },
    upgradeTier: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    upgradeName: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    upgradeDetails: { marginTop: spacing.sm, gap: spacing.xs },
    upgradeDetail: { color: colors.textMuted, fontSize: fontSize.sm },
  });
