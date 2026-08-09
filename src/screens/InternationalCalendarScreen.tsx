import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { getCountry } from '../data/countries';
import {
  buildIntlCalendar,
  internationalWindowFixtureIds,
  topIccTeams,
  wtcStandings,
} from '../game/intlCalendar';
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

const MONTH_NAMES = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const EVENT_MARK: Record<string, string> = {
  WC: 'WC',
  WTC: 'WTC',
  CT: 'CT',
  SERIES: 'S',
};

export function InternationalCalendarScreen({ navigation }: ScreenProps<'InternationalCalendar'>) {
  const save = useCareer((state) => state.save);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="International Calendar" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active save.</Text>
      </Screen>
    );
  }

  const currentYear = save.currentSeasonId
    ? (save.seasons[save.currentSeasonId]?.year ?? 2026)
    : 2026;
  const calendar = buildIntlCalendar(currentYear, save);
  const userPlayer = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const userCountry =
    save.playerCareerResources?.cappedCountry ??
    save.playerCareerResources?.declaredCountry ??
    userPlayer?.nationality;
  const userCountryName = userCountry ? (getCountry(userCountry)?.name ?? 'Your country') : '-';
  const windowFixtures = internationalWindowFixtureIds(save).map((id) => save.fixtures[id]);
  const testTable = wtcStandings(save, currentYear);
  const topTeams = topIccTeams(save, 5);

  return (
    <Screen scroll>
      <ScreenHeader title="International Calendar" onBack={() => navigation.goBack()} />

      <Card style={styles.windowCard}>
        <Text style={styles.sectionLabel}>YEAR-ROUND INTERNATIONAL DUTY</Text>
        <Text style={styles.windowTitle}>Tours plus ICC windows</Text>
        <Text style={styles.windowBody}>
          White-ball tours overlap List A, WTC Test series overlap First-Class cricket, and global
          events remain in June-August. Your domestic contract stays active between call-ups.
        </Text>
        {save.capped ? (
          <Text style={styles.windowProgress}>
            {windowFixtures.filter((fixture) => fixture.played).length}/{windowFixtures.length}{' '}
            selected international matches completed
          </Text>
        ) : null}
      </Card>

      {save.capped && userPlayer ? (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card style={styles.recordCard}>
            <Text style={styles.sectionLabel}>YOUR INTERNATIONAL RECORD</Text>
            <View style={styles.capRow}>
              <Text style={styles.capCount}>{save.userCaps ?? 0}</Text>
              <View>
                <Text style={styles.capLabel}>International Caps</Text>
                <Text style={styles.capCountry}>{userCountryName}</Text>
              </View>
            </View>
            {userPlayer.formatStats ? (
              <View style={styles.formatStats}>
                {(['ODI', 'T20', 'TEST'] as const).map((format) => {
                  const stats = userPlayer.formatStats?.[format];
                  if (!stats?.matches) return null;
                  return (
                    <View key={format} style={styles.formatStatItem}>
                      <Text style={styles.formatLabel}>{format}</Text>
                      <Text style={styles.formatValue}>{stats.matches}M</Text>
                      <Text style={styles.formatValue}>{stats.runs}R</Text>
                      <Text style={styles.formatValue}>{stats.wickets}W</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      <Text style={styles.section}>Assignments ({currentYear})</Text>
      {calendar.events.map((event, index) => (
        <Animated.View key={event.id} entering={FadeInDown.duration(320).delay(index * 50)}>
          <Card style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <View style={styles.eventMark}>
                <Text style={styles.eventMarkText}>{EVENT_MARK[event.type] ?? 'S'}</Text>
              </View>
              <View style={styles.eventCopy}>
                <Text style={styles.eventName}>{event.name}</Text>
                <Text style={styles.eventMeta}>
                  {event.format} |{' '}
                  {event.months.map((month) => MONTH_NAMES[month] ?? month).join(' - ')}
                </Text>
              </View>
              {event.selection ? (
                <View
                  style={[
                    styles.selectionBadge,
                    event.selection === 'NOT_SELECTED' && styles.selectionBadgeWarning,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectionBadgeText,
                      event.selection === 'NOT_SELECTED' && styles.selectionTextWarning,
                    ]}
                  >
                    {event.selection === 'SELECTED'
                      ? 'Selected'
                      : event.selection === 'NOT_SELECTED'
                        ? 'Not selected'
                        : 'Pending'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.teamsLine}>
              {event.teams
                .slice(0, 4)
                .map((country) => getCountry(country)?.name ?? 'National side')
                .join(' | ')}
              {event.teams.length > 4 ? ` + ${event.teams.length - 4} more` : ''}
            </Text>
            {event.selectionReason ? (
              <Text style={styles.selectionReason}>{event.selectionReason}</Text>
            ) : null}
          </Card>
        </Animated.View>
      ))}

      {testTable.length > 0 ? (
        <>
          <Text style={styles.section}>World Test Championship</Text>
          <Card>
            {testTable.map((entry, index) => (
              <View
                key={entry.countryId}
                style={[
                  styles.rankRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.rankPos}>{index + 1}</Text>
                <Text
                  style={[
                    styles.rankTeam,
                    entry.countryId === userCountry && { color: colors.accent },
                  ]}
                >
                  {getCountry(entry.countryId)?.name ?? 'National side'}
                </Text>
                <Text style={styles.rankPoints}>
                  {entry.points} pts | {entry.played} Tests
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {topTeams.length > 0 ? (
        <>
          <Text style={styles.section}>ICC Rankings</Text>
          <Card>
            {topTeams.map((entry, index) => (
              <View
                key={entry.teamId}
                style={[
                  styles.rankRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Text style={styles.rankPos}>{index + 1}</Text>
                <Text
                  style={[
                    styles.rankTeam,
                    entry.teamId === userCountry && { color: colors.accent },
                  ]}
                >
                  {getCountry(entry.teamId)?.name ?? 'National side'}
                  {entry.teamId === userCountry ? ' (You)' : ''}
                </Text>
                <Text style={styles.rankPoints}>{entry.points} pts</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Button
        label="Back"
        variant="ghost"
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.lg },
    sectionLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
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
    recordCard: { marginTop: spacing.lg },
    windowCard: { marginTop: spacing.lg, borderLeftColor: colors.info, borderLeftWidth: 3 },
    windowTitle: { color: colors.info, fontSize: fontSize.xl, fontWeight: fontWeight.black },
    windowBody: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginTop: spacing.xs,
    },
    windowProgress: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: spacing.sm,
    },
    capRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    capCount: { color: colors.accent, fontSize: 48, fontWeight: fontWeight.black },
    capLabel: { color: colors.textMuted, fontSize: fontSize.sm },
    capCountry: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    formatStats: {
      flexDirection: 'row',
      gap: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    formatStatItem: { alignItems: 'center' },
    formatLabel: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginBottom: 2,
    },
    formatValue: { color: colors.textMuted, fontSize: fontSize.xs },
    eventCard: { marginBottom: spacing.sm },
    eventHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    eventMark: {
      width: 34,
      height: 34,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventMarkText: { color: colors.accent, fontSize: 10, fontWeight: fontWeight.black },
    eventCopy: { flex: 1, minWidth: 0 },
    eventName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    eventMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    selectionBadge: {
      borderWidth: 1,
      borderColor: colors.success,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    selectionBadgeWarning: { borderColor: colors.warning },
    selectionBadgeText: { color: colors.success, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    selectionTextWarning: { color: colors.warning },
    teamsLine: { color: colors.textFaint, fontSize: fontSize.xs },
    selectionReason: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.xs,
    },
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    rankPos: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      width: 24,
      textAlign: 'center',
    },
    rankTeam: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    rankPoints: { color: colors.textMuted, fontSize: fontSize.xs },
    backButton: { marginTop: spacing.xl },
  });
