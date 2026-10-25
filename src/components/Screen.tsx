import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '../theme';
import { GlassBlurProvider } from './GlassSurface';
import { CareerNavigation } from './CareerNavigation';
import { CareerGuide, GuideScrollView, type CareerGuideConfig } from './CareerGuide';

type GradientColors = readonly [string, string, ...string[]];

type Props = {
  guide?: CareerGuideConfig;
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  gradient?: GradientColors;
  contentStyle?: ViewStyle;
  /** Sticky content pinned below the screen body, respecting the safe area. */
  footer?: React.ReactNode;
  /** Opt-in section navigation on ordinary career screens; action footers take precedence. */
  careerNavigation?: boolean;
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
  guide,
  children,
  scroll = false,
  padded = true,
  gradient,
  contentStyle,
  footer: actionFooter,
  careerNavigation = false,
  scrollResetKey,
  scrollRef,
}: Props) {
  // Keep per-form guide progress across plain pages, without mounting the
  // guide-aware scroller on those pages. Ordinary disabled overlays stay guided.
  if (guide) return <CareerGuide {...guide}><ScreenBody {...{
    children, scroll, padded, gradient, contentStyle, footer: actionFooter,
    careerNavigation, scrollResetKey, scrollRef,
  }} guided={guide.layout !== 'plain'} /></CareerGuide>;
  return <ScreenBody {...{ children, scroll, padded, gradient, contentStyle,
    footer: actionFooter, careerNavigation, scrollResetKey, scrollRef }} />;
}

function ScreenBody({ children, scroll = false, padded = true, gradient, contentStyle,
  footer: actionFooter, careerNavigation = false, scrollResetKey, scrollRef, guided = false,
}: Props & { guided?: boolean }) {
  const footer = actionFooter ?? (careerNavigation ? <CareerNavigation /> : undefined);
  const insets = useSafeAreaInsets();
  const { gradients, colors } = useTheme();
  const { width } = useWindowDimensions();
  const bg = gradient ?? gradients.night;
  const internalScrollRef = useRef<ScrollView>(null);
  const activeScrollRef = scrollRef ?? internalScrollRef;

  useEffect(() => {
    // Guided pages remount their native scroller below. Do not race its coach's
    // target reveal with a second imperative scroll-to-top command.
    if (guided || !scroll || scrollResetKey == null) return;
    activeScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeScrollRef, guided, scroll, scrollResetKey]);

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

  const Scroller = guided ? GuideScrollView : ScrollView;
  const inner = scroll ? (
    <Scroller
      key={guided ? scrollResetKey : undefined}
      {...(guided ? { scrollRef: activeScrollRef } : { ref: activeScrollRef })}
      style={styles.fill}
      contentContainerStyle={[paddingStyle, { flexGrow: 1 }, contentWidthStyle, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      overScrollMode="never"
    >
      {children}
    </Scroller>
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
