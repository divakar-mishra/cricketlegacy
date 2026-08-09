import type { ReactElement } from 'react';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { fontSize, fontWeight, useColors } from '../../theme';

export interface RadarDatum {
  /** Short axis label shown at the vertex (keep it terse, e.g. "Power"). */
  label: string;
  /** Raw value; scaled against `max` (0..100 by default). */
  value: number;
}

export interface RadarChartProps {
  data: RadarDatum[];
  /** Square edge length in px. Default 260. */
  size?: number;
  /** Value that reaches the outer ring. Default 100. */
  max?: number;
}

type TextAnchor = 'start' | 'middle' | 'end';

/** Concentric grid rings as fractions of the full radius. */
const RINGS = [0.34, 0.67, 1] as const;
const MAX_AXES = 8;
const MIN_AXES = 3;

function clamp01(n: number): number {
  return Math.min(Math.max(n, 0), 1);
}

/** Cartesian point on a circle; `angleRad` measured from the positive x-axis. */
function polar(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function anchorForX(x: number, cx: number): TextAnchor {
  const dx = x - cx;
  if (Math.abs(dx) < 1) return 'middle';
  return dx > 0 ? 'start' : 'end';
}

export function RadarChart({ data, size = 260, max = 100 }: RadarChartProps): ReactElement | null {
  const colors = useColors();
  const axes = Math.min(data.length, MAX_AXES);
  if (axes < MIN_AXES || size <= 0) return null;

  const usable = data.slice(0, axes);
  const cx = size / 2;
  const cy = size / 2;
  const pad = Math.max(26, size * 0.14); // leaves room for the vertex labels
  const radius = size / 2 - pad;
  const safeMax = max > 0 ? max : 100;

  // First axis points straight up; the rest are spread clockwise.
  const angleAt = (i: number): number => -Math.PI / 2 + (i * 2 * Math.PI) / axes;
  const toPointStr = (r: number, i: number): string => {
    const p = polar(cx, cy, r, angleAt(i));
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  };

  const ringPolys = RINGS.map((f) => usable.map((_, i) => toPointStr(radius * f, i)).join(' '));
  const dataPoints = usable
    .map((d, i) => toPointStr(radius * clamp01(d.value / safeMax), i))
    .join(' ');

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {ringPolys.map((points, i) => (
          <Polygon
            key={`ring-${i}`}
            points={points}
            fill="none"
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}
      </G>

      <G>
        {usable.map((d, i) => {
          const outer = polar(cx, cy, radius, angleAt(i));
          const labelPos = polar(cx, cy, radius + pad * 0.5, angleAt(i));
          return (
            <G key={`axis-${i}`}>
              <Line
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke={colors.border}
                strokeWidth={1}
              />
              <SvgText
                x={labelPos.x}
                y={labelPos.y}
                fill={colors.textMuted}
                fontSize={fontSize.xs}
                fontWeight={fontWeight.semibold}
                textAnchor={anchorForX(labelPos.x, cx)}
                alignmentBaseline="middle"
              >
                {d.label}
              </SvgText>
            </G>
          );
        })}
      </G>

      <Polygon
        points={dataPoints}
        fill={colors.primary}
        fillOpacity={0.28}
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      <G>
        {usable.map((d, i) => {
          const p = polar(cx, cy, radius * clamp01(d.value / safeMax), angleAt(i));
          return (
            <Circle key={`vertex-${i}`} cx={p.x} cy={p.y} r={2.6} fill={colors.primaryLight} />
          );
        })}
      </G>
    </Svg>
  );
}
