import { Pressable, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { GroundDevelopment } from '../components/GroundDevelopment';
import { AppText as Text, Button, Card, Icon, Screen, ScreenHeader } from '../components';
import { Format, TicketPreset } from '../domain/types';
import { formatClubCurrency } from '../game/finance';
import { activeManagerClub } from '../game/managerClubState';
import {
  MATCHDAY_EXPERIENCE,
  MAX_STADIUM_LEVEL,
  projectFixtureAttendance,
  stadiumCapacity,
  stadiumSeasonUpkeep,
  stadiumSummary,
  STADIUM_CAPACITY,
  STADIUM_CAPACITY_UPGRADE_COST,
  TICKET_PRICE,
} from '../game/stadiumManagement';
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

const TICKET_OPTIONS: TicketPreset[] = ['LOW', 'STANDARD', 'PREMIUM'];

const FORMAT_GROUPS: {
  format: Format;
  linked: Format[];
  label: string;
  detail: string;
}[] = [
  {
    format: 'T20',
    linked: ['T10', 'T20', 'HUNDRED'],
    label: 'Short format',
    detail: 'T10 · T20 · Hundred',
  },
  { format: 'ODI', linked: ['ODI'], label: '50-over', detail: 'One-day matches' },
  { format: 'TEST', linked: ['TEST'], label: 'First-class', detail: 'Multi-day matches' },
];

function integer(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ClubStadiumScreen({ navigation }: ScreenProps<'ClubStadium'>) {
  const save = useCareer((state) => state.save);
  const setTicketPreset = useCareer((state) => state.setTicketPreset);
  const upgradeStadium = useCareer((state) => state.upgradeStadium);
  const upgradeMatchday = useCareer((state) => state.upgradeMatchday);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save || save.mode !== 'manager' || !save.userTeamId) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Home Ground" onBack={() => navigation.goBack()} />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Manager career required</Text>
        </Card>
      </Screen>
    );
  }

  if (save.managerCareerLevel === 'NATIONAL') {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Home Ground" onBack={() => navigation.goBack()} />
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Icon name="flag-outline" size={24} color={colors.primaryLight} />
          </View>
          <Text style={styles.emptyTitle}>National duty</Text>
        </Card>
      </Screen>
    );
  }

  const club = activeManagerClub(save);
  const team = save.teams[save.userTeamId];
  if (!club || !team) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Home Ground" onBack={() => navigation.goBack()} />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active club</Text>
        </Card>
      </Screen>
    );
  }

  const stadium = club.stadium;
  const summary = stadiumSummary(save);
  const capacityLevel = Math.max(1, Math.min(MAX_STADIUM_LEVEL, stadium.capacityLevel));
  const experienceLevel = Math.max(1, Math.min(MAX_STADIUM_LEVEL, stadium.experienceLevel));
  const experience = MATCHDAY_EXPERIENCE[experienceLevel];
  const nextCapacityLevel = Math.min(MAX_STADIUM_LEVEL, capacityLevel + 1);
  const nextExperienceLevel = Math.min(MAX_STADIUM_LEVEL, experienceLevel + 1);
  const capacityMaxed = capacityLevel >= MAX_STADIUM_LEVEL;
  const experienceMaxed = experienceLevel >= MAX_STADIUM_LEVEL;
  const capacityCost = capacityMaxed ? 0 : STADIUM_CAPACITY_UPGRADE_COST[nextCapacityLevel];
  const experienceCost = experienceMaxed ? 0 : MATCHDAY_EXPERIENCE[nextExperienceLevel].upgradeCost;
  const recent = stadium.attendanceHistory.slice(-5).reverse();
  const nextHomeFixture = Object.values(save.fixtures)
    .filter((fixture) => !fixture.played)
    .sort(
      (left, right) =>
        (left.calendarMonth ?? 99) - (right.calendarMonth ?? 99) ||
        left.round - right.round ||
        left.id.localeCompare(right.id),
    )
    .find((fixture) => Boolean(projectFixtureAttendance(save, fixture)));
  const nextProjection = nextHomeFixture
    ? projectFixtureAttendance(save, nextHomeFixture)
    : undefined;
  const nextOpponentId = nextHomeFixture
    ? nextHomeFixture.homeTeamId === save.userTeamId
      ? nextHomeFixture.awayTeamId
      : nextHomeFixture.homeTeamId
    : undefined;

  const confirmCapacityUpgrade = () => {
    if (capacityMaxed) return;
    Alert.alert(
      'Expand the ground?',
      `${integer(STADIUM_CAPACITY[nextCapacityLevel])} seats · ${formatClubCurrency(capacityCost)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Expand',
          onPress: () => {
            const result = upgradeStadium();
            Alert.alert(
              result.ok ? 'Ground expanded' : 'Cannot expand',
              result.ok
                ? `Capacity is now ${integer(STADIUM_CAPACITY[result.level ?? nextCapacityLevel])}.`
                : (result.reason ?? 'Unavailable.'),
            );
          },
        },
      ],
    );
  };

  const confirmExperienceUpgrade = () => {
    if (experienceMaxed) return;
    const next = MATCHDAY_EXPERIENCE[nextExperienceLevel];
    Alert.alert('Upgrade matchday?', `${next.label} · ${formatClubCurrency(experienceCost)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Upgrade',
        onPress: () => {
          const result = upgradeMatchday();
          Alert.alert(
            result.ok ? 'Matchday upgraded' : 'Cannot upgrade',
            result.ok ? `${next.label} is now active.` : (result.reason ?? 'Unavailable.'),
          );
        },
      },
    ]);
  };

  const chooseTicket = (formats: Format[], preset: TicketPreset) => {
    const changed = formats.every((format) => setTicketPreset(format, preset));
    if (!changed) Alert.alert('Cannot update tickets', 'Club operations are unavailable.');
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader title="Home Ground" subtitle={team.name} onBack={() => navigation.goBack()} />

      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroIcon}>
            <Icon name="business-outline" size={24} color={colors.accentLight} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>CLUB STADIUM</Text>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {stadium.name}
            </Text>
          </View>
          <View style={styles.balancePill}>
            <Text style={styles.balanceLabel}>BALANCE</Text>
            <Text style={styles.balanceValue}>{formatClubCurrency(team.budget)}</Text>
          </View>
        </View>
        <GroundDevelopment
          key={club.teamId}
          capacityLevel={capacityLevel}
          experienceLevel={experienceLevel}
          accent={team.primaryColor}
        />
        <View style={styles.heroStats}>
          <Stat label="Capacity" value={integer(summary?.capacity ?? stadiumCapacity(stadium))} />
          <Stat label="Fan base" value={integer(summary?.fanBase ?? stadium.fanBase)} />
          <Stat
            label="Avg crowd"
            value={summary?.averageAttendance ? integer(summary.averageAttendance) : '—'}
          />
        </View>
        <View style={styles.receiptsBand}>
          <View>
            <Text style={styles.receiptsLabel}>SEASON GATE RECEIPTS</Text>
            <Text style={styles.receiptsValue}>
              {formatClubCurrency(summary?.currentSeasonReceipts ?? 0)}
            </Text>
          </View>
          <View style={styles.occupancyCopy}>
            <Text style={styles.receiptsLabel}>AVG OCCUPANCY</Text>
            <Text style={styles.occupancyValue}>
              {summary?.averageAttendance ? percent(summary.averageOccupancy) : '—'}
            </Text>
          </View>
        </View>
      </Card>

      <Text style={styles.section}>Ground development</Text>
      <View style={styles.developmentGrid}>
        <Card style={styles.developmentCard}>
          <View style={styles.cardTitleRow}>
            <Icon name="people-outline" size={20} color={colors.primaryLight} />
            <View style={styles.cardTitleCopy}>
              <Text style={styles.cardTitle}>Capacity</Text>
              <Text style={styles.cardMeta}>
                Level {capacityLevel}/{MAX_STADIUM_LEVEL}
              </Text>
            </View>
          </View>
          <LevelPips level={capacityLevel} styles={styles} />
          <Text style={styles.developmentValue}>
            {integer(STADIUM_CAPACITY[capacityLevel])} seats
          </Text>
          <Text style={styles.developmentMeta}>
            Upkeep · {formatClubCurrency(stadiumSeasonUpkeep(stadium))}/season
          </Text>
          <Button
            label={
              capacityMaxed ? 'Maximum capacity' : `Expand · ${formatClubCurrency(capacityCost)}`
            }
            variant={capacityMaxed ? 'ghost' : 'secondary'}
            size="sm"
            disabled={capacityMaxed}
            style={styles.upgradeButton}
            onPress={confirmCapacityUpgrade}
          />
        </Card>

        <Card style={styles.developmentCard}>
          <View style={styles.cardTitleRow}>
            <Icon name="sparkles-outline" size={20} color={colors.accentLight} />
            <View style={styles.cardTitleCopy}>
              <Text style={styles.cardTitle}>Matchday</Text>
              <Text style={styles.cardMeta}>
                Level {experienceLevel}/{MAX_STADIUM_LEVEL}
              </Text>
            </View>
          </View>
          <LevelPips level={experienceLevel} styles={styles} />
          <Text style={styles.developmentValue}>{experience.label}</Text>
          <Text style={styles.developmentMeta}>Crowd experience</Text>
          <Button
            label={
              experienceMaxed
                ? 'Maximum experience'
                : `Upgrade · ${formatClubCurrency(experienceCost)}`
            }
            variant={experienceMaxed ? 'ghost' : 'gold'}
            size="sm"
            disabled={experienceMaxed}
            style={styles.upgradeButton}
            onPress={confirmExperienceUpgrade}
          />
        </Card>
      </View>

      <Text style={styles.section}>Ticket strategy</Text>
      <Card padded={false} style={styles.ticketCard}>
        {FORMAT_GROUPS.map((group, index) => {
          const selected = stadium.ticketPresets[group.format] ?? 'STANDARD';
          return (
            <View key={group.format} style={[styles.ticketRow, index > 0 && styles.rowDivider]}>
              <View style={styles.ticketHeader}>
                <View>
                  <Text style={styles.ticketFormat}>{group.label}</Text>
                  <Text style={styles.ticketDetail}>{group.detail}</Text>
                </View>
                <Text style={styles.ticketHint}>Lower price · larger crowd</Text>
              </View>
              <View style={styles.ticketOptions}>
                {TICKET_OPTIONS.map((preset) => {
                  const active = selected === preset;
                  return (
                    <Pressable
                      key={preset}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${group.label} ${preset.toLowerCase()} ticket price`}
                      onPress={() => chooseTicket(group.linked, preset)}
                      style={({ pressed }) => [
                        styles.ticketOption,
                        active && styles.ticketOptionActive,
                        pressed && styles.ticketOptionPressed,
                      ]}
                    >
                      <Text
                        style={[styles.ticketOptionName, active && styles.ticketOptionNameActive]}
                      >
                        {preset === 'STANDARD'
                          ? 'Standard'
                          : preset === 'PREMIUM'
                            ? 'Premium'
                            : 'Low'}
                      </Text>
                      <Text
                        style={[styles.ticketOptionPrice, active && styles.ticketOptionPriceActive]}
                      >
                        {formatClubCurrency(TICKET_PRICE[group.format][preset])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </Card>

      {nextHomeFixture && nextProjection ? (
        <>
          <Text style={styles.section}>Next home forecast</Text>
          <Card style={styles.forecastCard}>
            <View style={styles.forecastHeader}>
              <View style={styles.forecastCopy}>
                <Text style={styles.forecastOpponent} numberOfLines={1}>
                  v {nextOpponentId ? save.teams[nextOpponentId]?.name : 'Opponent'}
                </Text>
                <Text style={styles.forecastMeta}>
                  {nextHomeFixture.format} · {nextProjection.ticketPreset.toLowerCase()} tickets
                </Text>
              </View>
              <View style={styles.forecastGate}>
                <Text style={styles.forecastGateLabel}>PROJECTED GATE</Text>
                <Text style={styles.forecastGateValue}>
                  {formatClubCurrency(nextProjection.netReceipts)}
                </Text>
              </View>
            </View>
            <View style={styles.forecastStats}>
              <Stat label="Attendance" value={integer(nextProjection.attendance)} />
              <Stat label="Occupancy" value={percent(nextProjection.occupancy)} />
              <Stat label="Ticket" value={formatClubCurrency(nextProjection.ticketPrice)} />
            </View>
          </Card>
        </>
      ) : null}

      <Text style={styles.section}>Recent home crowds</Text>
      <Card padded={false} style={styles.historyCard}>
        {recent.length ? (
          recent.map((entry, index) => {
            const fixture = save.fixtures[entry.fixtureId];
            const opponentId = fixture
              ? fixture.homeTeamId === save.userTeamId
                ? fixture.awayTeamId
                : fixture.homeTeamId
              : undefined;
            const opponent = opponentId ? save.teams[opponentId]?.name : undefined;
            return (
              <View
                key={entry.fixtureId}
                style={[styles.historyRow, index > 0 && styles.rowDivider]}
              >
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {opponent ? `v ${opponent}` : 'Home fixture'}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {integer(entry.attendance)} / {integer(entry.capacity)} ·{' '}
                    {entry.ticketPreset.toLowerCase()}
                  </Text>
                </View>
                <Text style={styles.historyReceipt}>{formatClubCurrency(entry.netReceipts)}</Text>
              </View>
            );
          })
        ) : (
          <View style={styles.historyEmpty}>
            <Icon name="ticket-outline" size={20} color={colors.textFaint} />
            <Text style={styles.historyMeta}>No home crowds yet.</Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function LevelPips({ level, styles }: { level: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.pips}>
      {Array.from({ length: MAX_STADIUM_LEVEL }).map((_, index) => (
        <View key={index} style={[styles.pip, index < level && styles.pipActive]} />
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    emptyCard: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.xxl },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      marginBottom: spacing.md,
    },
    emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    emptyCopy: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    heroCard: {
      marginTop: spacing.md,
      borderColor: colors.borderStrong,
      backgroundColor: colors.bgElevated,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    heroCopy: { flex: 1, minWidth: 0 },
    kicker: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1.2,
    },
    heroTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    balancePill: { alignItems: 'flex-end', maxWidth: 108 },
    balanceLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    balanceValue: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    heroStats: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
    },
    stat: { flex: 1, minWidth: 0 },
    statValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.black },
    statLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    receiptsBand: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      marginTop: spacing.md,
    },
    receiptsLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.8,
    },
    receiptsValue: {
      color: colors.primaryLight,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    occupancyCopy: { alignItems: 'flex-end' },
    occupancyValue: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      marginTop: 2,
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
    developmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    developmentCard: { flex: 1, minWidth: 260 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cardTitleCopy: { flex: 1 },
    cardTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    cardMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },
    pips: { flexDirection: 'row', gap: 5, marginTop: spacing.md },
    pip: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    pipActive: { backgroundColor: colors.primary },
    developmentValue: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: spacing.md,
    },
    developmentMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: spacing.xs,
      minHeight: 32,
    },
    upgradeButton: { marginTop: spacing.md },
    ticketCard: { backgroundColor: colors.bgElevated },
    ticketRow: { padding: spacing.md },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    ticketHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    ticketFormat: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    ticketDetail: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },
    ticketHint: { color: colors.textFaint, fontSize: fontSize.xs },
    ticketOptions: { flexDirection: 'row', gap: spacing.xs },
    ticketOption: {
      flex: 1,
      minWidth: 0,
      minHeight: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.xs,
    },
    ticketOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceAlt,
    },
    ticketOptionPressed: { opacity: 0.78 },
    ticketOptionName: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    ticketOptionNameActive: { color: colors.primaryLight },
    ticketOptionPrice: { color: colors.text, fontSize: fontSize.sm, marginTop: 2 },
    ticketOptionPriceActive: { color: colors.text, fontWeight: fontWeight.black },
    forecastCard: {
      borderColor: colors.borderStrong,
      backgroundColor: colors.bgElevated,
    },
    forecastHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    forecastCopy: { flex: 1, minWidth: 0 },
    forecastOpponent: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
    },
    forecastMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    forecastGate: { alignItems: 'flex-end' },
    forecastGateLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.7,
    },
    forecastGateValue: {
      color: colors.primaryLight,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    forecastStats: {
      flexDirection: 'row',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    historyCard: { marginBottom: spacing.xl },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    historyCopy: { flex: 1, minWidth: 0 },
    historyTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    historyMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    historyReceipt: {
      color: colors.primaryLight,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    historyEmpty: {
      minHeight: 86,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
  });
