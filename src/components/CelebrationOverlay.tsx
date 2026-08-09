import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { useSettings } from '../state/settingsStore';
import { useColors } from '../theme';
import { AppText as Text } from './AppText';

export type CelebrationKind =
  'four' | 'six' | 'wicket' | 'fifty' | 'hundred' | 'innings' | 'win' | null;

interface Props {
  trigger: number; // increment to fire a burst
  kind: CelebrationKind;
  theme?: 'classic' | 'floodlights';
}

/** Particle budget scales with the Graphics-quality setting (previously unused). */
const COUNT_FOR = { low: 8, medium: 16, high: 26 } as const;

/** Per-burst particle appearance/target — kept in state so each burst re-renders. */
interface Spec {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  size: number;
  startX: number;
}

export function CelebrationOverlay({ trigger, kind, theme = 'classic' }: Props) {
  const colors = useColors();
  const graphics = useSettings((s) => s.graphics);
  const COUNT = useRef(COUNT_FOR[graphics] ?? COUNT_FOR.high).current;
  const PALETTES: Record<Exclude<CelebrationKind, null>, string[]> = {
    four: [colors.primary, colors.primaryLight, colors.white],
    six: [colors.accent, colors.accentLight, colors.primaryLight, colors.white],
    fifty: [colors.accent, colors.primaryLight, colors.white],
    hundred: [colors.accent, colors.accentLight, colors.success, colors.white],
    win: [colors.accent, colors.accentLight, colors.primary, colors.success, colors.white],
    wicket: [colors.danger, colors.dangerDark, '#7A1216'],
    innings: [colors.info, colors.primaryLight, colors.white],
  };
  const LABELS: Record<Exclude<CelebrationKind, null>, { title: string; subtitle: string }> = {
    four: { title: 'FOUR', subtitle: 'Found the rope' },
    six: { title: 'SIX', subtitle: 'Into the crowd' },
    wicket: { title: 'WICKET', subtitle: 'The game turns' },
    fifty: { title: 'FIFTY', subtitle: 'A vital landmark' },
    hundred: { title: 'CENTURY', subtitle: 'An innings to remember' },
    innings: { title: 'INNINGS', subtitle: 'A new chapter begins' },
    win: { title: 'VICTORY', subtitle: 'The moment is yours' },
  };
  const { width, height } = Dimensions.get('window');
  // Animated.Values are stable for the component's life; only their target
  // offsets/colors change per burst (via `specs` state).
  const anims = useRef<Animated.Value[]>(
    Array.from({ length: COUNT }, () => new Animated.Value(0)),
  ).current;
  const centreAnim = useRef(new Animated.Value(0)).current;
  const [specs, setSpecs] = useState<Spec[]>([]);

  useEffect(() => {
    if (!trigger || !kind) return;
    const palette = theme === 'floodlights' ? ['#B9F23D', '#D5B56D', '#F5F7F4'] : PALETTES[kind];
    const rising = kind === 'wicket'; // wicket = shards fall from the top; others burst up
    const next: Spec[] = anims.map(() => ({
      color: palette[Math.floor(Math.random() * palette.length)],
      size: 6 + Math.random() * 10,
      startX: width * (0.15 + Math.random() * 0.7),
      dx: (Math.random() - 0.5) * width * 0.8,
      dy: rising ? height * (0.4 + Math.random() * 0.5) : -height * (0.25 + Math.random() * 0.4),
      rot: (Math.random() - 0.5) * 720,
    }));
    setSpecs(next);
    for (const a of anims) a.setValue(0);
    centreAnim.setValue(0);
    Animated.parallel([
      Animated.stagger(
        12,
        anims.map((a) =>
          Animated.timing(a, {
            toValue: 1,
            duration: 1100 + Math.random() * 500,
            useNativeDriver: true,
          }),
        ),
      ),
      Animated.sequence([
        Animated.timing(centreAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(kind === 'win' || kind === 'hundred' ? 950 : 620),
        Animated.timing(centreAnim, { toValue: 2, duration: 260, useNativeDriver: true }),
      ]),
    ]).start();
  }, [trigger, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!kind || specs.length === 0) return null;

  const base = kind === 'wicket' ? -40 : height * 0.5;
  const centreOpacity = centreAnim.interpolate({
    inputRange: [0, 0.18, 1, 1.65, 2],
    outputRange: [0, 1, 1, 1, 0],
  });
  const centreScale = centreAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.85, 1, 1.02],
  });
  const ringScale = centreAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.45, 1.35, 1.7],
  });
  const label = LABELS[kind];
  const labelColor = PALETTES[kind][0];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {theme === 'floodlights' && (
        <Animated.View style={[styles.floodlightWash, { opacity: centreOpacity }]}>
          <View style={[styles.lightBeam, styles.lightBeamLeft]} />
          <View style={[styles.lightBeam, styles.lightBeamRight]} />
        </Animated.View>
      )}
      <Animated.View
        style={[
          styles.centre,
          {
            top: height * 0.22,
            borderColor: labelColor,
            opacity: centreOpacity,
            transform: [{ scale: centreScale }],
          },
        ]}
      >
        <Animated.View
          style={[styles.ring, { borderColor: labelColor, transform: [{ scale: ringScale }] }]}
        />
        <Text style={[styles.title, { color: labelColor }]}>{label.title}</Text>
        <Text style={styles.subtitle}>{label.subtitle}</Text>
      </Animated.View>
      {specs.map((s, i) => {
        const v = anims[i];
        const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [base, base + s.dy] });
        const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] });
        const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${s.rot}deg`] });
        const opacity = v.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: s.startX,
              top: 0,
              width: s.size,
              height: s.size * 0.6,
              borderRadius: 2,
              backgroundColor: s.color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  floodlightWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  lightBeam: {
    position: 'absolute',
    top: -120,
    width: 120,
    height: '90%',
    backgroundColor: 'rgba(185,242,61,0.09)',
  },
  lightBeamLeft: { left: '8%', transform: [{ rotate: '-12deg' }] },
  lightBeamRight: { right: '8%', transform: [{ rotate: '12deg' }] },
  centre: {
    position: 'absolute',
    left: '15%',
    right: '15%',
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 9, 15, 0.94)',
    borderWidth: 1,
    borderRadius: 8,
    elevation: 12,
    zIndex: 3,
  },
  ring: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    opacity: 0.28,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
