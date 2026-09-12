import { memo, useId, type ReactElement } from 'react';
import {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { KitDesignLayer } from './KitDesign';

export interface CricketerProps {
  kitId?: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  primary: string;
  secondary: string;
  role: 'fielder' | 'keeper' | 'bowler' | 'batter';
}

function MatchJersey({
  shape,
  primary,
  secondary,
  kitId,
}: {
  shape: string;
  primary: string;
  secondary: string;
  kitId?: string;
}) {
  const id = 'shirt' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <G testID="match-jersey-tailoring">
      <Defs>
        <ClipPath id={id}>
          <Path d={shape} />
        </ClipPath>
        <LinearGradient id={id + 'cloth'} x1="0" y1="0" x2="1" y2=".8">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity=".38" />
          <Stop offset=".36" stopColor="#FFFFFF" stopOpacity=".04" />
          <Stop offset=".68" stopColor="#000000" stopOpacity=".08" />
          <Stop offset="1" stopColor="#000000" stopOpacity=".52" />
        </LinearGradient>
      </Defs>
      <Path d={shape} fill={primary} stroke="#0A1420" strokeWidth={0.9} />
      <G clipPath={'url(#' + id + ')'}>
        {kitId ? (
          <G transform="translate(-9.6 -3) scale(.06 .035)">
            <KitDesignLayer kitId={kitId} />
          </G>
        ) : (
          <Path d="M-4.6 -.2 0 1.7 4.6 -.2V1L0 3 -4.6 1Z" fill={secondary} opacity={0.8} />
        )}
        <Path d={shape} fill={'url(#' + id + 'cloth)'} />
        <Path
          d="M-3.5 -.4 -3 3.8M3.5 -.4 3 3.8M-1 3 .5 4M1 1.7 2.3 2.6"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.22}
          strokeWidth={0.45}
        />
        <Path d="M-1.8 -1.5 0 .1 1.8 -1.5" fill="#121D2C" stroke={secondary} strokeWidth={0.5} />
        <Path d="M0 .1V1.2" stroke="#F1E6CB" strokeWidth={0.45} />
      </G>
      <Path
        d="M-4.2 -.8 -3.6 2.1M4.2 -.8 3.6 2.1"
        stroke="#E3E5E1"
        strokeOpacity={0.5}
        strokeWidth={0.5}
      />
    </G>
  );
}

