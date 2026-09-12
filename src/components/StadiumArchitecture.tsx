import { memo } from 'react';
import { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { fieldGeometry } from './fieldGeometry';
import { GroundAppearance, standSections, standSector, visualLevel } from './venueVisuals';

interface Props extends GroundAppearance {
  size: number;
  accent?: string;
  noir?: boolean;
  detailed?: boolean;
}

/** Code-native live-match counterpart to the illustrated ground. Outside the rope only. */
export const StadiumArchitecture = memo(function StadiumArchitecture({
  size,
  capacityLevel,
  experienceLevel,
  accent = '#B39A66',
  noir = false,
  detailed = true,
}: Props) {
  const { cx, cy, groundR, stadiumR } = fieldGeometry(size);
  const capacity = visualLevel(capacityLevel);
  const experience = visualLevel(experienceLevel);
  const inner = groundR + size * 0.016;
  const outer = stadiumR - size * 0.008;
  const sections = standSections(capacity);
  const seat = noir ? '#88985D' : '#86BBB1';
  return (
    <G>
      <Circle
        cx={cx}
        cy={cy}
        r={stadiumR}
        fill="#202E36"
        stroke="#52616A"
        strokeWidth={size * 0.004}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={(inner + outer) / 2}
        fill="none"
        stroke={noir ? '#273226' : '#435B50'}
        strokeWidth={outer - inner}
      />
      <Circle cx={cx} cy={cy} r={inner} fill="none" stroke="#D5C9A8" strokeWidth={size * 0.01} />
      {sections.map((section) => {
        const start = (section * Math.PI) / 6 + 0.024;
        const end = ((section + 1) * Math.PI) / 6 - 0.024;
        return (
          <G key={section} testID={`live-stand-${section}`}>
            <Path
              d={standSector(cx, cy + size * 0.006, inner, outer, start, end)}
              fill="#080F18"
              opacity={0.8}
            />
            <Path
              d={standSector(cx, cy, inner, outer, start, end)}
              fill={noir ? '#343C2B' : section % 3 === 0 ? '#8B514C' : '#315F60'}
              stroke="#BEBDA7"
              strokeWidth={size * 0.002}
            />
            {Array.from({ length: detailed ? (capacity >= 4 ? 4 : 3) : 1 }, (_, row) => {
              const r = inner + ((outer - inner) * (row + 1)) / (capacity >= 4 ? 5 : 4);
              return (
                <Path
                  key={row}
                  d={standSector(cx, cy, r, r + size * 0.004, start + 0.01, end - 0.01)}
                  fill={section % 3 === 0 && !noir ? '#E4A48B' : seat}
                />
              );
            })}
            {capacity >= 4 ? (
              <Path
                d={standSector(
                  cx,
                  cy,
                  outer - size * (capacity === 5 ? 0.028 : 0.012),
                  outer,
                  start,
                  end,
                )}
                fill={capacity === 5 ? '#C6C8BB' : '#778B90'}
                stroke="#D3D9CC"
                strokeWidth={0.5}
              />
            ) : null}
            {capacity === 5 && detailed ? (
              <Path
                d={standSector(
                  cx,
                  cy,
                  outer - size * 0.025,
                  outer - size * 0.022,
                  start + 0.015,
                  end - 0.015,
                )}
                fill={accent}
              />
            ) : null}
            {detailed
              ? [0.33, 0.66].map((part) => {
                  const angle = start + (end - start) * part;
                  return (
                    <Line
                      key={part}
                      x1={cx + inner * Math.cos(angle)}
                      y1={cy + inner * Math.sin(angle)}
                      x2={cx + outer * Math.cos(angle)}
                      y2={cy + outer * Math.sin(angle)}
                      stroke="#CED0B7"
                      strokeWidth={size * 0.002}
                      opacity={0.7}
                    />
                  );
                })
              : null}
          </G>
        );
      })}
      {/* Low perimeter boards and end sightscreens never occlude a boundary shot. */}
      {detailed
        ? Array.from({ length: 12 }, (_, index) => {
            const angle = (index * Math.PI) / 6;
            return (
              <Path
                key={`board-${index}`}
                d={standSector(
                  cx,
                  cy,
                  groundR + size * 0.005,
                  groundR + size * 0.011,
                  angle + 0.04,
                  angle + 0.43,
                )}
                fill={index % 3 === 0 ? accent : '#E6DFC8'}
              />
            );
          })
        : null}
      {[-1, 1].map((end) => (
        <G key={`sightscreen-${end}`} testID={`live-sightscreen-${end}`}>
          <Rect
            x={cx - size * 0.065}
            y={cy + end * (groundR + size * 0.021) - size * 0.009}
            width={size * 0.13}
            height={size * 0.018}
            rx={size * 0.002}
            fill="#EEE7D4"
            stroke="#7E887C"
            strokeWidth={size * 0.002}
          />
          <Line
            x1={cx - size * 0.06}
            x2={cx + size * 0.06}
            y1={cy + end * (groundR + size * 0.021)}
            y2={cy + end * (groundR + size * 0.021)}
            stroke="#BFBFAE"
            strokeWidth={size * 0.002}
          />
        </G>
      ))}
      {/* Right-side pavilion leaves both end labels and sightscreens unobstructed. */}
      <Path
        testID="live-pavilion"
        d={standSector(cx, cy, inner, outer, -0.24, 0.24)}
        fill={experience >= 3 ? '#E2D7B8' : '#AC9878'}
        stroke="#D8CDAE"
        strokeWidth={1}
      />
      <Path
        d={standSector(cx, cy, outer - size * 0.025, outer, -0.25, 0.25)}
        fill={noir ? '#5C6341' : '#D4C7A6'}
        stroke="#F0E7CB"
        strokeWidth={size * 0.002}
      />
      {[-2, -1, 0, 1, 2].map((bay) => {
        const angle = bay * 0.075;
        return (
          <Path
            key={`pavilion-window-${bay}`}
            d={standSector(
              cx,
              cy,
              inner + size * 0.006,
              inner + size * 0.018,
              angle - 0.024,
              angle + 0.024,
            )}
            fill={experience >= 3 ? '#327A7B' : '#243E49'}
          />
        );
      })}
      {experience >= 2
        ? [-1, 1].map((side) => (
            <G key={side} transform={`translate(${cx + side * size * 0.14} ${cy + size * 0.434})`}>
              <Rect
                x={-size * 0.025}
                y={-size * 0.009}
                width={size * 0.05}
                height={size * 0.017}
                fill="#DFCFAB"
              />
              <Path
                d={`M ${-size * 0.03} 0 L 0 ${-size * 0.025} L ${size * 0.03} 0 Z`}
                fill={accent}
                stroke="#E5D7B6"
                strokeWidth={0.6}
              />
            </G>
          ))
        : null}
      {experience >= 4 ? (
        <Path
          d={standSector(cx, cy, outer - size * 0.005, outer, Math.PI * 1.07, Math.PI * 1.93)}
          fill="#D5B56D"
        />
      ) : null}
      {experience >= 5 ? (
        <Path
          d={standSector(cx, cy, outer - size * 0.005, outer + size * 0.004, 1.34, 1.8)}
          fill="#F5DF97"
        />
      ) : null}
    </G>
  );
});
