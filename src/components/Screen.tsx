import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
}: Props) {
  const insets = useSafeAreaInsets();
  const { gradients, colors } = useTheme();
  const { width } = useWindowDimensions();
  const bg = gradient ?? gradients.night;

  // Responsive horizontal padding: ~4% of width, bounded between md and xl.
  const hPad = padded ? Math.max(spacing.md, Math.min(spacing.xl, Math.round(width * 0.045))) : 0;
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
      paddingTop: insets.top + (padded ? spacing.lg : 0),
      paddingHorizontal: hPad,
      paddingBottom: padded ? spacing.lg : 0,
    }),
    [insets.top, padded, hPad],
  );

  const footerStyle: ViewStyle = useMemo(
    () => ({
      width: '100%',
      flexShrink: 0,
      paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
      paddingHorizontal: hPad,
      paddingTop: spacing.md,
      backgroundColor: colors.bgElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    }),
    [colors.bgElevated, colors.border, insets.bottom, hPad],
  );

  const inner = scroll ? (
    <ScrollView
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
      {inner}
      {footer ? <View style={footerStyle}>{footer}</View> : null}
    </GlassBlurProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
