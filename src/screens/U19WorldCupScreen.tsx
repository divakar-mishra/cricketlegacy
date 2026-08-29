import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import type { Fixture, Team, U19WorldCupStatus } from '../domain/types';
import { fixtureEnergyCost } from '../game/economy';
import { playerCalendarAllowsFixture } from '../game/playerCalendar';
import {
  getU19WorldCupFixturesByRound,
  getU19WorldCupState,
  isU19WorldCupTournamentComplete,
  nextU19WorldCupUserFixture,
  nextU19WorldCupUserFixtureId,
  U19_WORLD_CUP_MIN_APPEARANCES,
  U19_WORLD_CUP_MIN_AVERAGE_RATING,
  U19_WORLD_CUP_MIN_READINESS,
  u19WorldCupControlledTeamId,
  u19WorldCupSelectionStatus,
} from '../game/u19WorldCup';
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

const APPEARANCE_TARGET = U19_WORLD_CUP_MIN_APPEARANCES;
const RATING_TARGET = U19_WORLD_CUP_MIN_AVERAGE_RATING;
const READINESS_TARGET = U19_WORLD_CUP_MIN_READINESS;

type StatusPresentation = {
  label: string;
  tone: 'neutral' | 'active' | 'success';
};

function statusPresentation(
  status: U19WorldCupStatus,
  tournamentComplete: boolean,
  hasFixtures: boolean,
): StatusPresentation {
  switch (status) {
    case 'TRACKING':
      return { label: 'Selection in progress', tone: 'neutral' };
    case 'SELECTED':
      if (tournamentComplete) return { label: 'Tournament complete', tone: 'neutral' };
      return { label: hasFixtures ? 'Tournament active' : 'Squad selected', tone: 'active' };
    case 'NOT_SELECTED':
      return { label: 'Selection missed', tone: 'neutral' };
    case 'ELIMINATED':
      return { label: 'Eliminated', tone: 'neutral' };
    case 'RUNNER_UP':
      return { label: 'Runners-up', tone: 'active' };
    case 'CHAMPION':
      return { label: 'Champions', tone: 'success' };
  }
}

function teamName(teams: Record<string, Team>, teamId?: string): string {
  if (!teamId) return 'Team pending';
  return teams[teamId]?.name ?? 'Team pending';
}

export function U19WorldCupScreen({ navigation }: ScreenProps<'U19WorldCup'>) {
  const save = useCareer((state) => state.save);
  const setTargetFixture = useCareer((state) => state.setTargetFixture);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="U19 World Cup" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active career.</Text>
      </Screen>
    );
  }

  const cup = getU19WorldCupState(save);
  const selection = u19WorldCupSelectionStatus(save);
  const controlledTeamId = u19WorldCupControlledTeamId(save);
  const rounds = getU19WorldCupFixturesByRound(save);
  const nextFixture = nextU19WorldCupUserFixture(save);
  const nextFixtureEnergy = nextFixture ? fixtureEnergyCost(nextFixture) : 0;
  const nextFixtureIsDue = Boolean(
    nextFixture && playerCalendarAllowsFixture(save, nextFixture.id),
  );
  const canPlayNextFixture = Boolean(
    nextFixtureIsDue && nextFixture && save.wallet.energy >= nextFixtureEnergy,
  );
  const allFixtures = [...rounds.quarterFinals, ...rounds.semiFinals, ...rounds.final];
  const tournamentComplete = isU19WorldCupTournamentComplete(save);
  const status = cup?.status ?? selection.status;
  const presentation = statusPresentation(status, tournamentComplete, allFixtures.length > 0);
  const controlledTeamName = teamName(save.teams, controlledTeamId);

  const statusColor =
    presentation.tone === 'success'
      ? colors.success
      : presentation.tone === 'active'
        ? colors.accent
        : colors.textMuted;

  const playNextMatch = () => {
    const nextFixtureId = nextU19WorldCupUserFixtureId(save);
    if (!nextFixtureId) return;
    setTargetFixture(nextFixtureId);
    navigation.navigate('Match');
  };

  return (
    <Screen scroll>
      <ScreenHeader title="U19 World Cup" onBack={() => navigation.goBack()} />

      <Animated.View entering={FadeInDown.duration(280)}>
        <Card style={[styles.statusCard, { borderColor: statusColor + '88' }]}>
          <View style={styles.statusRow}>
            <View style={styles.statusCopy}>
              <Text style={styles.statusKicker}>Your campaign</Text>
              <Text style={styles.teamTitle}>
                {controlledTeamId ? controlledTeamName : 'Age-18 U19 selection'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                {presentation.label}
              </Text>
            </View>
          </View>

          <View style={styles.meritGrid}>
            <MeritItem
              label="Appearances"
              value={`${selection.merit.appearances}/${APPEARANCE_TARGET}`}
              passed={selection.merit.appearances >= APPEARANCE_TARGET}
            />
            <MeritItem
              label="Avg rating"
              value={`${selection.merit.averageRating.toFixed(1)}/${RATING_TARGET.toFixed(1)}`}
              passed={selection.merit.averageRating >= RATING_TARGET}
            />
            <MeritItem
              label="Readiness"
              value={`${Math.round(selection.merit.readiness * 100)}%/${Math.round(
                READINESS_TARGET * 100,
              )}%`}
              passed={selection.merit.readiness >= READINESS_TARGET}
            />
          </View>

          {nextFixture && nextFixtureIsDue ? (
            <Button
              label={
                canPlayNextFixture
                  ? `Play ${nextFixture.cupRound ?? 'next match'}`
                  : `Restore energy · need ${nextFixtureEnergy}`
              }
              variant="gold"
              style={{ marginTop: spacing.md }}
              onPress={() =>
                canPlayNextFixture ? playNextMatch() : navigation.navigate('Purchase')
              }
            />
          ) : nextFixture ? (
            <>
              <Text style={styles.scheduleNote}>
                Your tournament match is on the upcoming calendar. Advance from Career Home to reach
                it.
              </Text>
              <Button
                label="Return to Career Home"
                variant="secondary"
                size="sm"
                style={{ marginTop: spacing.sm }}
                onPress={() => navigation.navigate('CareerHub')}
              />
            </>
          ) : null}
        </Card>
      </Animated.View>

      {allFixtures.length > 0 ? (
        <>
          <Text style={styles.section}>
            {tournamentComplete ? 'Tournament complete' : 'Tournament'}
          </Text>
          <TournamentRound
            label="Quarter-finals"
            fixtures={rounds.quarterFinals}
            teams={save.teams}
            controlledTeamId={controlledTeamId}
            nextFixtureId={nextFixture?.id}
          />
          <TournamentRound
            label="Semi-finals"
            fixtures={rounds.semiFinals}
            teams={save.teams}
            controlledTeamId={controlledTeamId}
            nextFixtureId={nextFixture?.id}
          />
          <TournamentRound
            label="Final"
            fixtures={rounds.final}
            teams={save.teams}
            controlledTeamId={controlledTeamId}
            nextFixtureId={nextFixture?.id}
          />
        </>
      ) : null}
    </Screen>
  );
}

