/**
 * WageBreakdownScreen — squad wage ledger for both career and manager modes.
 *
 * Shows every player's weekly wage (annual / 52), contract years, and value
 * rating so the manager/player can make informed financial decisions.
 * Weekly framing makes costs feel concrete and creates natural IAP moments
 * ("I need to renew Smith — he's only on ₹3k/week but leaves next season").
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, ProgressBar, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { Player } from '../domain/types';
import { weeklyWage } from '../game/career';
import { formatClubCurrency, playerWage, seasonWageBill } from '../game/finance';
import { facilityMaintenance, staffWageBill } from '../game/manager';
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

const ROLE_ABBR: Record<string, string> = {
  BATTER: 'BAT',
  BOWLER: 'BOWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};

function fmtWeekly(annualWage: number): string {
  const w = weeklyWage(annualWage);
  return `${formatClubCurrency(w)}/wk`;
}

export function WageBreakdownScreen({ navigation }: ScreenProps<'WageBreakdown'>) {
  const save = useCareer((s) => s.save);
  const renewDeal = useCareer((s) => s.renewDeal);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save || !save.userTeamId) {
    return (
      <Screen>
        <ScreenHeader title="Wage Ledger" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active team.</Text>
      </Screen>
    );
  }

  if (save.mode !== 'manager') {
    return (
      <Screen>
        <ScreenHeader title="Wage Ledger" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>Available in Manager mode.</Text>
      </Screen>
    );
  }

  const wk = fmtWeekly;
  const bud = formatClubCurrency;

  const team = save.teams[save.userTeamId];
  const squad = team.playerIds
    .map((id) => save.players[id])
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => playerWage(b) - playerWage(a)); // most expensive first

  const totalAnnualWage = seasonWageBill(squad);

  // Manager-mode extras
  const isManager = save.mode === 'manager';
  const staffAnnual = isManager ? staffWageBill(save) : 0;
  const upkeepAnnual = isManager ? facilityMaintenance(save) : 0;
  const finances = save.finances;
  const wageCap = finances?.wageBudgetPerSeason ?? team.budget;
  const budgetUsePct = Math.min(1, totalAnnualWage / wageCap);
  const barColor =
    budgetUsePct > 0.9 ? colors.danger : budgetUsePct > 0.7 ? colors.warning : colors.success;

  const onRenew = (player: Player) => {
    const res = renewDeal(player.id, 2);
    Alert.alert(
      res.ok ? 'Contract renewed' : 'Cannot renew',
      res.ok
        ? `${player.name} signed for 2 more years. Fee: ${bud(res.cost)}.`
        : (res.reason ?? 'Unavailable.'),
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Wage Ledger" subtitle={team.name} onBack={() => navigation.goBack()} />

      {/* Summary card */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={{ marginHorizontal: spacing.lg, marginTop: spacing.md }}
      >
        <Card>
          <Text style={styles.summaryTitle}>Total squad wage bill</Text>
          <Text style={styles.summaryWeekly}>
            {wk(totalAnnualWage)} · {bud(totalAnnualWage)}/season
          </Text>

          <ProgressBar value={budgetUsePct} color={barColor} style={{ marginTop: spacing.sm }} />
          <View style={styles.budgetRow}>
            <Text style={[styles.budgetLabel, { color: barColor }]}>
              {Math.round(budgetUsePct * 100)}% of wage cap
            </Text>
            <Text style={styles.budgetCap}>Cap: {bud(wageCap)}/season</Text>
          </View>

          {isManager && (staffAnnual > 0 || upkeepAnnual > 0) && (
            <View style={styles.extrasBox}>
              {staffAnnual > 0 && (
                <View style={styles.extraRow}>
                  <Text style={styles.extraLabel}>Staff wages</Text>
                  <Text style={styles.extraValue}>{wk(staffAnnual)}</Text>
                </View>
              )}
              {upkeepAnnual > 0 && (
                <View style={styles.extraRow}>
                  <Text style={styles.extraLabel}>Facility upkeep</Text>
                  <Text style={styles.extraValue}>{wk(upkeepAnnual)}</Text>
                </View>
              )}
              <View style={[styles.extraRow, styles.totalRow]}>
                <Text style={styles.extraLabel}>Total club expenditure</Text>
                <Text
                  style={[styles.extraValue, { color: colors.text, fontWeight: fontWeight.black }]}
                >
                  {wk(totalAnnualWage + staffAnnual + upkeepAnnual)}
                </Text>
              </View>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <LegendDot color={colors.success} label="Good value" />
        <LegendDot color={colors.warning} label="Fair" />
        <LegendDot color={colors.danger} label="Expensive" />
      </View>

      {/* Player list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {squad.map((p, index) => (
          <Animated.View key={p.id} entering={FadeInDown.duration(200).delay(index * 25)}>
            <View style={[styles.row, p.id === save.userPlayerId && styles.rowUser]}>
              <View style={styles.nameCol}>
                <Text
                  style={[
                    styles.playerName,
                    p.id === save.userPlayerId && { color: colors.accent },
                  ]}
                  numberOfLines={1}
                >
                  {p.name}
                  {p.id === save.userPlayerId ? ' ★' : ''}
                </Text>
                <Text style={styles.playerMeta}>
                  {ROLE_ABBR[p.role] ?? p.role} · OVR {p.overall}
                  {(p.contract?.yearsLeft ?? 2) <= 1 ? (
                    <Text style={{ color: colors.danger }}>
                      {(p.contract?.yearsLeft ?? 0) === 0
                        ? ' · Out of contract'
                        : ' · Expiring soon'}
                    </Text>
                  ) : (
                    ` · ${p.contract?.yearsLeft ?? '?'}yr left`
                  )}
                </Text>
              </View>
              <View style={styles.wageCol}>
                {(() => {
                  const annual = playerWage(p);
                  const pct = wageCap > 0 ? annual / wageCap : 0;
                  const wageColor =
                    pct > 0.15 ? colors.danger : pct > 0.08 ? colors.warning : colors.success;
                  return (
                    <>
                      <Text style={[styles.wageAmount, { color: wageColor }]}>{wk(annual)}</Text>
                      <Text style={styles.wageAnnual}>{bud(annual)}/yr</Text>
                    </>
                  );
                })()}
                {isManager && p.id !== save.userPlayerId && (p.contract?.yearsLeft ?? 2) <= 1 ? (
                  <Button
                    label="Renew"
                    size="sm"
                    variant="secondary"
                    fullWidth={false}
                    style={{ marginTop: 6 }}
                    onPress={() => onRenew(p)}
                  />
                ) : null}
              </View>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.textFaint, fontSize: fontSize.xs }}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.lg },
    summaryTitle: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: fontWeight.bold,
    },
    summaryWeekly: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      marginTop: 4,
    },
    budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
    budgetLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    budgetCap: { color: colors.textFaint, fontSize: fontSize.xs },
    extrasBox: {
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    extraRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    totalRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
    },
    extraLabel: { color: colors.textMuted, fontSize: fontSize.xs },
    extraValue: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    legendRow: {
      flexDirection: 'row',
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowUser: { backgroundColor: colors.primary + '0A', borderRadius: radius.sm },
    nameCol: { flex: 1, paddingRight: spacing.sm },
    playerName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    playerMeta: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
    wageCol: { alignItems: 'flex-end', minWidth: 90 },
    wageAmount: { fontSize: fontSize.md, fontWeight: fontWeight.black },
    wageAnnual: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 1 },
  });
