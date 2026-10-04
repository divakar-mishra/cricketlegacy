import Svg, { Ellipse, G, Path } from 'react-native-svg';
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
        <Ellipse cx={1} cy={2} rx={6} ry={4} fill="#020504" opacity={0.25} />
        <Path d="M-2 2 -2.5 4M2 2 2.5 4" stroke="#233039" strokeWidth={2.3} />
        <Ellipse rx={4.8} ry={2.8} fill="#EEE8D8" stroke="#233039" strokeWidth={0.7} />
        <Path d={arms[signal]} fill="none" stroke="#EEE8D8" strokeWidth={2.2} strokeLinecap="round" />
        <Ellipse cy={-1.2} rx={4.5} ry={3.4} fill="#EEE8D8" stroke="#233039" strokeWidth={0.6} />
        <Ellipse cy={-1.6} rx={2.8} ry={2.3} fill="#FFF8E5" stroke="#A89D88" strokeWidth={0.5} />
        {signal === 'out' ? <Path d="M5 -10V-13" stroke="#B87550" strokeWidth={1} /> : null}
      </G>
    </Svg>
  );
}