function MeritItem({ label, value, passed }: { label: string; value: string; passed: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.meritItem}>
      <Text style={[styles.meritValue, passed && { color: colors.success }]}>{value}</Text>
      <Text style={styles.meritLabel}>{label}</Text>
    </View>
  );
}

function TournamentRound({
  label,
  fixtures,
  teams,
  controlledTeamId,
  nextFixtureId,
}: {
  label: string;
  fixtures: Fixture[];
  teams: Record<string, Team>;
  controlledTeamId?: string;
  nextFixtureId?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Text style={styles.roundLabel}>{label}</Text>
      {fixtures.length > 0 ? (
        fixtures.map((fixture) => (
          <TournamentMatch
            key={fixture.id}
            fixture={fixture}
            teams={teams}
            controlledTeamId={controlledTeamId}
            isNext={fixture.id === nextFixtureId}
          />
        ))
      ) : (
        <View style={styles.pendingRound}>
          <Text style={styles.pendingText}>Awaiting earlier results</Text>
        </View>
      )}
    </Animated.View>
  );
}

function TournamentMatch({
  fixture,
  teams,
  controlledTeamId,
  isNext,
}: {
  fixture: Fixture;
  teams: Record<string, Team>;
  controlledTeamId?: string;
  isNext: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const result = fixture.played
    ? fixture.winnerTeamId
      ? `${teamName(teams, fixture.winnerTeamId)} won`
      : 'Match tied'
    : isNext
      ? 'Your next match'
      : 'Upcoming';

  return (
    <View style={[styles.matchCard, isNext && { borderColor: colors.accent }]}>
      <TeamRow
        name={teamName(teams, fixture.homeTeamId)}
        isUser={fixture.homeTeamId === controlledTeamId}
        isWinner={fixture.played && fixture.winnerTeamId === fixture.homeTeamId}
        played={fixture.played}
      />
      <View style={styles.matchDivider} />
      <TeamRow
        name={teamName(teams, fixture.awayTeamId)}
        isUser={fixture.awayTeamId === controlledTeamId}
        isWinner={fixture.played && fixture.winnerTeamId === fixture.awayTeamId}
        played={fixture.played}
      />
      <Text
        style={[
          styles.resultText,
          isNext && { color: colors.accent },
          fixture.winnerTeamId === controlledTeamId && { color: colors.success },
        ]}
      >
        {result}
      </Text>
    </View>
  );
}

function TeamRow({
  name,
  isUser,
  isWinner,
  played,
}: {
  name: string;
  isUser: boolean;
  isWinner: boolean;
  played: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.teamRow}>
      {isUser ? <Text style={styles.userMark}>★</Text> : null}
      <Text
        style={[
          styles.teamName,
          played && !isWinner && { color: colors.textMuted },
          isUser && styles.userTeamName,
        ]}
      >
        {name}
      </Text>
      {isWinner ? <Text style={styles.winnerMark}>✓</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md },
    statusCard: { borderWidth: 1 },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    statusCopy: { flex: 1, minWidth: 0 },
    statusKicker: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
    },
    teamTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.heavy,
      marginTop: 3,
    },
    statusBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      maxWidth: '48%',
    },
    statusBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    meritGrid: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
    scheduleNote: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.md,
    },
    meritItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      paddingHorizontal: 4,
      paddingVertical: spacing.sm,
    },
    meritValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    meritLabel: {
      color: colors.textFaint,
      fontSize: 10,
      marginTop: 3,
      textAlign: 'center',
    },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.xs,
    },
    roundLabel: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    matchCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    teamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 30,
      gap: spacing.sm,
    },
    userMark: { color: colors.accent, fontSize: fontSize.xs },
    teamName: { flex: 1, minWidth: 0, color: colors.text, fontSize: fontSize.md },
    userTeamName: { fontWeight: fontWeight.heavy },
    winnerMark: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    matchDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    },
    resultText: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: spacing.xs,
    },
    pendingRound: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    pendingText: { color: colors.textFaint, fontSize: fontSize.sm, textAlign: 'center' },
  });
