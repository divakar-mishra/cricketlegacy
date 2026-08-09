/**
 * U19WorldCupScreen — bracket view for the U19 World Cup.
 * Feature 5: shows 6 teams, results, and the user's path to the final.
 */
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { getCountry } from '../data/countries';
import { shouldRunU19WorldCup, u19Qualifies } from '../game/u19';
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

export function U19WorldCupScreen({ navigation }: ScreenProps<'U19WorldCup'>) {
  const save = useCareer((s) => s.save);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="U19 World Cup" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active save.</Text>
      </Screen>
    );
  }

  const userCountry = save.userPlayerId ? save.players[save.userPlayerId]?.nationality : undefined;
  const userCountryName = userCountry ? (getCountry(userCountry)?.name ?? 'Your country') : '—';
  const qualifies = u19Qualifies(save);
  const shouldRun = shouldRunU19WorldCup(save);

  // Find U19 WC fixtures in the current season.
  const u19Fixtures = Object.values(save.fixtures).filter(
    (fx) => fx.competition === 'U19_WORLDCUP',
  );

  const qfFixtures = u19Fixtures.filter((_, i) => i < 2);
  const sfFixtures = u19Fixtures.filter((_, i) => i >= 2 && i < 4);
  const finalFixture = u19Fixtures.find((_, i) => i === 4);

  return (
    <Screen scroll>
      <ScreenHeader title="U19 World Cup" onBack={() => navigation.goBack()} />

      {/* Status card */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card
          style={[styles.statusCard, { borderColor: qualifies ? colors.success : colors.border }]}
        >
          <Text style={styles.statusTitle}>Your Status</Text>
          <View style={styles.statusRow}>
            <Text style={styles.country}>{userCountryName}</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: qualifies ? colors.success + '22' : colors.surfaceAlt },
              ]}
            >
              <Text
                style={[styles.badgeText, { color: qualifies ? colors.success : colors.textMuted }]}
              >
                {qualifies ? '✓ Qualified' : 'Not qualified'}
              </Text>
            </View>
          </View>
          {!qualifies && (
            <Text style={styles.qualNote}>
              Qualify by playing 3+ U19 matches with an average rating of 6.5+. Current:{' '}
              {save.careerPathMatches ?? 0} matches played.
            </Text>
          )}
          {!shouldRun && (
            <Text style={styles.qualNote}>
              The U19 World Cup fires every 2 seasons (even years).
            </Text>
          )}
        </Card>
      </Animated.View>

      {/* Bracket */}
      {u19Fixtures.length > 0 ? (
        <>
          <Text style={styles.section}>Tournament Bracket</Text>

          {qfFixtures.length > 0 && (
            <Animated.View entering={FadeInDown.duration(320).delay(80)}>
              <Text style={styles.roundLabel}>Quarter-Finals</Text>
              {qfFixtures.map((fx) => (
                <BracketMatch
                  key={fx.id}
                  homeId={fx.homeTeamId}
                  awayId={fx.awayTeamId}
                  winnerTeamId={fx.winnerTeamId}
                  played={fx.played}
                  userCountry={userCountry}
                />
              ))}
            </Animated.View>
          )}

          {sfFixtures.length > 0 && (
            <Animated.View entering={FadeInDown.duration(340).delay(120)}>
              <Text style={styles.roundLabel}>Semi-Finals</Text>
              {sfFixtures.map((fx) => (
                <BracketMatch
                  key={fx.id}
                  homeId={fx.homeTeamId}
                  awayId={fx.awayTeamId}
                  winnerTeamId={fx.winnerTeamId}
                  played={fx.played}
                  userCountry={userCountry}
                />
              ))}
            </Animated.View>
          )}

          {finalFixture && (
            <Animated.View entering={FadeInDown.duration(360).delay(160)}>
              <Text style={styles.roundLabel}>🏆 Final</Text>
              <BracketMatch
                homeId={finalFixture.homeTeamId}
                awayId={finalFixture.awayTeamId}
                winnerTeamId={finalFixture.winnerTeamId}
                played={finalFixture.played}
                userCountry={userCountry}
                isFinal
              />
            </Animated.View>
          )}
        </>
      ) : (
        <Animated.View entering={FadeInDown.duration(320).delay(80)}>
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.emptyText}>
              {shouldRun && qualifies
                ? 'The U19 World Cup bracket will be generated at the start of the next season.'
                : 'No U19 World Cup scheduled this season.'}
            </Text>
          </Card>
        </Animated.View>
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

function BracketMatch({
  homeId,
  awayId,
  winnerTeamId,
  played,
  userCountry,
  isFinal = false,
}: {
  homeId: string;
  awayId: string;
  winnerTeamId?: string;
  played: boolean;
  userCountry?: string;
  isFinal?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const homeName = getCountry(homeId)?.name ?? 'Team pending';
  const awayName = getCountry(awayId)?.name ?? 'Team pending';
  const isUserHome = homeId === userCountry;
  const isUserAway = awayId === userCountry;
  const userWon = played && winnerTeamId === userCountry;

  return (
    <View style={[styles.matchCard, isFinal && { borderColor: colors.accent, borderWidth: 1.5 }]}>
      <TeamRow
        name={homeName}
        isUser={isUserHome}
        isWinner={played && winnerTeamId === homeId}
        played={played}
      />
      <View style={styles.vsDivider} />
      <TeamRow
        name={awayName}
        isUser={isUserAway}
        isWinner={played && winnerTeamId === awayId}
        played={played}
      />
      {played && (
        <Text style={[styles.resultBadge, { color: userWon ? colors.success : colors.textFaint }]}>
          {userWon
            ? '🏅 Your country advances'
            : winnerTeamId
              ? `${getCountry(winnerTeamId)?.name ?? 'Winning team'} wins`
              : ''}
        </Text>
      )}
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.xs,
        gap: spacing.sm,
      }}
    >
      {isUser && <Text style={{ color: colors.accent, fontSize: 12 }}>★</Text>}
      <Text
        style={{
          flex: 1,
          color: isWinner ? colors.success : played ? colors.textMuted : colors.text,
          fontSize: fontSize.md,
          fontWeight: isUser ? fontWeight.heavy : fontWeight.regular,
          textDecorationLine: played && !isWinner ? 'line-through' : 'none',
        }}
      >
        {name}
      </Text>
      {isWinner && <Text style={{ color: colors.success, fontSize: 12 }}>✓</Text>}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.lg },
    statusCard: { marginTop: spacing.lg, borderWidth: 1 },
    statusTitle: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    country: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    qualNote: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
      lineHeight: 16,
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
    vsDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    },
    resultBadge: { fontSize: fontSize.xs, marginTop: spacing.xs, fontWeight: fontWeight.bold },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      padding: spacing.md,
    },
  });
