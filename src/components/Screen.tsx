import React, { useMemo, useState } from 'react';
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
  /** Sticky content pinned to the bottom (respecting safe area). */
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
  const [footerHeight, setFooterHeight] = useState(0);
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
      paddingBottom: (padded ? spacing.lg : 0) + (footer ? footerHeight : 0),
    }),
    [insets.top, padded, hPad, footer, footerHeight],
  );

  const footerStyle: ViewStyle = useMemo(
    () => ({
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md,
      paddingHorizontal: hPad,
      paddingTop: spacing.md,
      zIndex: 10,
    }),
    [insets.bottom, hPad],
  );

  const inner = scroll ? (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[paddingStyle, { flexGrow: 1 }, contentWidthStyle, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
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
      {footer ? (
        <View
          style={footerStyle}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          {footer}
        </View>
      ) : null}
    </GlassBlurProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