function CricketerArtwork({
  kitId,
  x,
  y,
  rotation = 0,
  scale = 1,
  primary,
  secondary,
  role,
}: CricketerProps): ReactElement {
  const transform = 'translate(' + x + ' ' + y + ') rotate(' + rotation + ') scale(' + scale + ')';
  const outline = '#06100B';
  const skin = '#B87550';

  if (role === 'batter') {
    return (
      <G transform={transform} testID={`cricketer-art-${role}`}>
        <Ellipse cx={0} cy={7.6} rx={8.2} ry={2.8} fill="#020504" opacity={0.44} />
        <Line x1={-2.8} y1={2.6} x2={-4.1} y2={8.2} stroke={outline} strokeWidth={4.5} />
        <Line x1={2.5} y1={2.6} x2={3.7} y2={8.2} stroke={outline} strokeWidth={4.5} />
        <Rect x={-5.5} y={3.5} width={3.2} height={5.7} rx={1} fill="#F4E8C8" />
        <Rect x={2.1} y={3.5} width={3.2} height={5.7} rx={1} fill="#F4E8C8" />
        <Path d="M -4.5,4.3 v 4 M 3.1,4.3 v 4" stroke="#B9A986" strokeWidth={0.6} />
        <MatchJersey
          shape="M -5,-0.8 Q 0,-3.6 5,-0.8 L 4.1,4.5 Q 0,6 -4.1,4.5 Z"
          primary={primary}
          secondary={secondary}
          kitId={kitId}
        />

        <Line x1={3.7} y1={0.2} x2={6.2} y2={3.7} stroke={skin} strokeWidth={2.3} />
        <Line x1={-3.8} y1={0.1} x2={2.5} y2={3.1} stroke={skin} strokeWidth={2.3} />
        <Path
          testID="bat-blade"
          d="M6.2 3.3 8.1 2.6 10.2 9.3Q10.4 10.1 9.5 10.4L8.9 10.6Q8.2 10.7 8 9.9Z"
          fill="#E3BE79"
          stroke="#6D4823"
          strokeWidth={0.6}
        />
        <Path d="M7.1 3 5.8 .2" stroke="#283442" strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M8 4.1 9.4 9.3" stroke="#FFF1C0" strokeWidth={0.55} />
        <Path
          d="M-5.4 8.4 -2 8.4 -1.8 9.9 -6 9.9ZM2.1 8.4H5.2L6.2 9.9H2.1Z"
          fill="#F4F0E6"
          stroke={outline}
          strokeWidth={0.5}
        />
        <Circle cx={4.5} cy={3} r={1.5} fill="#FFF4DC" stroke={outline} strokeWidth={0.4} />
        <Circle cx={0} cy={-5.2} r={3.35} fill={skin} stroke={outline} strokeWidth={0.9} />
        <Path d="M -3.5,-5.2 A 3.5,3.5 0 0 1 3.5,-5.2 L 3.1,-7.2 L -3.1,-7.2 Z" fill={outline} />
        <Path d="M-2.3 -6.2Q-.4 -8 2 -6.6" stroke="#6B8095" strokeWidth={0.8} fill="none" />
        <Line x1={-3.3} y1={-4.6} x2={3.7} y2={-4.6} stroke={secondary} strokeWidth={1.1} />
        <Line x1={2.7} y1={-4.6} x2={3.8} y2={-1.8} stroke="#E7EDF4" strokeWidth={0.65} />
        <Path
          d="M -3,-4 L 3.7,-4 L 3.2,-2 L -2.8,-2 Z"
          fill="none"
          stroke="#E7EDF4"
          strokeWidth={0.6}
        />
      </G>
    );
  }

  if (role === 'bowler') {
    return (
      <G transform={transform} testID={`cricketer-art-${role}`}>
        <Ellipse cx={0} cy={7.8} rx={7.4} ry={2.6} fill="#020504" opacity={0.44} />
        <Line x1={-2} y1={3} x2={-5.8} y2={8.5} stroke={outline} strokeWidth={4} />
        <Line x1={2.1} y1={3} x2={4.8} y2={7.2} stroke={outline} strokeWidth={4} />
        <Line x1={-2} y1={3} x2={-5.8} y2={8.5} stroke={primary} strokeWidth={2.4} />
        <Line x1={2.1} y1={3} x2={4.8} y2={7.2} stroke={primary} strokeWidth={2.4} />
        <Path
          d="M-6.6 7.7 -4.1 8.6 -5.1 10.1 -8 9.1ZM3.8 6.9 5.2 6.3 7 7.6 6.7 8.3 4.5 8.2Z"
          fill="#ECE9DC"
          stroke={outline}
          strokeWidth={0.5}
        />
        <MatchJersey
          shape="M -4.8,-1.2 Q 0,-3.7 4.8,-0.6 L 3.8,4.8 Q -0.5,6 -4.2,4.2 Z"
          primary={primary}
          secondary={secondary}
          kitId={kitId}
        />

        <Path
          d="M -3.8,-0.7 Q -7,-4.3 -4.7,-8.5 Q -3.1,-10.5 -0.9,-8.9"
          fill="none"
          stroke={skin}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* The delivery ball is rendered once by the motion layer. */}
        <Path
          d="M 4,-0.2 Q 7.1,1.4 5.5,5"
          fill="none"
          stroke={skin}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Circle cx={0.4} cy={-5.1} r={3.1} fill={skin} stroke={outline} strokeWidth={0.9} />
        <Path d="M -2.8,-5.7 Q 0.5,-8 3.5,-5.4" fill={primary} stroke={secondary} strokeWidth={1} />
        <Path d="M-1.5 -3.8Q.5 -2.7 2 -3.7" stroke="#674333" strokeWidth={0.5} fill="none" />
      </G>
    );
  }

  if (role === 'keeper') {
    return (
      <G transform={transform} testID={`cricketer-art-${role}`}>
        <Ellipse cx={0} cy={6.7} rx={9.2} ry={3.1} fill="#020504" opacity={0.44} />
        <Path d="M -2.4,2.5 L -7.1,7.2" stroke={outline} strokeWidth={5} strokeLinecap="round" />
        <Path d="M 2.4,2.5 L 7.1,7.2" stroke={outline} strokeWidth={5} strokeLinecap="round" />
        <Path d="M -2.4,2.5 L -7.1,7.2" stroke="#F4E8C8" strokeWidth={3} strokeLinecap="round" />
        <Path d="M 2.4,2.5 L 7.1,7.2" stroke="#F4E8C8" strokeWidth={3} strokeLinecap="round" />
        <MatchJersey
          shape="M -5.2,-0.5 Q 0,-3.4 5.2,-0.5 L 4.2,4.1 Q 0,5.7 -4.2,4.1 Z"
          primary={primary}
          secondary={secondary}
          kitId={kitId}
        />

        <Path d="M -4.2,0.2 L -8,4" stroke={skin} strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M 4.2,0.2 L 8,4" stroke={skin} strokeWidth={2.4} strokeLinecap="round" />
        <Path
          testID="keeper-gloves"
          d="M-10.1 2.2Q-11 3.2 -9.9 5.9L-7 6.3 -5.9 4.2 -7 2.2ZM10.1 2.2Q11 3.2 9.9 5.9L7 6.3 5.9 4.2 7 2.2Z"
          fill="#F0E8D2"
          stroke={outline}
          strokeWidth={0.8}
        />
        <Path
          d="M-9.7 3.4 -7 3.6M7 3.6 9.7 3.4M-9.2 5.1 -7.4 5.3M7.4 5.3 9.2 5.1"
          stroke={secondary}
          strokeWidth={1}
        />
        <Circle cx={0} cy={-4.9} r={3.25} fill={skin} stroke={outline} strokeWidth={0.9} />
        <Path
          d="M -3.2,-5.2 A 3.3,3.3 0 0 1 3.2,-5.2"
          fill={outline}
          stroke={secondary}
          strokeWidth={1.1}
        />
      </G>
    );
  }

  return (
    <G transform={transform} testID={`cricketer-art-${role}`}>
      <Ellipse cx={0} cy={6.8} rx={7} ry={2.5} fill="#020504" opacity={0.4} />
      <Line x1={-2.3} y1={2.7} x2={-3.8} y2={7.4} stroke={outline} strokeWidth={4} />
      <Line x1={2.3} y1={2.7} x2={3.8} y2={7.4} stroke={outline} strokeWidth={4} />
      <Line x1={-2.3} y1={2.7} x2={-3.8} y2={7.4} stroke={primary} strokeWidth={2.4} />
      <Line x1={2.3} y1={2.7} x2={3.8} y2={7.4} stroke={primary} strokeWidth={2.4} />
      <Path
        d="M-4.9 7H-2.6L-2.2 8.8H-6ZM2.6 7H4.9L6 8.8H2.2Z"
        fill="#E5E8DF"
        stroke={outline}
        strokeWidth={0.5}
      />
      <MatchJersey
        shape="M -4.8,-0.6 Q 0,-3.1 4.8,-0.6 L 3.8,4.6 Q 0,5.9 -3.8,4.6 Z"
        primary={primary}
        secondary={secondary}
        kitId={kitId}
      />

      <Line
        x1={-4.1}
        y1={0.1}
        x2={-7.1}
        y2={3.8}
        stroke={skin}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Line
        x1={4.1}
        y1={0.1}
        x2={7.1}
        y2={3.8}
        stroke={skin}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Circle cx={0} cy={-4.6} r={3} fill={skin} stroke={outline} strokeWidth={0.85} />
      <Path d="M -3,-4.9 Q 0,-7.1 3,-4.9" fill={primary} stroke={secondary} strokeWidth={1} />
      <Path
        testID="fielder-cap-brim"
        d="M-2.8 -4.9Q0 -3.9 3.5 -4.6L4.2 -5.3Q0 -5.6 -2.8 -4.9Z"
        fill={primary}
        stroke={outline}
        strokeWidth={0.5}
      />
    </G>
  );
}

export const Cricketer = memo(CricketerArtwork);
