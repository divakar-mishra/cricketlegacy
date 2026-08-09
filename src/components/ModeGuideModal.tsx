import { useCallback, useRef, useState } from 'react';
import { GestureResponderEvent, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadow,
  spacing,
  ThemeColors,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Icon, IconName } from './Icon';

interface ModeGuideStep {
  icon: IconName;
  title: string;
  body: string;
  action: string;
}

interface Props {
  visible: boolean;
  modeLabel: string;
  steps: readonly ModeGuideStep[];
  onComplete: () => void;
}

export function ModeGuideModal({ visible, modeLabel, steps, onComplete }: Props) {
  const styles = useThemedStyles(makeStyles);
  const queueVisible = useModalQueue(visible, MODAL_PRIORITY.prompt, `${modeLabel}-guide`);
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const last = index === steps.length - 1;
  const step = steps[index];

  const next = useCallback(() => {
    if (last) {
      onComplete();
      return;
    }
    setIndex((current) => Math.min(steps.length - 1, current + 1));
  }, [last, onComplete, steps.length]);

  const previous = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  const onTouchStart = (event: GestureResponderEvent) => {
    startX.current = event.nativeEvent.pageX;
  };

  const onTouchEnd = (event: GestureResponderEvent) => {
    if (startX.current == null) return;
    const delta = event.nativeEvent.pageX - startX.current;
    startX.current = null;
    if (delta < -54) next();
    if (delta > 54) previous();
  };

  if (!visible || !queueVisible || !step) return null;

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="none"
      onRequestClose={onComplete}
    >
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(140)}
        style={styles.backdrop}
      >
        <SafeAreaView style={styles.safe} edges={['top', 'right', 'bottom', 'left']}>
          <Animated.View
            key={index}
            entering={SlideInRight.duration(220)}
            style={[styles.card, shadow.card]}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <View style={styles.topRow}>
              <Text style={styles.kicker}>{modeLabel.toUpperCase()} GUIDE</Text>
              <Pressable
                onPress={onComplete}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close guide"
              >
                <Icon name="close" size={22} color="#A9B7AD" />
              </Pressable>
            </View>

            <View style={styles.iconWrap}>
              <Icon name={step.icon} size={36} color="#F7D06E" />
            </View>
            <Text style={styles.count}>
              STEP {index + 1} OF {steps.length}
            </Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            <View style={styles.actionBox}>
              <Text style={styles.actionLabel}>YOUR NEXT ACTION</Text>
              <Text style={styles.actionText}>{step.action}</Text>
            </View>

            <View style={styles.dots}>
              {steps.map((item, dotIndex) => (
                <Pressable
                  key={item.title}
                  onPress={() => setIndex(dotIndex)}
                  hitSlop={8}
                  style={[styles.dot, dotIndex === index && styles.dotActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Show guide step ${dotIndex + 1}`}
                />
              ))}
            </View>

            <View style={styles.buttons}>
              <Button
                label="Previous"
                variant="secondary"
                disabled={index === 0}
                fullWidth={false}
                style={styles.button}
                onPress={previous}
              />
              <Button
                label={last ? 'Start playing' : 'Next'}
                fullWidth={false}
                style={styles.button}
                onPress={next}
              />
            </View>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)' },
    safe: { flex: 1, justifyContent: 'center', padding: spacing.lg },
    card: {
      width: '100%',
      maxWidth: 480,
      alignSelf: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      padding: spacing.lg,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    kicker: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1.2,
    },
    iconWrap: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.accent,
      marginTop: spacing.lg,
    },
    count: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    title: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    body: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    actionBox: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    actionLabel: {
      color: colors.primaryLight,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    actionText: { color: colors.text, fontSize: fontSize.sm, lineHeight: 19, marginTop: 3 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: spacing.lg },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.borderStrong },
    dotActive: { width: 20, backgroundColor: colors.accent },
    buttons: { flexDirection: 'row', gap: spacing.sm },
    button: { flex: 1, minWidth: 0 },
  });
