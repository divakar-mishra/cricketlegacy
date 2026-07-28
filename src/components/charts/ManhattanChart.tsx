import type { ReactElement } from 'react';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { fontSize, fontWeight, useColors } from '../../theme';

export interface ManhattanOver {
  /** Over number (used for the x-axis label). */
  over: number;
  /** Runs conceded/scored in the over; drives bar height. */
  runs: number;
  /** Wickets that fell in the over; >0 draws a red marker. */
  wickets: number;
}

export interface ManhattanChartProps {
  overs: ManhattanOver[];
  /** Responsive width in px. Default 320. */
  width?: number;
  /** Height in px. Default 140. */
  height?: number;
}

const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 14; // headroom for the max gridline label + wicket markers
const PAD_B = 18; // room for the over-number axis

export function ManhattanChart({ overs, width = 320, height = 140 }: ManhattanChartProps): ReactElement {
  const colors = useColors();
  const w = width > 0 ? width : 320;
  const h = height > 0 ? height : 140;
  const plotW = Math.max(1, w - PAD_L - PAD_R);
  const plotH = Math.max(1, h - PAD_T - PAD_B);
  const baselineY = PAD_T + plotH;

  const n = overs.length;
  const maxRuns = Math.max(1, ...overs.map((o) => (Number.isFinite(o.runs) ? o.runs : 0)));
  const slot = n > 0 ? plotW / n : plotW;
  const barW = Math.max(2, Math.min(slot * 0.7, 22));
  const labelEvery = n > 8 ? 5 : 1; // avoid clutter over a full innings

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Line x1={PAD_L} y1={PAD_T} x2={w - PAD_R} y2={PAD_T} stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />
      <SvgText
        x={PAD_L}
        y={PAD_T - 4}
        fill={colors.textFaint}
        fontSize={fontSize.xs}
        fontWeight={fontWeight.medium}
        textAnchor="start"
      >
        {`${maxRuns}`}
      </SvgText>

      <Line x1={PAD_L} y1={baselineY} x2={w - PAD_R} y2={baselineY} stroke={colors.borderStrong} strokeWidth={1} />

      <G>
        {overs.map((o, i) => {
          const runs = Number.isFinite(o.runs) ? Math.max(0, o.runs) : 0;
          const barH = Math.max(0, (runs / maxRuns) * plotH);
          const centerX = PAD_L + slot * i + slot / 2;
          const x = centerX - barW / 2;
          const y = baselineY - barH;
          const showLabel = labelEvery === 1 || o.over % labelEvery === 0;
          return (
            <G key={`over-${i}`}>
              <Rect x={x} y={y} width={barW} height={barH} rx={2} fill={colors.primary} />
              {o.wickets > 0 ? <Circle cx={centerX} cy={y - 5} r={3} fill={colors.danger} /> : null}
              {showLabel ? (
                <SvgText
                  x={centerX}
                  y={h - 5}
                  fill={colors.textMuted}
                  fontSize={fontSize.xs}
                  fontWeight={fontWeight.medium}
                  textAnchor="middle"
                >
                  {`${o.over}`}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

export default ManhattanChart;
