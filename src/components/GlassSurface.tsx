/**
 * GlassSurface - a theme-aware backdrop-blurred container.
 *
 * Expo 57 requires Android BlurViews to reference an explicit BlurTargetView.
 * GlassBlurProvider owns that target and GlassSurface consumes the nearest one.
 */
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { createContext, useContext, useRef } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  type View as NativeView,
} from 'react-native';
import { radius as radii, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';

type BlurTargetRef = React.RefObject<NativeView | null>;
const GlassBlurTargetContext = createContext<BlurTargetRef | null>(null);

type GlassBlurProviderProps = {
  /** The native layer sampled by descendant GlassSurface components. */
  target: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassBlurProvider({ target, children, style }: GlassBlurProviderProps) {
  const targetRef = useRef<NativeView | null>(null);

  return (
    <View style={[styles.provider, style]}>
      {Platform.OS === 'android' ? (
        <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill} pointerEvents="none">
          {target}
        </BlurTargetView>
      ) : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {target}
        </View>
      )}
      <GlassBlurTargetContext.Provider value={targetRef}>
        {children}
      </GlassBlurTargetContext.Provider>
    </View>
  );
}

interface GlassSurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 0..1 - how frosted/opaque the glass reads (higher = more solid). */
  intensity?: number;
  /** Corner radius (defaults to the large token). */
  rounded?: number;
  /** Accent-tinted border + brighter sheen, for highlighted/active surfaces. */
  highlighted?: boolean;
  padded?: boolean;
  /** Enable the native backdrop blur layer. */
  blur?: boolean;
}

/** Append an alpha channel (0..1) to a #rgb / #rrggbb hex color. */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.slice(0, 6);
  const alpha = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${full}${alpha}`;
}

export const GlassSurface = React.memo(function GlassSurface({
  children,
  style,
  intensity = 0.5,
  rounded,
  highlighted = false,
  padded = true,
  blur = true,
}: GlassSurfaceProps) {
  const { colors, isDark } = useTheme();
  const themedStyles = useThemedStyles(makeStyles);
  const blurTarget = useContext(GlassBlurTargetContext);
  const borderRadius = rounded ?? radii.lg;
  const useBlur = blur && (Platform.OS !== 'android' || blurTarget != null);
  const baseAlpha = (useBlur ? 0.22 : 0.55) + intensity * 0.3;
  const sheenTop = 0.14 + intensity * 0.12;

  return (
    <View style={[themedStyles.wrap, { borderRadius }, highlighted && themedStyles.wrapHi, style]}>
      {useBlur ? (
        <BlurView
          intensity={Math.round(24 + intensity * 36)}
          tint={isDark ? 'dark' : 'light'}
          blurTarget={blurTarget ?? undefined}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurReductionFactor={3}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(colors.surface, baseAlpha) }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`rgba(255,255,255,${sheenTop})`, 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {highlighted ? (
        <LinearGradient
          colors={[withAlpha(colors.accent, 0.16), 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={padded ? themedStyles.content : undefined}>{children}</View>
    </View>
  );
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    wrapHi: {
      borderColor: withAlpha(colors.accent, 0.55),
    },
    content: {
      padding: spacing.lg,
    },
  });

const styles = StyleSheet.create({
  provider: {
    flex: 1,
  },
});
