import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { GroundScene } from './GroundScene';
import {
  CAPACITY_ART,
  EXPERIENCE_ART,
  GroundAppearance,
  GroundTrack,
  previewGround,
  stageStatus,
  visualLevel,
} from './venueVisuals';
import { MATCHDAY_EXPERIENCE, STADIUM_CAPACITY } from '../game/stadiumManagement';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

export function GroundDevelopment({
  capacityLevel,
  experienceLevel,
  accent,
}: GroundAppearance & { accent?: string }) {
  const styles = useThemedStyles(makeStyles);
  const [track, setTrack] = useState<GroundTrack>('capacity');
  const [preview, setPreview] = useState<number | null>(null);
  const current = visualLevel(track === 'capacity' ? capacityLevel : experienceLevel);
  const selected = preview ?? current;
  const appearance = previewGround({ capacityLevel, experienceLevel }, track, selected);
  const stages = track === 'capacity' ? CAPACITY_ART : EXPERIENCE_ART;
  const isPreview = selected !== current;
  return (
    <View style={styles.shell}>
      <View style={styles.tabs}>
        {(['capacity', 'experience'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: track === value }}
            onPress={() => {
              setTrack(value);
              setPreview(null);
            }}
            style={[styles.tab, track === value && styles.selected]}
          >
            <Text style={styles.tabText}>{value === 'capacity' ? 'THE STANDS' : 'MATCHDAY'}</Text>
          </Pressable>
        ))}
      </View>
      <GroundScene {...appearance} track={track} accent={accent} />
      <View style={styles.heading}>
        <Text style={styles.kicker}>
          {isPreview
            ? 'LEVEL PREVIEW · NOT A PURCHASE'
            : track === 'capacity'
              ? 'YOUR STANDS TODAY'
              : 'YOUR MATCHDAY FACILITIES'}
        </Text>
        <Text style={styles.title}>{stages[selected - 1]}</Text>
        <Text style={styles.detail}>
          Level {selected} ·{' '}
          {track === 'capacity'
            ? `${STADIUM_CAPACITY[selected].toLocaleString()} seats`
            : MATCHDAY_EXPERIENCE[selected].label}
        </Text>
      </View>
      <View style={styles.levels}>
        {[1, 2, 3, 4, 5].map((level) => (
          <Pressable
            key={level}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${track} level ${level}, ${stageStatus(level, current)}`}
            accessibilityState={{ selected: selected === level }}
            onPress={() => setPreview(level === current ? null : level)}
            style={[styles.level, selected === level && styles.selected]}
          >
            <Text style={styles.levelText}>{level}</Text>
            <View style={[styles.dot, level <= current && styles.builtDot]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.roadmap}>
        <Text style={styles.kicker}>WHAT EACH LEVEL ADDS</Text>
        {stages.map((label, index) => (
          <View key={label} style={styles.stage}>
            <Text style={styles.stageNumber}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.stageName}>{label}</Text>
            <Text style={[styles.state, index + 1 === current && styles.current]}>
              {stageStatus(index + 1, current)}
            </Text>
          </View>
        ))}
      </View>
      {isPreview ? (
        <Pressable accessibilityRole="button" onPress={() => setPreview(null)} style={styles.reset}>
          <Text style={styles.resetText}>Back to current ground</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    shell: {
      marginVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    tabs: { flexDirection: 'row', padding: spacing.sm, gap: spacing.sm },
    tab: {
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabText: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.heavy,
      letterSpacing: 1,
    },
    selected: { borderColor: colors.accent, backgroundColor: colors.bgElevated },
    heading: { paddingHorizontal: spacing.md, gap: 4 },
    kicker: { color: colors.textMuted, fontSize: fontSize.xs, letterSpacing: 1 },
    title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
    detail: { color: colors.textMuted, fontSize: fontSize.sm },
    levels: { flexDirection: 'row', gap: spacing.xs, padding: spacing.md },
    level: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    levelText: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textFaint },
    builtDot: { backgroundColor: colors.success },
    roadmap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
    stage: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stageNumber: { color: colors.textMuted, fontSize: fontSize.xs },
    stageName: { flex: 1, color: colors.text, fontSize: fontSize.sm },
    state: { color: colors.textMuted, fontSize: fontSize.xs },
    current: { color: colors.success, fontWeight: fontWeight.heavy },
    reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
    resetText: { color: colors.accentLight, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
  });
