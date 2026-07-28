/**
 * InternationalCalendarScreen — 4-year ICC event cycle view.
 * Feature 8: upcoming events, global tournaments, player's international record.
 */
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { getCountry } from '../data/countries';
import {
  buildIntlCalendar,
  internationalWindowFixtureIds,
  topIccTeams,
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
const EVENT_ICONS: Record<string, string> = {
  WC: '🏆',
  WTC: '🏆',
  CT: '🥇',
  SERIES: '🏏',
};

export function InternationalCalendarScreen({ navigation }: ScreenProps<'InternationalCalendar'>) {
  const save = useCareer((s) => s.save);
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
  const generatedCalendar = buildIntlCalendar(currentYear, save);
  const calendar =
    save.internationalCalendar?.year === currentYear &&
    save.internationalCalendar.events[0]?.id === generatedCalendar.events[0]?.id
      ? save.internationalCalendar
      : generatedCalendar;
  const userPlayer = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const userCountry =
    save.playerCareerResources?.cappedCountry ??
    save.playerCareerResources?.declaredCountry ??
    userPlayer?.nationality;
  const userCountryName = userCountry ? (getCountry(userCountry)?.name ?? userCountry) : '—';
  const topTeams = topIccTeams(save, 5);

  const upcomingEvents = calendar.events;
  const windowFixtures = internationalWindowFixtureIds(save).map((id) => save.fixtures[id]);

  return (
    <Screen scroll>
      <ScreenHeader title="International Calendar" onBack={() => navigation.goBack()} />

      <Card style={styles.windowCard}>
        <Text style={styles.sectionLabel}>ANNUAL INTERNATIONAL WINDOW</Text>
        <Text style={styles.windowTitle}>June to August</Text>
        <Text style={styles.windowBody}>
          Domestic cricket pauses for national camps and the season's global ICC event.
        </Text>
        {save.capped ? (
          <Text style={styles.windowProgress}>
            {windowFixtures.filter((fixture) => fixture.played).length}/{windowFixtures.length}{' '}
            scheduled matches completed
          </Text>
        ) : null}
      </Card>

      {/* Player's international record */}
      {save.capped && userPlayer && (
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
            {userPlayer.formatStats && (
              <View style={styles.formatStats}>
                {(['ODI', 'T20', 'TEST'] as const).map((fmt) => {
                  const fs = userPlayer.formatStats?.[fmt];
                  if (!fs?.matches) return null;
                  return (
                    <View key={fmt} style={styles.formatStatItem}>
                      <Text style={styles.formatLabel}>{fmt}</Text>
                      <Text style={styles.formatValue}>{fs.matches}M</Text>
                      <Text style={styles.formatValue}>{fs.runs}R</Text>
                      <Text style={styles.formatValue}>{fs.wickets}W</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </Animated.View>
      )}

      {/* Upcoming events */}
      <Text style={styles.section}>Upcoming Events ({currentYear})</Text>
      {upcomingEvents.length > 0 ? (
        upcomingEvents.map((ev, idx) => (
          <Animated.View key={ev.id} entering={FadeInDown.duration(320).delay(idx * 50)}>
            <Card style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventIcon}>{EVENT_ICONS[ev.type] ?? '🏏'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventName}>{ev.name}</Text>
                  <Text style={styles.eventMeta}>
                    {ev.format} · {ev.months.map((m) => MONTH_NAMES[m] ?? m).join(' – ')}
                  </Text>
                </View>
                {ev.teams.includes(userCountry ?? '') && (
                  <View style={styles.qualBadge}>
                    <Text style={styles.qualBadgeText}>You're in</Text>
                  </View>
                )}
              </View>
              <Text style={styles.teamsLine}>
                {ev.teams
                  .slice(0, 4)
                  .map((t) => getCountry(t)?.name ?? t)
                  .join(' · ')}
                {ev.teams.length > 4 && ` + ${ev.teams.length - 4} more`}
              </Text>
            </Card>
          </Animated.View>
        ))
      ) : (
        <Card>
          <Text style={styles.emptyText}>No upcoming events this season.</Text>
        </Card>
      )}

      {/* ICC Rankings */}
      {topTeams.length > 0 && (
        <>
          <Text style={styles.section}>ICC Rankings (Top 5)</Text>
          <Animated.View entering={FadeInDown.duration(340).delay(200)}>
            <Card>
              {topTeams.map((entry, idx) => (
                <View
                  key={entry.teamId}
                  style={[
                    styles.rankRow,
                    idx > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                >
                  <Text style={styles.rankPos}>{idx + 1}</Text>
                  <Text
                    style={[
                      styles.rankTeam,
                      entry.teamId === userCountry && { color: colors.accent },
                    ]}
                  >
                    {getCountry(entry.teamId)?.name ?? entry.teamId}
                    {entry.teamId === userCountry ? ' ★' : ''}
                  </Text>
                  <Text style={styles.rankPoints}>{entry.points} pts</Text>
                </View>
              ))}
            </Card>
          </Animated.View>
        </>
      )}

      <Button
        label="Back"
        variant="ghost"
        style={{ marginTop: spacing.xl }}
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
    windowCard: {
      marginTop: spacing.lg,
      borderLeftColor: colors.info,
      borderLeftWidth: 3,
    },
    windowTitle: {
      color: colors.info,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
    },
    windowProgress: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: spacing.sm,
    },
    windowBody: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginTop: spacing.xs,
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
    eventIcon: { fontSize: 20 },
    eventName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    eventMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    qualBadge: {
      backgroundColor: colors.success + '22',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    qualBadgeText: { color: colors.success, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    teamsLine: { color: colors.textFaint, fontSize: fontSize.xs },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      padding: spacing.md,
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
    rankPoints: { color: colors.textMuted, fontSize: fontSize.sm },
  });
