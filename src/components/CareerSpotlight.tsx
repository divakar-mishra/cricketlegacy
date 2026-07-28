import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ImageBackground, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSettings } from '../state/settingsStore';
import { fonts, fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';

type Props = {
  mode: 'player' | 'manager';
  title: string;
  meta: string;
  accentColor: string;
  status?: string;
};

export function CareerSpotlight({ mode, title, meta, accentColor, status }: Props) {
  const styles = useThemedStyles(makeStyles);
  const graphics = useSettings((state) => state.graphics);
  const { width } = useWindowDimensions();
  const sweepX = useSharedValue(-120);

  useEffect(() => {
    if (graphics !== 'high') {
      cancelAnimation(sweepX);
      sweepX.value = -120;
      return;
    }
    sweepX.value = -120;
    sweepX.value = withRepeat(
      withTiming(Math.max(width, 360) + 120, { duration: 4600 }),
      -1,
      false,
    );
    return () => cancelAnimation(sweepX);
  }, [graphics, sweepX, width]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepX.value }, { rotate: '12deg' }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={styles.frame}
      accessibilityRole="header"
    >
      <ImageBackground
        source={require('../../assets/generated/career-stadium.png')}
        resizeMode="cover"
        style={styles.image}
        imageStyle={styles.imageContent}
        accessibilityLabel={
          mode === 'manager'
            ? 'Floodlit cricket stadium viewed from the manager dugout'
            : 'Floodlit cricket stadium with a player walking to the crease'
        }
      >
        <View style={styles.dim} />
        {graphics === 'high' ? (
          <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}

        <View style={styles.topRow}>
          <View style={[styles.modeChip, { borderColor: accentColor }]}>
            <View style={[styles.liveDot, { backgroundColor: accentColor }]} />
            <Text style={[styles.modeText, { color: accentColor }]}>
              {mode === 'manager' ? 'MANAGER CAREER' : 'PLAYER CAREER'}
            </Text>
          </View>
          {status ? (
            <View style={styles.statusChip}>
              <Text style={styles.statusText} numberOfLines={1}>
                {status}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.copy}>
          <View style={[styles.accentRule, { backgroundColor: accentColor }]} />
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {meta}
          </Text>
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    frame: {
      height: 190,
      marginHorizontal: -spacing.md,
      marginTop: spacing.sm,
      overflow: 'hidden',
    },
    image: {
      flex: 1,
      justifyContent: 'space-between',
      overflow: 'hidden',
    },
    imageContent: { opacity: 0.96 },
    dim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(1,5,10,0.42)',
    },
    sweep: {
      position: 'absolute',
      top: -45,
      bottom: -45,
      width: 72,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      padding: spacing.md,
    },
    modeChip: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      backgroundColor: 'rgba(4,8,12,0.78)',
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    modeText: {
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
    },
    statusChip: {
      maxWidth: '48%',
      minHeight: 28,
      justifyContent: 'center',
      backgroundColor: 'rgba(4,8,12,0.78)',
      borderColor: 'rgba(255,255,255,0.22)',
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    statusText: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textAlign: 'right',
    },
    copy: {
      backgroundColor: 'rgba(2,5,9,0.78)',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      paddingTop: spacing.md,
    },
    accentRule: { width: 42, height: 3, marginBottom: spacing.sm },
    title: {
      color: colors.white,
      fontFamily: fonts.display,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      lineHeight: 28,
    },
    meta: {
      color: 'rgba(255,255,255,0.78)',
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: 4,
    },
  });
