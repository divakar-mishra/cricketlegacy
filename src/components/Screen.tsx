import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '../theme';
import { GlassBlurProvider } from './GlassSurface';

type GradientColors = readonly [string, string, ...string[]];

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  gradient?: GradientColors;
  contentStyle?: ViewStyle;
  /** Sticky content pinned below the screen body, respecting the safe area. */
  footer?: React.ReactNode;
  /** Scrolls a scrolling screen back to its top whenever this value changes. */
  scrollResetKey?: string | number;
  /** Optional handle for scrolling directly to a section reached from a deep link. */
  scrollRef?: React.RefObject<ScrollView | null>;
};

/**
 * Base screen wrapper: full-bleed background + safe-area + responsive padding.
 *
 * The native expo-linear-gradient path is shared by iOS and Android. The
 * gradient also acts as the Android blur target for descendant glass surfaces.
 */
export function Screen({
  children,
  scroll = false,
  padded = true,
  gradient,
  contentStyle,
  footer,
  scrollResetKey,
  scrollRef,
}: Props) {
  const insets = useSafeAreaInsets();
  const { gradients, colors } = useTheme();
  const { width } = useWindowDimensions();
  const bg = gradient ?? gradients.night;
  const internalScrollRef = useRef<ScrollView>(null);
  const activeScrollRef = scrollRef ?? internalScrollRef;

  useEffect(() => {
    if (!scroll || scrollResetKey == null) return;
    activeScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeScrollRef, scroll, scrollResetKey]);

  // Leave breathing room even on compact devices and outside 12dp scene bleeds.
  const hPad = padded
    ? Math.max(spacing.lg + spacing.xs, Math.min(spacing.xl, Math.round(width * 0.045)))
    : 0;
  const contentWidthStyle: ViewStyle = useMemo(
    () =>
      padded
        ? {
            alignSelf: 'center',
            maxWidth: 980,
            width: '100%',
          }
        : {},
    [padded],
  );

  const paddingStyle: ViewStyle = useMemo(
    () => ({
      paddingTop: padded ? spacing.lg : 0,
      paddingHorizontal: hPad,
      paddingBottom: padded ? spacing.lg : 0,
    }),
    [padded, hPad],
  );

  const footerStyle: ViewStyle = useMemo(
    () => ({
      width: '100%',
      flexShrink: 0,
      paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingTop: spacing.md,
      backgroundColor: colors.bgElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    }),
    [colors.bgElevated, colors.border, insets.bottom, insets.left, insets.right],
  );

  const inner = scroll ? (
    <ScrollView
      ref={activeScrollRef}
      style={styles.fill}
      contentContainerStyle={[paddingStyle, { flexGrow: 1 }, contentWidthStyle, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, paddingStyle, contentWidthStyle, contentStyle]}>{children}</View>
  );

  return (
    <GlassBlurProvider
      style={{ backgroundColor: colors.bg }}
      target={<LinearGradient colors={bg} style={styles.fill} />}
    >
      <SafeAreaView
        style={styles.fill}
        edges={footer ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
      >
        {inner}
      </SafeAreaView>
      {footer ? (
        <View style={footerStyle}>
          <View style={[contentWidthStyle, { paddingHorizontal: hPad }]}>{footer}</View>
        </View>
      ) : null}
    </GlassBlurProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
