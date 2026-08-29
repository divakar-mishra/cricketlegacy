/**
 * TransferDeadlineDayScreen — the most dramatic moment of the manager calendar.
 * Shows a countdown clock, pending deals, and late offers with a "Deal or No Deal"
 * tension that makes the transfer window feel like a real event.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { playHaptic } from '../audio';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { computeValue, formatClubCurrency } from '../game/finance';
import { isDeadlineDay, isTransferWindowOpen, transferWindowLabel } from '../game/transferMarket';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fonts,
  fontSize,
  fontWeight,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

// ─── Countdown clock ──────────────────────────────────────────────────────────

function formatDeadline(secondsLeft: number): {
  h: string;
  m: string;
  s: string;
  critical: boolean;
} {
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  return {
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
    critical: secondsLeft < 300, // last 5 minutes
  };
}

function ClockDigit({ value, critical }: { value: string; critical: boolean }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.15, { duration: 80 }),
      withTiming(1, { duration: 120 }),
    );
  }, [scale, value]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, { alignItems: 'center' }]}>
      <View
        style={[
          styles_clock.digitBox,
          critical && { borderColor: '#E5484D', backgroundColor: '#2A0A0A' },
        ]}
      >
        <Text style={[styles_clock.digit, { color: critical ? '#E5484D' : colors.text }]}>
          {value}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles_clock = StyleSheet.create({
  digitBox: {
    width: 52,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1A1A2A',
    borderWidth: 1.5,
    borderColor: '#4C9AFF40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { fontSize: 32, fontWeight: '900', fontFamily: 'monospace' },
});

// ─── Transfer ticker item ─────────────────────────────────────────────────────

type DealStatus = 'PENDING' | 'AGREED' | 'COLLAPSED' | 'SIGNED';

interface PendingDeal {
  id: string;
  playerName: string;
  fromClub: string;
  toClub: string;
  fee: string;
  status: DealStatus;
  isUserInvolved: boolean;
}

const STATUS_CONFIG: Record<DealStatus, { color: string; label: string; icon: string }> = {
  PENDING: { color: '#F5A524', label: 'Negotiating', icon: '⏳' },
  AGREED: { color: '#31A85A', label: 'Deal Agreed', icon: '🤝' },
  COLLAPSED: { color: '#E5484D', label: 'Deal Collapsed', icon: '💔' },
  SIGNED: { color: '#4C9AFF', label: 'Signed & Sealed', icon: '✍️' },
};

function DealTicker({ deal, delay }: { deal: PendingDeal; delay: number }) {
  const { colors } = useTheme();
  const status = STATUS_CONFIG[deal.status];
  return (
    <Animated.View entering={FadeInRight.duration(300).delay(delay)}>
      <View
        style={[
          deal_styles.row,
          deal.isUserInvolved && { borderColor: colors.accent + '60', borderWidth: 1.5 },
        ]}
      >
        <View style={[deal_styles.statusDot, { backgroundColor: status.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={deal_styles.playerName} numberOfLines={1}>
            {deal.isUserInvolved ? '⭐ ' : ''}
            {deal.playerName}
          </Text>
          <Text style={deal_styles.clubs} numberOfLines={1}>
            {deal.fromClub} → {deal.toClub}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[deal_styles.fee, { color: status.color }]}>{deal.fee}</Text>
          <Text style={deal_styles.statusLabel}>
            {status.icon} {status.label}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const deal_styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  playerName: { color: '#F1F7F3', fontSize: 14, fontWeight: '600' },
  clubs: { color: '#9FB8AB', fontSize: 12, marginTop: 2 },
  fee: { fontSize: 13, fontWeight: '700' },
  statusLabel: { color: '#5E7669', fontSize: 10, marginTop: 2 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function TransferDeadlineDayScreen({ navigation }: ScreenProps<'TransferDeadlineDay'>) {
  const save = useCareer((s) => s.save);
  const styles = useThemedStyles(makeStyles);
  const deadlineActive = save ? isDeadlineDay(save) : false;

  // Simulate a deadline at midnight - countdown from current time
  const [secondsLeft, setSecondsLeft] = useState(3 * 3600 + 47 * 60 + 12); // 3h 47m 12s
  const [urgency, setUrgency] = useState(false);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (!deadlineActive) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        const next = prev - 1;
        if (next < 300) {
          setUrgency((wasUrgent) => {
            if (!wasUrgent) {
              playHaptic('notify-warning');
            }
            return true;
          });
        }
        return next;
      });
    }, 1000);

    glowOpacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 800 }), withTiming(0.2, { duration: 800 })),
      -1,
      true,
    );

    return () => clearInterval(timer);
  }, [deadlineActive, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const clock = formatDeadline(secondsLeft);

  // Build player→team lookup from team.playerIds
  const playerTeamMap = React.useMemo(() => {
    if (!save) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const team of Object.values(save.teams)) {
      for (const pid of team.playerIds) {
        map[pid] = team.id;
      }
    }
    return map;
  }, [save]);

  // Generate world transfer news from save data
  const deals: PendingDeal[] = React.useMemo(() => {
    if (!save) return [];
    const teams = Object.values(save.teams).slice(0, 12);
    const players = Object.values(save.players)
      .filter((p) => !p.retired && p.id !== save.userPlayerId)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 8);

    return players.map((p, i): PendingDeal => {
      const pTeamId = playerTeamMap[p.id];
      const fromTeam = pTeamId ? save.teams[pTeamId] : teams[i % teams.length];
      const toTeam = teams[(i + 3) % teams.length];
      const statuses: DealStatus[] = [
        'PENDING',
        'AGREED',
        'PENDING',
        'COLLAPSED',
        'SIGNED',
        'PENDING',
        'AGREED',
        'PENDING',
      ];
      return {
        id: p.id,
        playerName: p.name,
        fromClub: fromTeam?.shortName ?? fromTeam?.name ?? '?',
        toClub: toTeam?.shortName ?? toTeam?.name ?? '?',
        fee: formatClubCurrency(computeValue(p)),
        status: statuses[i],
        isUserInvolved: pTeamId === save.userTeamId,
      };
    });
  }, [save, playerTeamMap]);

  const userTeam = save?.userTeamId ? save.teams[save.userTeamId] : null;
  const budget = userTeam?.budget ?? 0;
  const windowOpen = save ? isTransferWindowOpen(save) : false;

  if (save?.mode === 'manager' && save.managerCareerLevel === 'NATIONAL') {
    return (
      <Screen gradient={['#080808', '#12100A', '#0A0A18'] as any}>
        <ScreenHeader title="Transfer Deadline" onBack={() => navigation.goBack()} />
        <View style={styles.content}>
          <Card style={styles.nationalPauseCard}>
            <Text style={styles.nationalPauseTitle}>Club operations paused</Text>
          </Card>
        </View>
      </Screen>
    );
  }

  // When the window is shut there are no signings to make — show an honest closed
  // state instead of a fake deadline clock, and point the manager back to the hub.
  if (save && !deadlineActive) {
    const title = windowOpen ? 'Deadline Day Unavailable' : 'Window Closed';
    const note = windowOpen
      ? `${transferWindowLabel(save)} Deadline Day appears only in the final hours.`
      : transferWindowLabel(save);
    return (
      <Screen gradient={['#080808', '#12100A', '#0A0A18'] as any}>
        <ScreenHeader
          title={userTeam?.name ?? 'Transfer Window'}
          subtitle="Transfer window"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.content}>
          <Card style={styles.budgetCard}>
            <Text style={styles.budgetLabel}>{title}</Text>
            <Text style={styles.budgetNote}>{note}</Text>
          </Card>
          {windowOpen ? (
            <Button
              label="Scout Market"
              variant="gold"
              style={{ marginTop: spacing.lg }}
              onPress={() => navigation.navigate('Transfers')}
            />
          ) : null}
          <Button
            label="Back to Manager Hub"
            variant="ghost"
            style={{ marginTop: spacing.md }}
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen gradient={['#080808', '#12100A', '#0A0A18'] as any}>
      {/* Breaking news ticker at top */}
      <LinearGradient
        colors={['#E5484D', '#B93A3E']}
        style={styles.breakingBanner}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={styles.breakingText}>🔴 LIVE TRANSFER DEADLINE DAY</Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
      >
        <ScreenHeader
          title={userTeam?.name ?? 'Transfer Window'}
          onBack={() => navigation.goBack()}
        />

        {/* Countdown clock */}
        <Animated.View entering={ZoomIn.duration(400)} style={styles.clockWrap}>
          <Animated.View
            style={[
              styles.clockGlow,
              glowStyle,
              { backgroundColor: urgency ? '#E5484D' : '#4C9AFF' },
            ]}
          />
          <View style={styles.clock}>
            <View style={styles.clockGroup}>
              <ClockDigit value={clock.h} critical={clock.critical} />
              <Text style={styles.clockColon}>:</Text>
              <ClockDigit value={clock.m} critical={clock.critical} />
              <Text style={styles.clockColon}>:</Text>
              <ClockDigit value={clock.s} critical={clock.critical} />
            </View>
            <View style={styles.clockLabels}>
              {['HRS', 'MIN', 'SEC'].map((l, i) => (
                <Text key={l} style={[styles.clockLabel, i === 1 && { marginHorizontal: 14 }]}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
          {urgency && (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.urgencyWarning}>⚠ Less than 5 minutes remaining!</Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Budget remaining */}
        {budget > 0 && (
          <Animated.View entering={FadeInDown.duration(350).delay(200)}>
            <Card style={styles.budgetCard}>
              <Text style={styles.budgetLabel}>Transfer Budget Remaining</Text>
              <Text style={styles.budgetValue}>{formatClubCurrency(budget)}</Text>
              <Text style={styles.budgetNote}>Budget resets next season.</Text>
            </Card>
          </Animated.View>
        )}

        {/* Action buttons */}
        <Animated.View entering={FadeInDown.duration(350).delay(300)} style={styles.actionRow}>
          <Button
            label="Scout Market"
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1 }}
            onPress={() => navigation.navigate('Transfers')}
          />
          <Button
            label="Review Squad"
            variant="secondary"
            fullWidth={false}
            style={{ flex: 1 }}
            onPress={() => navigation.navigate('Squad')}
          />
        </Animated.View>
        {/* World transfer ticker */}
        <Animated.View entering={FadeInDown.duration(350).delay(400)}>
          <View style={styles.tickerHeader}>
            <View style={styles.liveDot} />
            <Text style={styles.tickerTitle}>World Transfer News</Text>
          </View>
          {deals.map((deal, i) => (
            <DealTicker key={deal.id} deal={deal} delay={i * 60} />
          ))}
        </Animated.View>

        {/* Back button */}
        <Animated.View entering={FadeInDown.duration(300).delay(600)}>
          <Button
            label="Done"
            variant="ghost"
            style={{ marginTop: spacing.lg }}
            onPress={() => navigation.goBack()}
          />
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    breakingBanner: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      marginBottom: 0,
    },
    breakingText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 2,
      textAlign: 'center',
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    nationalPauseCard: { marginBottom: spacing.md, gap: spacing.sm },
    nationalPauseTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
    },
    nationalPauseCopy: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 20,
      textAlign: 'center',
    },
    clockWrap: {
      alignItems: 'center',
      marginVertical: spacing.xl,
      position: 'relative',
    },
    clockGlow: {
      position: 'absolute',
      width: 260,
      height: 80,
      borderRadius: 40,
      opacity: 0.15,
    },
    clock: {
      alignItems: 'center',
    },
    clockGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    clockColon: {
      color: colors.textFaint,
      fontSize: 28,
      fontWeight: fontWeight.black,
      marginTop: -8,
    },
    clockLabels: {
      flexDirection: 'row',
      marginTop: spacing.xs,
      width: '100%',
      justifyContent: 'center',
      gap: 14,
    },
    clockLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 2,
      width: 52,
      textAlign: 'center',
    },
    urgencyWarning: {
      color: '#E5484D',
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    budgetCard: {
      alignItems: 'center',
      marginBottom: spacing.md,
      borderColor: colors.accent + '40',
      borderWidth: 1,
    },
    budgetLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    budgetValue: {
      color: colors.accent,
      fontSize: fontSize.xxxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      marginVertical: spacing.xs,
    },
    budgetNote: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    tickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#E5484D',
    },
    tickerTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
    },
  });
