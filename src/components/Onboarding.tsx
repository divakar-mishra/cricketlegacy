import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analytics } from '../services';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { useSettings } from '../state/settingsStore';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadow,
  spacing,
  ThemeColors,
  useColors,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Icon, IconName } from './Icon';

interface Slide {
  icon: IconName;
  title: string;
  body: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'game-controller-outline',
    title: 'Live Ball-by-Ball Cricket',
    body: 'Call every shot when you bat. Defend, rotate, attack or go big, then set the plan when you bowl.',
    accent: '#31A85A',
  },
  {
    icon: 'trending-up-outline',
    title: 'Build Your Legend',
    body: 'Train your attributes, fight for your XI place, and build a reputation that can reach the national side.',
    accent: '#E9B23B',
  },
  {
    icon: 'shield-half-outline',
    title: 'Manage Every Detail',
    body: 'Change tactics, sign players, develop youth, manage wages, and satisfy your board.',
    accent: '#4C9AFF',
  },
  {
    icon: 'trophy-outline',
    title: 'Achievements & Records',
    body: 'Centuries, five-fers, trophies, awards, and records are tracked across your career.',
    accent: '#CD7F32',
  },
  {
    icon: 'star-outline',
    title: 'Daily Rewards & Season Pass',
    body: 'Complete daily quests, earn season XP, and claim rewards as your save grows.',
    accent: '#E9B23B',
  },
];

export const ONBOARDING_SLIDE_COUNT = SLIDES.length;

/** First-run coach-marks. Self-hides once completed (persisted in settings). */
export function Onboarding() {
  const done = useSettings((s) => s.hasOnboarded);
  const hydrated = useSettings((s) => s.hasHydrated);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const styles = useThemedStyles(makeStyles);
  useColors(); // ensures theme colors are reactive
  const [idx, setIdx] = useState(0);
  const swipeStartX = useRef<number | null>(null);
  const queueVisible = useModalQueue(!done && hydrated, MODAL_PRIORITY.prompt, 'onboarding');

  const complete = useCallback(
    (reason: 'finished' | 'skipped') => {
      analytics.logEvent(analytics.EVT.ONBOARDING_COMPLETE, { reason, last_slide: idx + 1 });
      setOnboarded(true);
    },
    [idx, setOnboarded],
  );

  const last = idx === SLIDES.length - 1;
  const goPrev = useCallback(() => setIdx((v) => Math.max(0, v - 1)), []);
  const goNext = useCallback(
    () => (last ? complete('finished') : setIdx((v) => Math.min(SLIDES.length - 1, v + 1))),
    [complete, last],
  );
  const handleTouchStart = useCallback((event: GestureResponderEvent) => {
    swipeStartX.current = event.nativeEvent.pageX;
  }, []);

  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      const startX = swipeStartX.current;
      swipeStartX.current = null;
      if (startX == null) return;
      const dx = event.nativeEvent.pageX - startX;
      if (dx <= -48) goNext();
      if (dx >= 48) goPrev();
    },
    [goNext, goPrev],
  );

  if (done || !hydrated || !queueVisible) return null;
  const slide = SLIDES[idx];
  const progressPct = (idx + 1) / SLIDES.length;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => complete('skipped')}>
      <SafeAreaView style={styles.backdrop} edges={['top', 'right', 'bottom', 'left']}>
        <Animated.View key={idx} entering={FadeIn.duration(260)} style={[styles.card, shadow.card]}>
          <LinearGradient
            colors={[`${slide.accent}22`, 'transparent']}
            style={styles.headerGradient}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          <ScrollView
            style={styles.swipeScroll}
            contentContainerStyle={styles.swipeContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <Animated.View
              entering={FadeInDown.duration(300).delay(80)}
              style={[
                styles.iconWrap,
                { backgroundColor: `${slide.accent}22`, borderColor: slide.accent },
              ]}
            >
              <Icon name={slide.icon} size={38} color={slide.accent} />
            </Animated.View>

            <Text style={[styles.slideCount, { color: slide.accent }]}>
              {idx + 1} of {SLIDES.length}
            </Text>

            <Animated.View entering={FadeInDown.duration(320).delay(120)} style={styles.textBlock}>
              <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.2}>
                {slide.title}
              </Text>
              <Text style={styles.body} maxFontSizeMultiplier={1.25}>
                {slide.body}
              </Text>
            </Animated.View>

            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${progressPct * 100}%`, backgroundColor: slide.accent },
                ]}
              />
            </View>
          </ScrollView>

          <View style={styles.dots}>
            {SLIDES.map((_, k) => (
              <Pressable
                key={k}
                onPress={() => setIdx(k)}
                accessibilityRole="button"
                accessibilityLabel={`Show onboarding slide ${k + 1}`}
                hitSlop={10}
                style={[
                  styles.dot,
                  k === idx && [styles.dotActive, { backgroundColor: slide.accent }],
                ]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Button
              label="Previous"
              variant="secondary"
              onPress={goPrev}
              disabled={idx === 0}
              fullWidth={false}
              style={styles.actionButton}
            />
            <Button
              label={last ? "Let's play" : 'Next'}
              variant="primary"
              onPress={goNext}
              fullWidth={false}
              style={styles.actionButton}
            />
          </View>

          {!last ? (
            <Pressable
              onPress={() => complete('skipped')}
              accessibilityRole="button"
              accessibilityLabel="Skip intro"
              style={styles.skipBtn}
            >
              <Text style={styles.skip}>Skip intro</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    card: {
      width: '100%',
      maxWidth: 400,
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      padding: spacing.md,
      alignItems: 'center',
      overflow: 'hidden',
    },
    headerGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 96,
    },
    swipeContent: {
      width: '100%',
      alignItems: 'center',
      paddingTop: spacing.xs,
    },
    swipeScroll: { width: '100%', flexShrink: 1 },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    slideCount: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: spacing.xs,
    },
    textBlock: {
      width: '100%',
      minHeight: 112,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      flexShrink: 1,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      textAlign: 'center',
      fontFamily: fonts.display,
      lineHeight: 24,
    },
    body: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      lineHeight: 19,
      marginTop: spacing.sm,
    },
    progressTrack: {
      width: '100%',
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
    dots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: { width: 24 },
    actions: {
      width: '100%',
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'stretch',
      marginTop: spacing.xs,
    },
    actionButton: {
      flex: 1,
      height: 52,
      minWidth: 0,
    },
    skipBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
    skip: { color: colors.textFaint, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  });
