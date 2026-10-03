import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { UmpireSignal } from './fieldSequence';

/** Small field-local official; no overlay or extra layout space. */
export function MatchUmpire({ size, signal }: { size: number; signal: UmpireSignal }) {
  const arms: Record<UmpireSignal, string> = {
    none: 'M-4 0 -6 6M4 0 6 6',
    out: 'M-4 0 -6 6M4 0 5 -10',
    four: 'M-4 0 -6 6M4 0 -4 2',
    six: 'M-4 0 -5 -10M4 0 5 -10',
    wide: 'M-4 0 -11 0M4 0 11 0',
    'no-ball': 'M-4 0 -6 6M4 0 11 0',
    bye: 'M-4 0 -5 -10M4 0 6 6',
    'leg-bye': 'M-4 0 -6 6M4 0 3 7',
  };
  return (
    <Svg width={size} height={size} viewBox="-16 -16 32 32">
      <G testID={`umpire-signal-${signal}`}>
        <Path d="M-2 4 -3 11M2 4 3 11" stroke="#233039" strokeWidth={3} />
        <Path d="M-4 -1Q0 -3 4 -1L3 5H-3Z" fill="#EEE8D8" stroke="#233039" strokeWidth={0.7} />
        <Path d={arms[signal]} fill="none" stroke="#EEE8D8" strokeWidth={2.2} strokeLinecap="round" />
        <Circle cy={-5} r={3} fill="#B87550" />
        <Rect x={-3.5} y={-10} width={7} height={4} rx={1} fill="#EEE8D8" />
        <Path d="M-6 -6H6" stroke="#EEE8D8" strokeWidth={2} strokeLinecap="round" />
        {signal === 'out' ? <Path d="M5 -10V-13" stroke="#B87550" strokeWidth={1} /> : null}
      </G>
    </Svg>
  );
}
