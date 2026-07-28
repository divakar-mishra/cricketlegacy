/**
 * LiveTacticPanel — an in-match, manager-mode readout of the CURRENT plan.
 *
 * Shows batting approach, bowling plan and field setting at a glance, plus a
 * one-line note on how the AI opponent is responding. Collapsible to stay out
 * of the way, and it pulses (accent glow) whenever the AI changes its tactic so
 * the manager notices the shift. All animation is Reanimated/UI-thread.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Tactics } from '../domain/types';
import { BOWLER_PLAN_OPTIONS, FIELD_OPTIONS, TEAM_APPROACH_OPTIONS } from '../engine/intent';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';

interface LiveTacticPanelProps {
  tactics: Tactics;
  /** One-line AI response, e.g. "Openers counter-attacking your containment." */
  aiResponse?: string;
  /** Increment this whenever the AI changes tactic to trigger the pulse. */
  pulseSignal?: number;
  defaultOpen?: boolean;
}

function labelFor(
  list: readonly { value: string; label: string }[],
  value: string | undefined,
): string {
  return list.find((o) => o.value === value)?.label ?? value ?? '—';
}

export function LiveTacticPanel({
  tactics,
  aiResponse,
  pulseSignal = 0,
  defaultOpen = false,
}: LiveTacticPanelProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(defaultOpen);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (pulseSignal <= 0) return;
    glow.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 700 }));
  }, [pulseSignal, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: glow.value > 0 ? colors.accent : colors.border,
    shadowOpacity: 0.15 + glow.value * 0.4,
  }));

  const battingLabel = labelFor(TEAM_APPROACH_OPTIONS, tactics.batting);
  const bowlingLabel = labelFor(BOWLER_PLAN_OPTIONS, tactics.bowling);
  const fieldLabel = labelFor(FIELD_OPTIONS, tactics.field);

  return (
    <Animated.View style={[styles.card, glowStyle]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel="Toggle live tactic panel"
      >
        <Text style={styles.headerTitle}>⚙︎ Live Tactics</Text>
        <Text style={styles.headerSummary} numberOfLines={1}>
          {open ? 'Hide' : `${battingLabel} · ${bowlingLabel} · ${fieldLabel}`}
        </Text>
      </Pressable>

      {open ? (
        <Animated.View entering={FadeIn.duration(160)} style={styles.body}>
          <Row label="Batting" value={battingLabel} colors={colors} styles={styles} />
          <Row label="Bowling" value={bowlingLabel} colors={colors} styles={styles} />
          <Row label="Field" value={fieldLabel} colors={colors} styles={styles} />
          {aiResponse ? (
            <View style={styles.aiRow}>
              <Text style={styles.aiLabel}>MATCH READ</Text>
              <Text style={styles.aiText}>{aiResponse}</Text>
              <Text style={styles.aiBasis}>
                Based on score, wickets and required rate. This explains the visible match state; it
                does not apply a hidden rating boost.
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Row({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.tacticRow}>
      <Text style={styles.tacticLabel}>{label}</Text>
      <Text style={styles.tacticValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      marginBottom: spacing.sm,
      shadowColor: colors.accent,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    headerTitle: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    headerSummary: { flex: 1, color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
    body: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    tacticRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    tacticLabel: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tacticValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    aiRow: {
      marginTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    aiLabel: { color: colors.accent, fontSize: 9, fontWeight: fontWeight.black, letterSpacing: 1 },
    aiText: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
    aiBasis: { color: colors.textFaint, fontSize: 9, marginTop: 4, lineHeight: 14 },
  });
