import type { ReactElement } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { useColors } from '../../theme';

export interface SparklineProps {
  /** Series to plot, oldest -> newest (e.g. recent form or ratings). */
  values: number[];
  /** Default 120. */
  width?: number;
  /** Default 36. */
  height?: number;
  /** Line/area/endpoint colour. Defaults to the brand primary. */
  color?: string;
}

const PAD = 3;

export function Sparkline({ values, width = 120, height = 36, color }: SparklineProps): ReactElement | null {
  const colors = useColors();
  const col = color ?? colors.primary;
  const w = width > 0 ? width : 120;
  const h = height > 0 ? height : 36;
  const nums = values.filter((v) => Number.isFinite(v));
  const n = nums.length;
  if (n === 0) return null;

  const innerW = w - PAD * 2;
  const innerH = h - PAD * 2;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1; // flat series -> centred line

  const xAt = (i: number): number => (n === 1 ? w / 2 : PAD + (i * innerW) / (n - 1));
  const yAt = (v: number): number => PAD + innerH - ((v - min) / range) * innerH;

  if (n === 1) {
    return (
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Circle cx={w / 2} cy={h / 2} r={2.5} fill={col} />
      </Svg>
    );
  }

  const points = nums.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const first = points[0];
  const last = points[n - 1];
  const baseY = (h - PAD).toFixed(2);
  const area = `${line} L${last.x.toFixed(2)} ${baseY} L${first.x.toFixed(2)} ${baseY} Z`;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Path d={area} fill={col} fillOpacity={0.15} stroke="none" />
      <Path
        d={line}
        fill="none"
        stroke={col}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={last.x} cy={last.y} r={2.4} fill={col} />
    </Svg>
  );
}

export default Sparkline;
