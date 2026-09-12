import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

/** Edge-only detailing keeps small scorecard portraits readable. */
export function ProfileFrame({ frameId, size }: { frameId?: string; size: number }) {
  const id = `frame-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const legend = frameId === 'frame_gold';
  const vip = frameId === 'frame_vip';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}
      pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no"
      testID={legend ? 'legend-engraved-frame' : vip ? 'vip-segmented-frame' : 'standard-profile-frame'}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF2B1" /><Stop offset=".3" stopColor="#B47B23" />
          <Stop offset=".55" stopColor="#F4D979" /><Stop offset="1" stopColor="#84521A" />
        </LinearGradient>
      </Defs>
      {legend ? <G>
        <Circle cx="50" cy="50" r="46" fill="none" stroke="#513512" strokeWidth="8" />
        <Circle cx="50" cy="50" r="46" fill="none" stroke={`url(#${id})`} strokeWidth="6" />
        <Circle cx="50" cy="50" r="42.5" fill="none" stroke="#FCE9AA" strokeWidth=".8" />
        {Array.from({ length: size < 64 ? 12 : 32 }, (_, i) => <Path key={i}
          d="M49 3.8 50 6.6 51 3.8" transform={`rotate(${i * 360 / (size < 64 ? 12 : 32)} 50 50)`}
          fill="none" stroke="#724915" strokeWidth=".7" />)}
        <Path d="M41 6 44 11H56L59 6 54 8 50 3 46 8Z" fill="#F6DA86" stroke="#78501B" strokeWidth="1" />
        <Path d="M43 93 50 89 57 93 50 97Z" fill="#E8C264" stroke="#674316" strokeWidth="1" />
      </G> : vip ? <G>
        <Circle cx="50" cy="50" r="47" fill="none" stroke="#262B3D" strokeWidth="5" />
        <Circle cx="50" cy="50" r="47" fill="none" stroke="#C5BEDC" strokeWidth="1.5" />
        <Circle cx="50" cy="50" r="44.5" fill="none" stroke="#9278C2" strokeWidth="2"
          strokeDasharray="52 18" transform="rotate(-34 50 50)" />
        <Path d="M50 1 54 5 50 9 46 5Z" fill="#DDD4EE" stroke="#6F5D91" strokeWidth="1" />
      </G> : <G>
        <Circle cx="50" cy="50" r="46.5" fill="none" stroke="#24D63B" strokeWidth="6" />
        <Circle cx="50" cy="50" r="49" fill="none" stroke="#A4FF8A" strokeWidth="1" />
        <Circle cx="50" cy="50" r="43" fill="none" stroke="#087529" strokeWidth="1.5" />
      </G>}
    </Svg>
  );
}
