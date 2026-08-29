/**
 * HeroBackground — a pure-code cricket-ground hero visual.
 * Replaces the missing menu-hero.png / victory.png asset requires.
 * Renders a beautiful gradient + SVG cricket oval scene.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

interface HeroBackgroundProps {
  variant?: 'menu' | 'victory' | 'match' | 'dark';
  style?: ViewStyle;
  children?: React.ReactNode;
}

function CricketOvalSvg({ width, height, isDark }: { width: number; height: number; isDark: boolean }) {
  const cx = width / 2;
  const cy = height * 0.55;
  const rx = width * 0.42;
  const ry = height * 0.38;

  return (
    <Svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: [{ translateX: -width / 2 }],
      }}
    >
      <Defs>
        <RadialGradient id="groundGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={isDark ? '#1A4A2A' : '#2D7A45'} stopOpacity="0.9" />
          <Stop offset="70%" stopColor={isDark ? '#122E1A' : '#1F5C30'} stopOpacity="0.6" />
          <Stop offset="100%" stopColor={isDark ? '#0A1912' : '#0E2E1A'} stopOpacity="0.4" />
        </RadialGradient>
      </Defs>

      {/* Outer oval boundary */}
      <Ellipse
        cx={cx} cy={cy} rx={rx + 10} ry={ry + 8}
        fill="none"
        stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)'}
        strokeWidth={2}
      />

      {/* Ground fill */}
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#groundGrad)" />

      {/* Pitch strip */}
      <Rect
        x={cx - 12} y={cy - ry * 0.55}
        width={24} height={ry * 1.1}
        rx={3}
        fill={isDark ? 'rgba(200,160,80,0.3)' : 'rgba(210,180,100,0.45)'}
      />

      {/* Crease lines */}
      <Line
        x1={cx - 20} y1={cy - ry * 0.28}
        x2={cx + 20} y2={cy - ry * 0.28}
        stroke="rgba(255,255,255,0.4)" strokeWidth={1.5}
      />
      <Line
        x1={cx - 20} y1={cy + ry * 0.28}
        x2={cx + 20} y2={cy + ry * 0.28}
        stroke="rgba(255,255,255,0.4)" strokeWidth={1.5}
      />

      {/* Stumps top */}
      <Rect x={cx - 8} y={cy - ry * 0.3} width={3} height={10} rx={1} fill="rgba(255,255,255,0.7)" />
      <Rect x={cx - 2} y={cy - ry * 0.3} width={3} height={10} rx={1} fill="rgba(255,255,255,0.7)" />
      <Rect x={cx + 4} y={cy - ry * 0.3} width={3} height={10} rx={1} fill="rgba(255,255,255,0.7)" />

      {/* Stumps bottom */}
      <Rect x={cx - 8} y={cy + ry * 0.2} width={3} height={10} rx={1} fill="rgba(255,255,255,0.7)" />
      <Rect x={cx - 2} y={cy + ry * 0.2} width={3} height={10} rx={1} fill="rgba(255,255,255,0.7)" />
      <Rect x={cx + 4} y={cy + ry * 0.2} width={3} height={10} rx={1} fill="rgba(255,255,255,0.7)" />

      {/* Fielder dots */}
      {[
        [cx - rx * 0.6, cy - ry * 0.1],
        [cx + rx * 0.65, cy + ry * 0.05],
        [cx, cy - ry * 0.75],
        [cx - rx * 0.35, cy + ry * 0.65],
        [cx + rx * 0.3, cy - ry * 0.6],
        [cx - rx * 0.8, cy + ry * 0.45],
        [cx + rx * 0.78, cy - ry * 0.38],
        [cx + rx * 0.1, cy + ry * 0.8],
        [cx - rx * 0.15, cy - ry * 0.82],
      ].map(([fx, fy], i) => (
        <Circle key={i} cx={fx} cy={fy} r={3.5} fill="rgba(255,255,255,0.22)" />
      ))}

      {/* Stars / light flares */}
      {isDark && [
        [cx * 0.2, height * 0.1],
        [cx * 1.6, height * 0.08],
        [cx * 0.5, height * 0.18],
        [cx * 1.4, height * 0.22],
        [cx * 1.8, height * 0.12],
      ].map(([sx, sy], i) => (
        <Circle key={`s${i}`} cx={sx} cy={sy} r={i % 2 === 0 ? 1.5 : 1} fill="rgba(255,255,255,0.55)" />
      ))}
    </Svg>
  );
}

