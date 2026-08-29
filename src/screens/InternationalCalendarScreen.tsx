import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { getCountry } from '../data/countries';
import {
  buildIntlCalendar,
  internationalWindowFixtureIds,
  wtcStandings,
} from '../game/intlCalendar';
import {
  INTERNATIONAL_PLAYER_RANKING_LABEL,
  INTERNATIONAL_RANKING_FORMAT_LABEL,
  internationalPlayerRankings,
  InternationalPlayerRankingKind,
  internationalTeamRankings,
  InternationalRankingFormat,
} from '../game/internationalRankings';
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
  const [teamRankingFormat, setTeamRankingFormat] = useState<InternationalRankingFormat>('TEST');
  const [playerRankingFormat, setPlayerRankingFormat] =
    useState<InternationalRankingFormat>('TEST');
  const [playerRankingKind, setPlayerRankingKind] =
    useState<InternationalPlayerRankingKind>('BATTING');

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
  const isNationalManager = save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL';
  const managedNationalCountry = isNationalManager
    ? save.managerNationalTeamId
      ? save.teams[save.managerNationalTeamId]?.country
      : save.userTeamId
        ? save.teams[save.userTeamId]?.country
        : undefined
    : undefined;
  const controlledCountry = isNationalManager ? managedNationalCountry : userCountry;
  const userCountryName = controlledCountry
    ? (getCountry(controlledCountry)?.name ?? 'Your country')
    : '-';
  const windowFixtures = internationalWindowFixtureIds(save).map((id) => save.fixtures[id]);
  const testTable = wtcStandings(save, currentYear);
  const teamRankings = internationalTeamRankings(save, teamRankingFormat).slice(0, 10);
  const playerRankings = internationalPlayerRankings(save, playerRankingFormat, playerRankingKind);
  const playerTopTen = playerRankings.slice(0, 10);
  const userRanking = playerRankings.find((row) => row.isUser);
  const visiblePlayerRankings =
    userRanking && userRanking.rank > 10 ? [...playerTopTen, userRanking] : playerTopTen;
  const selectedRankingPeak =
    save.internationalPlayerRankingPeaks?.[playerRankingFormat]?.[playerRankingKind];
  const controlsInternationalTeam = save.capped || isNationalManager;

  return (
    <Screen scroll>
      <ScreenHeader title="International Calendar" onBack={() => navigation.goBack()} />

      <Card style={styles.windowCard}>
        <Text style={styles.sectionLabel}>INTERNATIONAL DUTY</Text>
        <Text style={styles.windowTitle}>Tours and ICC events</Text>
        {controlsInternationalTeam ? (
          <Text style={styles.windowProgress}>
            {windowFixtures.filter((fixture) => fixture.played).length}/{windowFixtures.length}{' '}
            matches completed
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

      {isNationalManager ? (
        <>
          <Text style={styles.section}>World Team Rankings</Text>
          <RankingTabs
            values={['TEST', 'ODI', 'T20']}
            selected={teamRankingFormat}
            label={(value) => INTERNATIONAL_RANKING_FORMAT_LABEL[value]}
            onSelect={setTeamRankingFormat}
            styles={styles}
          />
          <Card style={styles.rankingCard}>
            <View style={styles.teamRankingHeader}>
              <Text style={styles.rankHeaderPos}>POS</Text>
              <Text style={styles.rankHeaderName}>TEAM</Text>
              <Text style={styles.rankHeaderMetric}>M</Text>
              <Text style={styles.rankHeaderMetric}>PTS</Text>
              <Text style={styles.rankHeaderMetric}>RATING</Text>
            </View>
            {teamRankings.map((entry, index) => {
              const isManaged = entry.countryId === controlledCountry;
              return (
                <View
                  key={entry.countryId}
                  style={[
                    styles.teamRankingRow,
                    index > 0 && styles.rankingDivider,
                    isManaged && styles.currentRankingRow,
                  ]}
                >
                  <Text style={styles.teamRankPosition}>{entry.rank}</Text>
                  <Text
                    style={[styles.teamRankName, isManaged && styles.currentRankingText]}
                    numberOfLines={1}
                  >
                    {getCountry(entry.countryId)?.flag ?? ''}{' '}
                    {getCountry(entry.countryId)?.name ?? 'National side'}
                  </Text>
                  <Text style={styles.teamRankMetric}>{entry.matches}</Text>
                  <Text style={styles.teamRankMetric}>{entry.points}</Text>
                  <Text style={[styles.teamRankMetric, styles.teamRankRating]}>{entry.rating}</Text>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {save.mode === 'career' && save.capped ? (
        <>
          <Text style={styles.section}>World Player Rankings</Text>
          <RankingTabs
            values={['TEST', 'ODI', 'T20']}
            selected={playerRankingFormat}
            label={(value) => INTERNATIONAL_RANKING_FORMAT_LABEL[value]}
            onSelect={setPlayerRankingFormat}
            styles={styles}
          />
          <RankingTabs
            values={['BATTING', 'BOWLING', 'ALL_ROUNDER']}
            selected={playerRankingKind}
            label={(value) => INTERNATIONAL_PLAYER_RANKING_LABEL[value]}
            onSelect={setPlayerRankingKind}
            styles={styles}
            compact
          />
          {selectedRankingPeak ? (
            <Card style={styles.careerBestCard}>
              <Text style={styles.sectionLabel}>CAREER BEST</Text>
              <View style={styles.careerBestRow}>
                <View style={styles.careerBestItem}>
                  <Text style={styles.careerBestValue}>#{selectedRankingPeak.bestRank}</Text>
                  <Text style={styles.careerBestLabel}>
                    Best rank · {selectedRankingPeak.bestRankYear} · age{' '}
                    {selectedRankingPeak.bestRankAge}
                  </Text>
                  <Text style={styles.careerBestMeta}>
                    {selectedRankingPeak.ratingAtBestRank} rating
                  </Text>
                </View>
                <View style={styles.careerBestDivider} />
                <View style={styles.careerBestItem}>
                  <Text style={styles.careerBestValue}>{selectedRankingPeak.bestRating}</Text>
                  <Text style={styles.careerBestLabel}>
                    Peak rating · {selectedRankingPeak.bestRatingYear} · age{' '}
                    {selectedRankingPeak.bestRatingAge}
                  </Text>
                  <Text style={styles.careerBestMeta}>
                    Ranked #{selectedRankingPeak.rankAtBestRating}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}
          <Card style={styles.rankingCard}>
            <View style={styles.playerRankingHeader}>
              <Text style={styles.rankHeaderPos}>POS</Text>
              <Text style={styles.rankHeaderName}>PLAYER</Text>
              <Text style={styles.playerRankHeaderRating}>RATING</Text>
            </View>
            {visiblePlayerRankings.length > 0 ? (
              visiblePlayerRankings.map((entry, index) => (
                <View
                  key={entry.playerId}
                  style={[
                    styles.playerRankingRow,
                    index > 0 && styles.rankingDivider,
                    entry.isUser && styles.currentRankingRow,
                    index === 10 && styles.pinnedRankingRow,
                  ]}
                >
                  <Text style={styles.playerRankPosition}>{entry.rank}</Text>
                  <View style={styles.playerRankIdentity}>
                    <Text
                      style={[styles.playerRankName, entry.isUser && styles.currentRankingText]}
                      numberOfLines={1}
                    >
                      {entry.name}
                      {entry.isUser ? ' (You)' : ''}
                    </Text>
                    <Text style={styles.playerRankCountry} numberOfLines={1}>
                      {getCountry(entry.countryId)?.flag ?? ''}{' '}
                      {getCountry(entry.countryId)?.name ?? 'International'}
                    </Text>
                  </View>
                  <Text style={styles.playerRankRating}>{entry.rating}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyRankings}>Rankings appear after international matches.</Text>
            )}
          </Card>
        </>
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
                    entry.countryId === controlledCountry && { color: colors.accent },
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

      <Button
        label="Back"
        variant="ghost"
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}

interface RankingTabsProps<T extends string> {
  values: readonly T[];
  selected: T;
  label: (value: T) => string;
  onSelect: (value: T) => void;
  styles: ReturnType<typeof makeStyles>;
  compact?: boolean;
}

function RankingTabs<T extends string>({
  values,
  selected,
  label,
  onSelect,
  styles,
  compact = false,
}: RankingTabsProps<T>) {
  return (
    <View style={[styles.rankingTabs, compact && styles.rankingTabsCompact]}>
      {values.map((value) => {
        const active = value === selected;
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.rankingTab,
              compact && styles.rankingTabCompact,
              active && styles.rankingTabActive,
            ]}
            onPress={() => onSelect(value)}
          >
            <Text
              style={[styles.rankingTabText, active && styles.rankingTabTextActive]}
              numberOfLines={1}
            >
              {label(value)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
    selectionBadgeText: {
      color: colors.success,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
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
    rankingTabs: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    rankingTabsCompact: { marginTop: spacing.xs },
    rankingTab: {
      flex: 1,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.sm,
    },
    rankingTabCompact: { minHeight: 38, paddingHorizontal: spacing.xs },
    rankingTabActive: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
    rankingTabText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    rankingTabTextActive: { color: colors.accent },
    rankingCard: { paddingVertical: spacing.xs },
    careerBestCard: { marginBottom: spacing.sm },
    careerBestRow: { flexDirection: 'row', alignItems: 'stretch' },
    careerBestItem: { flex: 1, minWidth: 0 },
    careerBestDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderStrong,
      marginHorizontal: spacing.md,
    },
    careerBestValue: {
      color: colors.accent,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
    },
    careerBestLabel: { color: colors.text, fontSize: fontSize.xs, marginTop: 2 },
    careerBestMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
    teamRankingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.xs,
    },
    playerRankingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: spacing.xs,
    },
    rankHeaderPos: {
      width: 34,
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    rankHeaderName: {
      flex: 1,
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
    },
    rankHeaderMetric: {
      width: 42,
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textAlign: 'right',
    },
    playerRankHeaderRating: {
      width: 56,
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textAlign: 'right',
    },
    teamRankingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 45,
    },
    rankingDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    currentRankingRow: {
      backgroundColor: colors.accent + '14',
      marginHorizontal: -spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
    },
    pinnedRankingRow: { marginTop: spacing.xs, borderTopColor: colors.accent },
    currentRankingText: { color: colors.accent },
    teamRankPosition: {
      width: 34,
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      textAlign: 'center',
    },
    teamRankName: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    teamRankMetric: {
      width: 42,
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'right',
    },
    teamRankRating: { color: colors.text, fontWeight: fontWeight.black },
    playerRankingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 54,
    },
    playerRankPosition: {
      width: 34,
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      textAlign: 'center',
    },
    playerRankIdentity: { flex: 1, minWidth: 0 },
    playerRankName: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    playerRankCountry: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
    playerRankRating: {
      width: 56,
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      textAlign: 'right',
    },
    emptyRankings: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      paddingVertical: spacing.md,
      textAlign: 'center',
    },
    backButton: { marginTop: spacing.xl },
  });
