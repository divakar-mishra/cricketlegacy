import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import {
  fontSize,
  fontWeight,
  radius as radii,
  spacing,
  ThemeColors,
  useColors,
  useThemedStyles,
} from '../../theme';

export interface WagonWheelShot {
  /** 0..360 degrees, clockwise from the top of the ground. */
  angleDeg: number;
  /** Runs scored off the shot; drives the line colour and length. */
  runs: number;
}

export interface WagonWheelProps {
  shots: WagonWheelShot[];
  /** Square edge length in px for the ground. Default 260. */
  size?: number;
}

const MAX_RUNS = 6;

function colorForRuns(runs: number, colors: ThemeColors): string {
  if (runs >= 6) return colors.accent;
  if (runs === 4) return colors.primaryLight;
  return colors.textMuted;
}

export function WagonWheel({ shots, size = 260 }: WagonWheelProps): ReactElement {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const dim = size > 0 ? size : 260;
  const cx = dim / 2;
  const cy = dim / 2;
  const boundary = dim / 2 - 6;
  const inner = boundary * 0.5; // 30-yard circle
  const pitchW = Math.max(10, dim * 0.05);
  const pitchH = Math.max(40, dim * 0.22);

  const valid = shots.filter((s) => Number.isFinite(s.angleDeg) && Number.isFinite(s.runs));

  return (
    <View style={[styles.wrap, { width: dim }]}>
      <Svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={boundary}
          fill={colors.surfaceAlt}
          stroke={colors.primary}
          strokeWidth={2}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={inner}
          fill="none"
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="4 5"
        />

        <Rect
          x={cx - pitchW / 2}
          y={cy - pitchH / 2}
          width={pitchW}
          height={pitchH}
          rx={2}
          fill={colors.textFaint}
          fillOpacity={0.5}
          stroke={colors.borderStrong}
          strokeWidth={1}
        />

        <G>
          {valid.map((shot, i) => {
            const rad = (shot.angleDeg * Math.PI) / 180;
            // 0deg = up; rotate clockwise on screen (y grows downward).
            const dx = Math.sin(rad);
            const dy = -Math.cos(rad);
            const frac = Math.min(Math.max(shot.runs, 0), MAX_RUNS) / MAX_RUNS;
            const len = boundary * (0.25 + 0.75 * frac); // a six reaches the rope
            const ex = cx + dx * len;
            const ey = cy + dy * len;
            const stroke = colorForRuns(shot.runs, colors);
            return (
              <G key={`shot-${i}`}>
                <Line
                  x1={cx}
                  y1={cy}
                  x2={ex}
                  y2={ey}
                  stroke={stroke}
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  strokeLinecap="round"
                />
                <Circle cx={ex} cy={ey} r={2.6} fill={stroke} />
              </G>
            );
          })}
        </G>

        <Circle cx={cx} cy={cy} r={2.4} fill={colors.text} />
      </Svg>

      <View style={styles.legend}>
        <LegendItem color={colors.textMuted} label="1-3" />
        <LegendItem color={colors.primaryLight} label="4" />
        <LegendItem color={colors.accent} label="6" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }): ReactElement {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { alignItems: 'center' },
    legend: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    swatch: { width: 10, height: 10, borderRadius: radii.pill },
    legendText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  });