export function HeroBackground({ variant = 'menu', style, children }: HeroBackgroundProps) {
  const { isDark } = useTheme();

  const gradColors: Record<string, readonly [string, string, ...string[]]> = {
    menu:    ['#1A4A2C', '#0F2E1B', '#0A1912'] as const,
    victory: ['#1C3A15', '#2A5C20', '#0A1912'] as const,
    match:   ['#0F2A1A', '#1A3D28', '#071410'] as const,
    dark:    ['#0A1912', '#071410', '#04100C'] as const,
    light_menu:    ['#2A6B3E', '#1F5530', '#183F24'] as const,
    light_victory: ['#2F7A40', '#3A8E4F', '#1F5530'] as const,
    light_match:   ['#22613A', '#2D7A4A', '#183F24'] as const,
    light_dark:    ['#2A6B3E', '#1F5530', '#183F24'] as const,
  };

  const key = (!isDark ? 'light_' : '') + variant;
  const gc = gradColors[key] ?? gradColors[variant];

  return (
    <View style={[styles.container, style]}>
      <LinearGradient colors={gc} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      <CricketOvalSvg width={400} height={220} isDark={isDark} />
      {children}
    </View>
  );
}

/** Lightweight version used as a victory/result banner. */
export function VictoryHero({
  won,
  neutral,
  style,
}: {
  won?: boolean;
  neutral?: boolean;
  style?: ViewStyle;
}) {
  const { isDark } = useTheme();
  const gc: readonly [string, string, ...string[]] = won
    ? ['#1C4A25', '#1F7A3A', '#0A1912']
    : neutral
      ? ['#2D2818', '#51451F', '#17140B']
      : ['#3A1515', '#5A2020', '#1A0A0A'];

  return (
    <View style={[styles.container, { height: 160 }, style]}>
      <LinearGradient colors={gc} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <CricketOvalSvg width={400} height={160} isDark={isDark} />
      {/* Trophy / broken stumps */}
      <View style={styles.victoryOverlay}>
        <Svg width={64} height={64} viewBox="0 0 64 64">
          {won ? (
            <>
              <Path d="M24 8h16v20c0 11-8 20-8 20s-8-9-8-20V8z" fill="#E9B23B" opacity={0.9} />
              <Rect x="26" y="46" width="12" height="8" rx="2" fill="#C6902A" />
              <Rect x="20" y="54" width="24" height="4" rx="2" fill="#C6902A" />
              <Path d="M20 12c-8 0-12 4-12 10s6 12 16 14" fill="none" stroke="#F7D06E" strokeWidth="3" strokeLinecap="round" />
              <Path d="M44 12c8 0 12 4 12 10s-6 12-16 14" fill="none" stroke="#F7D06E" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : neutral ? (
            <>
              <Rect x="24" y="18" width="4" height="30" rx="2" fill="#F7E7BA" />
              <Rect x="30" y="18" width="4" height="30" rx="2" fill="#F7E7BA" />
              <Rect x="36" y="18" width="4" height="30" rx="2" fill="#F7E7BA" />
              <Rect x="23" y="15" width="9" height="3" rx="1.5" fill="#E9B23B" />
              <Rect x="33" y="15" width="9" height="3" rx="1.5" fill="#E9B23B" />
              <Circle cx="32" cy="54" r="4" fill="#B8322A" />
            </>
          ) : (
            <>
              <Rect x="28" y="12" width="5" height="28" rx="2" fill="rgba(255,255,255,0.5)" transform="rotate(-12, 32, 32)" />
              <Rect x="32" y="12" width="5" height="28" rx="2" fill="rgba(255,255,255,0.7)" />
              <Rect x="36" y="12" width="5" height="28" rx="2" fill="rgba(255,255,255,0.5)" transform="rotate(12, 32, 32)" />
              <Path d="M20 40 L44 42" stroke="#E5484D" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    overflow: 'hidden',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  victoryOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
