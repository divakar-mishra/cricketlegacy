import { StyleSheet, View } from 'react-native';
import { fonts, fontWeight, radius, useTheme } from '../theme';
import { AppText as Text } from './AppText';

export function CaptainBadge() {
  return (
    <View
      style={styles.captainBadge}
      accessible
      accessibilityLabel="Captain"
      accessibilityRole="image"
    >
      <Text style={styles.captainText}>C</Text>
    </View>
  );
}

export function InjuryBadge() {
  return (
    <View
      style={styles.injuryBadge}
      accessible
      accessibilityLabel="Injured"
      accessibilityRole="image"
    >
      <View style={[styles.crossLine, styles.crossVertical]} />
      <View style={[styles.crossLine, styles.crossHorizontal]} />
    </View>
  );
}

export function FitnessIndicator({ value }: { value?: number }) {
  const { colors } = useTheme();
  const fitness = Math.max(0, Math.min(100, Math.round(value ?? 100)));
  const color = fitness >= 70 ? colors.success : fitness >= 45 ? colors.warning : colors.danger;

  return (
    <View
      style={styles.fitnessTrack}
      accessible
      accessibilityLabel={`Fitness ${fitness} percent`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: fitness }}
    >
      <View style={[styles.fitnessFill, { height: `${fitness}%`, backgroundColor: color }]} />
    </View>
  );
}

export function MoodIndicator({ score }: { score?: number }) {
  const { colors } = useTheme();
  const trust = Math.max(0, Math.min(100, Math.round(score ?? 70)));
  const color = trust >= 70 ? colors.success : trust >= 40 ? colors.warning : colors.danger;

  return (
    <View
      style={styles.moodWrap}
      accessible
      accessibilityLabel={`Morale ${trust}`}
      accessibilityRole="text"
    >
      <View style={[styles.moodDot, { backgroundColor: color, shadowColor: color }]} />
      <Text style={[styles.moodValue, { color }]}>{trust}</Text>
    </View>
  );
}

export function PlayerStatusBadges({
  captain = false,
  injured = false,
  fitness,
  mood,
}: {
  captain?: boolean;
  injured?: boolean;
  fitness?: number;
  mood?: number;
}) {
  return (
    <View style={styles.row}>
      {captain ? <CaptainBadge /> : null}
      {injured ? <InjuryBadge /> : null}
      <FitnessIndicator value={fitness} />
      <MoodIndicator score={mood} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minWidth: 48,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    flexShrink: 0,
  },
  captainBadge: {
    width: 17,
    height: 17,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(213,181,109,0.14)',
    borderWidth: 1,
    borderColor: '#D5B56D',
  },
  captainText: {
    color: '#D5B56D',
    fontFamily: fonts.headingSemi,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: fontWeight.semibold,
  },
  injuryBadge: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5484D',
  },
  crossLine: {
    position: 'absolute',
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  crossVertical: {
    width: 3,
    height: 10,
  },
  crossHorizontal: {
    width: 10,
    height: 3,
  },
  fitnessTrack: {
    width: 4,
    height: 22,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#242E45',
  },
  fitnessFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 2,
  },
  moodWrap: {
    minWidth: 25,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  moodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOpacity: 0.75,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  moodValue: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
});
