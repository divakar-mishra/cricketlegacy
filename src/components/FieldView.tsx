import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect } from 'react-native-svg';
import { useColors } from '../theme';

export interface LastShot {
  key: number; // bump to (re)trigger the animation
  angleDeg: number; // clockwise from straight
  reach: number; // 0..1 fraction of ground radius
  tone: 'normal' | 'four' | 'six' | 'wicket' | 'extra';
}

interface Props {
  size?: number;
  lastShot?: LastShot | null;
}

// Fielders in polar coords: [angleDeg clockwise from top, radiusFraction].
const FIELDERS: [number, number][] = [
  [25, 0.85],
  [70, 0.7],
  [115, 0.86],
  [150, 0.6],
  [200, 0.82],
  [235, 0.66],
  [300, 0.8],
  [330, 0.55],
  [180, 0.34],
];

export function FieldView({ size = 240, lastShot }: Props) {
  const colors = useColors();
  const TONE: Record<LastShot['tone'], string> = {
    normal: colors.textMuted,
    four: colors.primaryLight,
    six: colors.accent,
    wicket: colors.danger,
    extra: colors.info,
  };
  const cx = size / 2;
  const cy = size / 2;
  const groundR = size * 0.46;
  const innerR = size * 0.27;

  const polar = (angleDeg: number, r: number): { x: number; y: number } => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  };

  const t = useRef(new Animated.Value(0)).current;
  const end = lastShot ? polar(lastShot.angleDeg, lastShot.reach * groundR) : { x: cx, y: cy };

  useEffect(() => {
    if (!lastShot) return;
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: lastShot.tone === 'six' ? 620 : 460,
      useNativeDriver: true,
    }).start();
  }, [lastShot?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ballColor = lastShot ? TONE[lastShot.tone] : colors.text;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [cx - 6, end.x - 6] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [cy - 6, end.y - 6] });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.15, 0.9] });

  return (
    <View style={{ width: size, height: size }} accessibilityLabel="Top-down field view">
      <Svg width={size} height={size}>
        {/* outfield */}
        <Circle cx={cx} cy={cy} r={groundR} fill="#0E2A1A" stroke={colors.border} strokeWidth={2} />
        {/* 30-yard ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={innerR}
          fill="none"
          stroke={colors.borderStrong}
          strokeWidth={1}
          strokeDasharray="4 5"
        />
        {/* pitch */}
        <Rect
          x={cx - size * 0.035}
          y={cy - size * 0.13}
          width={size * 0.07}
          height={size * 0.26}
          rx={2}
          fill="#B9915A"
          opacity={0.85}
        />
        {/* trajectory */}
        {lastShot ? (
          <Line
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke={ballColor}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.55}
          />
        ) : null}
        {/* fielders */}
        <G>
          {FIELDERS.map(([ang, rf], i) => {
            const p = polar(ang, rf * groundR);
            return <Circle key={i} cx={p.x} cy={p.y} r={4} fill={colors.textMuted} />;
          })}
          {/* keeper + bowler near the pitch */}
          <Circle cx={cx} cy={cy + size * 0.16} r={4.5} fill={colors.info} />
          <Circle cx={cx} cy={cy - size * 0.16} r={4.5} fill={colors.danger} />
          {/* striker */}
          <Circle cx={cx} cy={cy + size * 0.1} r={5} fill={colors.accent} />
        </G>
      </Svg>
      {lastShot ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ball,
            { backgroundColor: ballColor, transform: [{ translateX }, { translateY }, { scale }] },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ball: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 0,
    left: 0,
  },
});
