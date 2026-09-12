import type { ComponentProps, ReactElement } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { Conditions, Dismissal } from '../domain/types';
import type { FieldSetting } from '../engine/intent';
import { useSettings } from '../state/settingsStore';
import { useColors } from '../theme';
import { AppText } from './AppText';
import { kitColorHex, kitDesign } from '../data/cosmetics';
import { Cricketer, type CricketerProps } from './CricketerArtwork';
import { StadiumArchitecture } from './StadiumArchitecture';
import { cricketerScale, deliveryCaption, visualRunningCount } from './fieldPresentation';
import { GroundAppearance, standSections } from './venueVisuals';
import {
  deliveryBouncePoint,
  fieldGeometry,
  fieldingPositions,
  fieldShotPath,
  pitchGeometry,
} from './fieldGeometry';
import type { FieldLayout, FieldShotTone } from './fieldGeometry';
import {
  DELIVERY_ROLE_MOTION_MS,
  DELIVERY_RUN_UP_MS,
  deliveryBallFlightMs,
  fieldingReaction,
} from './fieldMotion';

export interface LastShot {
  key: number;
  angleDeg: number;
  reach: number;
  tone: FieldShotTone;
  runs?: number;
  delivery?: string;
  shot?: string;
  dismissalType?: Dismissal['type'];
}

interface Props {
  userKitId?: string;
  userIsBowler?: boolean;
  size?: number;
  lastShot?: LastShot | null;
  stadiumTheme?: string;
  animate?: boolean;
  userBatterPosition?: 'striker' | 'nonStriker' | null;
  battingPrimaryColor?: string;
  battingSecondaryColor?: string;
  fieldingPrimaryColor?: string;
  fieldingSecondaryColor?: string;
  fieldSetting?: FieldSetting;
  conditions?: Conditions;
  groundAppearance?: GroundAppearance;
  groundPrimaryColor?: string;
}


interface CricketerSpriteProps extends CricketerProps {
  fieldSize: number;
  style?: ComponentProps<typeof Animated.View>['style'];
}

const FIELD_PALETTES = {
  STANDARD: {
    outfield: '#123D2C',
    outfieldLight: '#236747',
    pitch: '#B9915A',
    ring: '#65996B',
    rope: '#F4E4A1',
    stand: '#171D28',
  },
  NOIR: {
    outfield: '#050806',
    outfieldLight: '#142316',
    pitch: '#233D22',
    ring: '#B9F23D',
    rope: '#D5B56D',
    stand: '#11140F',
  },
} as const;

const PITCH_TONE: Record<Conditions['pitch'], string> = {
  GREEN: '#80966A',
  DRY: '#B9915A',
  DUSTY: '#A97D49',
  FLAT: '#C8A66A',
  CRACKED: '#947149',
};


function CricketerSprite({
  kitId,
  x,
  y,
  rotation,
  scale,
  primary,
  secondary,
  role,
  fieldSize,
  style,
}: CricketerSpriteProps): ReactElement {
  const spriteSize = fieldSize * 0.135;

  return (
    <Animated.View
      pointerEvents="none"
      testID={`live-player-${role}`}
      style={[
        styles.cricketerSprite,
        {
          width: spriteSize,
          height: spriteSize,
          left: x - spriteSize / 2,
          top: y - spriteSize / 2,
        },
        style,
      ]}
    >
      <Svg width={spriteSize} height={spriteSize} viewBox="-16 -16 32 32">
        {role === 'batter' ? (
          <Ellipse cx={0} cy={1} rx={12} ry={11} fill="#E4CB8E" opacity={0.12} />
        ) : null}
        <Cricketer
          kitId={kitId}
          x={0}
          y={0}
          rotation={rotation}
          scale={scale}
          primary={kitId ? kitColorHex(kitId) ?? primary : primary}
          secondary={kitId ? kitDesign(kitId).trim : secondary}
          role={role}
        />
        {role !== 'fielder' ? (
          <G>
            <Rect
              x={-8}
              y={11}
              width={16}
              height={4.8}
              rx={2}
              fill={role === 'batter' ? '#F4E8C8' : '#102737'}
            />
            <SvgText
              x={0}
              y={14.7}
              textAnchor="middle"
              fontSize={4}
              fontWeight="800"
              fill={role === 'batter' ? '#17262D' : '#FFFFFF'}
            >
              {role === 'batter' ? 'BAT' : role === 'keeper' ? 'WK' : 'BWL'}
            </SvgText>
          </G>
        ) : null}
      </Svg>
    </Animated.View>
  );
}

function Stumps({
  x,
  y,
  direction,
  size,
  color,
}: {
  x: number;
  y: number;
  direction: -1 | 1;
  size: number;
  color: string;
}): ReactElement {
  const length = size * 0.03;
  const gap = size * 0.009;
  return (
    <G>
      {[-1, 0, 1].map((offset) => (
        <Line
          key={'stump-' + direction + '-' + offset}
          x1={x + offset * gap}
          y1={y}
          x2={x + offset * gap}
          y2={y + direction * length}
          stroke={color}
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      ))}
      <Line
        x1={x - gap * 1.2}
        y1={y + direction * length}
        x2={x + gap * 1.2}
        y2={y + direction * length}
        stroke={color}
        strokeWidth={1.15}
        strokeLinecap="round"
      />
    </G>
  );
}

function faceCentreRotation(x: number, y: number, cx: number, cy: number): number {
  return (Math.atan2(cx - x, -(cy - y)) * 180) / Math.PI;
}

function readableDescriptor(value?: string): string {
  return value ? value.toLowerCase().replace(/_/g, ' ') : '';
}

export function FieldView({
  userKitId,
  userIsBowler = false,
  size = 240,
  lastShot,
  stadiumTheme,
  animate = true,
  userBatterPosition,
  battingPrimaryColor,
  battingSecondaryColor,
  fieldingPrimaryColor,
  fieldingSecondaryColor,
  fieldSetting = 'BALANCED',
  conditions,
  groundAppearance,
  groundPrimaryColor,
}: Props) {
  const colors = useColors();
  const graphics = useSettings((state) => state.graphics);
  const reducedMotion = useReducedMotion();
  const motionEnabled = animate && !reducedMotion && graphics !== 'low';
  const caption = deliveryCaption(lastShot);
  const palette = stadiumTheme === 'stadium_noir' ? FIELD_PALETTES.NOIR : FIELD_PALETTES.STANDARD;
  const capacityLevel = groundAppearance?.capacityLevel ?? 1;
  const experienceLevel = groundAppearance?.experienceLevel ?? 1;
  const toneColors: Record<LastShot['tone'], string> = {
    normal: colors.textMuted,
    four: colors.primaryLight,
    six: colors.accent,
    wicket: colors.danger,
    extra: colors.info,
  };
  const { cx, cy, stadiumR, groundR, innerR, bowler, striker, nonStriker, keeper } =
    fieldGeometry(size);
  const layout = fieldSetting as FieldLayout;
  const fielders = fieldingPositions(size, layout);
  const batterPrimary = battingPrimaryColor ?? colors.accentDark;
  const batterSecondary = battingSecondaryColor ?? colors.accentLight;
  const fielderPrimary = fieldingPrimaryColor ?? colors.info;
  const fielderSecondary = fieldingSecondaryColor ?? colors.white;
  const pitchColor = conditions ? PITCH_TONE[conditions.pitch] : palette.pitch;
  const bounce = deliveryBouncePoint(size, lastShot?.delivery);
  const defaultShotPath = lastShot ? fieldShotPath(size, lastShot) : null;
  const reaction = lastShot ? fieldingReaction(size, lastShot, layout) : null;
  const fieldActionPoint = reaction?.end ?? striker;
  const caught = lastShot?.tone === 'wicket' && lastShot.dismissalType === 'CAUGHT';
  const runOut = lastShot?.tone === 'wicket' && lastShot.dismissalType === 'RUN_OUT';
  const shotEnd = caught
    ? fieldActionPoint
    : runOut
      ? nonStriker
      : (defaultShotPath?.end ?? striker);
  const shotControl =
    caught || runOut
      ? {
          x: (striker.x + fieldActionPoint.x) / 2,
          y: (striker.y + fieldActionPoint.y) / 2,
        }
      : (defaultShotPath?.control ?? striker);
  const actionPoint = runOut ? fieldActionPoint : shotControl;
  const showShotPath = Boolean(lastShot && (lastShot.tone !== 'wicket' || caught || runOut));
  const userBatter =
    userBatterPosition === 'striker'
      ? striker
      : userBatterPosition === 'nonStriker'
        ? nonStriker
        : null;
  const userBadgeLabel =
    userBatterPosition === 'striker'
      ? 'YOU · ON STRIKE'
      : userBatterPosition === 'nonStriker'
        ? 'YOU · NON-STRIKER'
        : null;
  const userBadgeWidth = size * (userBatterPosition === 'nonStriker' ? 0.38 : 0.34);
  const userBadgeHeight = Math.max(14, size * 0.057);
  const userBadgeX =
    userBatterPosition === 'striker'
      ? striker.x + size * 0.05
      : Math.max(5, nonStriker.x - userBadgeWidth - size * 0.035);
  const userBadgeY = userBatter ? userBatter.y - userBadgeHeight / 2 : 0;
  const crowdCount = graphics === 'low' ? 20 : graphics === 'medium' ? 34 : 52;
  const crowd = useMemo(
    () =>
      Array.from({ length: crowdCount }, (_, index) => {
        const sections = standSections(capacityLevel);
        const section = sections[index % sections.length];
        const angle = ((section + 0.18 + ((index * 7) % 11) / 17) * Math.PI) / 6;
        const ring = groundR + (stadiumR - groundR) * (0.32 + (index % 3) * 0.16);
        return {
          x: cx + Math.cos(angle) * ring,
          y: cy + Math.sin(angle) * ring,
          color: [fielderPrimary, batterPrimary, colors.textMuted, colors.accent][index % 4],
          radius: Math.max(0.9, size * (index % 4 === 0 ? 0.005 : 0.0038)),
        };
      }),
    [
      batterPrimary,
      capacityLevel,
      colors.accent,
      colors.textMuted,
      crowdCount,
      cx,
      cy,
      fielderPrimary,
      groundR,
      size,
      stadiumR,
    ],
  );
  const floodlights = useMemo(
    () =>
      [45, 135, 225, 315].map((angleDeg) => {
        const angle = (angleDeg * Math.PI) / 180;
        const x = cx + Math.cos(angle) * stadiumR * 0.89;
        const y = cy + Math.sin(angle) * stadiumR * 0.89;
        const distance = Math.max(1, Math.hypot(cx - x, cy - y));
        const unitX = (cx - x) / distance;
        const unitY = (cy - y) / distance;
        const perpX = -unitY;
        const perpY = unitX;
        const startHalf = size * 0.012;
        const endHalf = size * 0.105;
        const endX = x + unitX * stadiumR * 0.78;
        const endY = y + unitY * stadiumR * 0.78;

        return {
          x,
          y,
          beam:
            'M ' +
            (x + perpX * startHalf) +
            ' ' +
            (y + perpY * startHalf) +
            ' L ' +
            (endX + perpX * endHalf) +
            ' ' +
            (endY + perpY * endHalf) +
            ' L ' +
            (endX - perpX * endHalf) +
            ' ' +
            (endY - perpY * endHalf) +
            ' L ' +
            (x - perpX * startHalf) +
            ' ' +
            (y - perpY * startHalf) +
            ' Z',
        };
      }),
    [cx, cy, size, stadiumR],
  );
  const ballT = useRef(new Animated.Value(0)).current;
  const roleT = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!lastShot) return;
    ballT.stopAnimation();
    roleT.stopAnimation();
    ballT.setValue(motionEnabled ? 0 : 1);
    roleT.setValue(motionEnabled ? 0 : 1);
    if (!motionEnabled) return;

    const motion = Animated.parallel([
      Animated.sequence([
        Animated.delay(DELIVERY_RUN_UP_MS),
        Animated.timing(ballT, {
          toValue: 1,
          duration: deliveryBallFlightMs(lastShot.tone),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(roleT, {
        toValue: 1,
        duration: DELIVERY_ROLE_MOTION_MS,
        useNativeDriver: true,
      }),
    ]);
    motion.start();

    return () => motion.stop();
  }, [motionEnabled, lastShot?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ballColor = lastShot ? toneColors[lastShot.tone] : colors.text;
  const translateX = ballT.interpolate({
    inputRange: [0, 0.3, 0.46, 0.74, 1],
    outputRange: [bowler.x - 5, bounce.x - 5, striker.x - 5, actionPoint.x - 5, shotEnd.x - 5],
  });
  const translateY = ballT.interpolate({
    inputRange: [0, 0.3, 0.46, 0.74, 1],
    outputRange: [bowler.y - 5, bounce.y - 5, striker.y - 5, actionPoint.y - 5, shotEnd.y - 5],
  });
  const scale = ballT.interpolate({
    inputRange: [0, 0.3, 0.46, 0.74, 1],
    outputRange: [0.72, 0.82, 1.12, lastShot?.tone === 'six' ? 1.65 : 0.96, 0.9],
  });
  const ballOpacity = ballT.interpolate({
    inputRange: [0, 0.02, 1],
    outputRange: [0, 1, 1],
  });
  const shadowScale = ballT.interpolate({
    inputRange: [0, 0.46, 0.74, 1],
    outputRange: [0.7, 0.9, lastShot?.tone === 'six' ? 1.9 : 0.85, 0.65],
  });
  const shadowOpacity = ballT.interpolate({
    inputRange: [0, 0.02, 0.46, 0.74, 1],
    outputRange: [0, 0.1, 0.16, lastShot?.tone === 'six' ? 0.28 : 0.14, 0.08],
  });
  const bowlerTranslateY = roleT.interpolate({
    inputRange: [0, 0.15, 0.34, 1],
    outputRange: [size * 0.055, 0, -size * 0.022, 0],
  });
  const bowlerRotate = roleT.interpolate({
    inputRange: [0, 0.15, 0.3, 0.48, 1],
    outputRange: ['-7deg', '0deg', '12deg', '-4deg', '0deg'],
  });
  const batterRotate = roleT.interpolate({
    inputRange: [0, 0.26, 0.34, 0.5, 0.68, 1],
    outputRange: ['0deg', '0deg', '-11deg', '14deg', '5deg', '0deg'],
  });
  const batterScale = roleT.interpolate({
    inputRange: [0, 0.32, 0.5, 0.72, 1],
    outputRange: [1, 1, 1.1, 1.02, 1],
  });
  const keeperTranslateY = roleT.interpolate({
    inputRange: [0, 0.38, 0.55, 0.76, 1],
    outputRange: [0, 0, lastShot?.tone === 'wicket' ? size * 0.018 : size * 0.008, 0, 0],
  });
  const keeperScale = roleT.interpolate({
    inputRange: [0, 0.4, 0.58, 0.78, 1],
    outputRange: [1, 1, lastShot?.tone === 'wicket' ? 1.14 : 1.06, 1, 1],
  });
  const fielderTranslateX = roleT.interpolate({
    inputRange: [0, 0.4, 0.88, 1],
    outputRange: [
      0,
      0,
      reaction ? reaction.end.x - reaction.start.x : 0,
      reaction ? reaction.end.x - reaction.start.x : 0,
    ],
  });
  const fielderTranslateY = roleT.interpolate({
    inputRange: [0, 0.4, 0.88, 1],
    outputRange: [
      0,
      0,
      reaction ? reaction.end.y - reaction.start.y : 0,
      reaction ? reaction.end.y - reaction.start.y : 0,
    ],
  });
  const fielderScale = roleT.interpolate({
    inputRange: [0, 0.42, 0.72, 0.9, 1],
    outputRange: [1, 1, 1.12, 1.04, 1],
  });

  const runCount = motionEnabled ? visualRunningCount(lastShot) : 0;
  const crossingX = nonStriker.x - striker.x;
  const crossingY = nonStriker.y - striker.y;
  const runnerInputRange =
    runCount === 1
      ? [0, 0.42, 1]
      : runCount === 2
        ? [0, 0.4, 0.7, 1]
        : runCount === 3
          ? [0, 0.38, 0.58, 0.79, 1]
          : [0, 1];
  const strikerRunX = roleT.interpolate({
    inputRange: runnerInputRange,
    outputRange:
      runCount === 1
        ? [0, 0, crossingX]
        : runCount === 2
          ? [0, 0, crossingX, 0]
          : runCount === 3
            ? [0, 0, crossingX, 0, crossingX]
            : [0, 0],
  });
  const strikerRunY = roleT.interpolate({
    inputRange: runnerInputRange,
    outputRange:
      runCount === 1
        ? [0, 0, crossingY]
        : runCount === 2
          ? [0, 0, crossingY, 0]
          : runCount === 3
            ? [0, 0, crossingY, 0, crossingY]
            : [0, 0],
  });
  const nonStrikerRunX = roleT.interpolate({
    inputRange: runnerInputRange,
    outputRange:
      runCount === 1
        ? [0, 0, -crossingX]
        : runCount === 2
          ? [0, 0, -crossingX, 0]
          : runCount === 3
            ? [0, 0, -crossingX, 0, -crossingX]
            : [0, 0],
  });
  const nonStrikerRunY = roleT.interpolate({
    inputRange: runnerInputRange,
    outputRange:
      runCount === 1
        ? [0, 0, -crossingY]
        : runCount === 2
          ? [0, 0, -crossingY, 0]
          : runCount === 3
            ? [0, 0, -crossingY, 0, -crossingY]
            : [0, 0],
  });
  const majorEvent =
    lastShot?.tone === 'four' || lastShot?.tone === 'six' || lastShot?.tone === 'wicket';
  const eventPulseColor = lastShot?.tone === 'wicket' ? colors.danger : ballColor;
  const stadiumPulseOpacity = ballT.interpolate({
    inputRange: [0, 0.78, 0.92, 1],
    outputRange: [0, 0, 0.7, 0],
  });
  const stadiumPulseScale = ballT.interpolate({
    inputRange: [0, 0.78, 1],
    outputRange: [0.98, 0.98, 1.045],
  });
  const impactPulseOpacity = ballT.interpolate({
    inputRange: [0, 0.78, 0.9, 1],
    outputRange: [0, 0, 1, 0],
  });
  const impactPulseScale = ballT.interpolate({
    inputRange: [0, 0.78, 1],
    outputRange: [0.35, 0.35, lastShot?.tone === 'six' ? 1.9 : 1.55],
  });
  const impactCoreScale = ballT.interpolate({
    inputRange: [0, 0.8, 0.92, 1],
    outputRange: [0.4, 0.4, 1.2, 0.8],
  });
  const impactSize = size * (lastShot?.tone === 'six' ? 0.11 : 0.085);
  let trajectory = '';
  if (lastShot) {
    trajectory =
      'M ' +
      striker.x +
      ' ' +
      striker.y +
      ' Q ' +
      shotControl.x +
      ' ' +
      shotControl.y +
      ' ' +
      fieldActionPoint.x +
      ' ' +
      fieldActionPoint.y;
    if (!caught && !runOut) {
      trajectory =
        'M ' +
        striker.x +
        ' ' +
        striker.y +
        ' Q ' +
        shotControl.x +
        ' ' +
        shotControl.y +
        ' ' +
        shotEnd.x +
        ' ' +
        shotEnd.y;
    } else if (runOut) {
      trajectory += ' L ' + nonStriker.x + ' ' + nonStriker.y;
    }
  }
  const {
    top: pitchTop,
    height: pitchHeight,
    width: pitchWidth,
    strikerStumpY,
    bowlerStumpY,
  } = pitchGeometry(size);
  const wicketAtStriker =
    lastShot?.tone === 'wicket' && !caught && !runOut && lastShot.dismissalType !== 'LBW';
  const fieldDescription = fieldSetting.toLowerCase().replace(/_/g, ' ');
  const eventDescription = lastShot
    ? '. ' +
      readableDescriptor(lastShot.delivery) +
      ' delivery' +
      (lastShot.shot ? ', ' + readableDescriptor(lastShot.shot) : '')
    : '';
  const accessibilityLabel =
    (stadiumTheme === 'stadium_noir' ? 'Stadium Noir' : 'Standard') +
    ' top-down cricket field. ' +
    fieldDescription +
    ' field' +
    (userBatterPosition === 'striker'
      ? '. Your player is on strike'
      : userBatterPosition === 'nonStriker'
        ? '. Your player is the non-striker'
        : '') +
    eventDescription;
  const deliveryPath =
    'M ' +
    bowler.x +
    ' ' +
    bowler.y +
    ' L ' +
    bounce.x +
    ' ' +
    bounce.y +
    ' L ' +
    striker.x +
    ' ' +
    striker.y;

  return (
    <>
      <View
        style={{ width: size, height: size }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <Svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
          <Defs>
            <RadialGradient id="field-outfield" cx="46%" cy="42%" rx="62%" ry="62%">
              <Stop offset="0%" stopColor={palette.outfieldLight} />
              <Stop offset="100%" stopColor={palette.outfield} />
            </RadialGradient>
            <SvgLinearGradient id="field-pitch" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={pitchColor} />
              <Stop offset="55%" stopColor={palette.pitch} />
              <Stop offset="100%" stopColor={pitchColor} />
            </SvgLinearGradient>
          </Defs>

          <StadiumArchitecture
            size={size}
            capacityLevel={capacityLevel}
            experienceLevel={experienceLevel}
            accent={groundPrimaryColor ?? fielderPrimary}
            noir={stadiumTheme === 'stadium_noir'}
            detailed={graphics !== 'low'}
          />
          {crowd.map((spectator, index) => (
            <Circle
              key={'crowd-' + index}
              cx={spectator.x}
              cy={spectator.y}
              r={spectator.radius}
              fill={spectator.color}
              opacity={0.76}
            />
          ))}
          {graphics !== 'low' ? (
            <G>
              {floodlights.map((light, index) => (
                <G key={'floodlight-' + index}>
                  <Circle
                    cx={light.x}
                    cy={light.y}
                    r={size * 0.025}
                    fill={palette.rope}
                    opacity={0.12}
                  />
                  <Circle
                    cx={light.x}
                    cy={light.y}
                    r={size * 0.012}
                    fill={colors.white}
                    stroke={palette.rope}
                    strokeWidth={1}
                    opacity={0.94}
                  />
                  <Circle cx={light.x} cy={light.y} r={size * 0.004} fill={colors.white} />
                </G>
              ))}
            </G>
          ) : null}
          <Rect
            x={cx - size * 0.17}
            y={size * 0.12}
            width={size * 0.34}
            height={size * 0.034}
            rx={3}
            fill="#10191F"
          />
          <Rect
            x={cx - size * 0.17}
            y={size * 0.86}
            width={size * 0.34}
            height={size * 0.034}
            rx={3}
            fill="#10191F"
          />
          <SvgText
            x={cx}
            y={size * 0.146}
            fill="#D4DDDA"
            fontSize={Math.max(6.5, size * 0.025)}
            fontWeight="700"
            textAnchor="middle"
            letterSpacing={1}
          >
            STRIKER END
          </SvgText>
          <SvgText
            x={cx}
            y={size * 0.886}
            fill="#D4DDDA"
            fontSize={Math.max(6.5, size * 0.025)}
            fontWeight="700"
            textAnchor="middle"
            letterSpacing={1}
          >
            BOWLER END
          </SvgText>

          <Circle cx={cx} cy={cy} r={groundR} fill="url(#field-outfield)" />
          {graphics !== 'low' ? (
            <G opacity={stadiumTheme === 'stadium_noir' ? 0.16 : 0.2}>
              <Circle cx={cx} cy={cy} r={groundR * 0.82} fill={palette.outfieldLight} />
              <Circle cx={cx} cy={cy} r={groundR * 0.64} fill={palette.outfield} />
              <Circle cx={cx} cy={cy} r={groundR * 0.46} fill={palette.outfieldLight} />
              <Circle cx={cx} cy={cy} r={groundR * 0.28} fill={palette.outfield} />
            </G>
          ) : null}
          {graphics === 'high' ? (
            <G fill={palette.rope} opacity={stadiumTheme === 'stadium_noir' ? 0.07 : 0.04}>
              {floodlights.map((light, index) => (
                <Path key={'floodlight-beam-' + index} d={light.beam} />
              ))}
            </G>
          ) : null}
          <Circle
            cx={cx}
            cy={cy}
            r={groundR}
            fill="none"
            stroke={colors.white}
            strokeWidth={3.8}
            opacity={0.8}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={groundR - 2.3}
            fill="none"
            stroke={palette.rope}
            strokeWidth={2.1}
          />
          <Circle
            cx={cx}
            cy={cy}
            r={innerR}
            fill="none"
            stroke={palette.ring}
            strokeWidth={1.25}
            strokeDasharray="5 5"
            opacity={0.9}
          />

          <Rect
            x={cx - pitchWidth / 2 + size * 0.008}
            y={pitchTop + size * 0.012}
            width={pitchWidth}
            height={pitchHeight}
            rx={3}
            fill="#020504"
            opacity={0.36}
          />
          <Rect
            x={cx - pitchWidth / 2}
            y={pitchTop}
            width={pitchWidth}
            height={pitchHeight}
            rx={2}
            fill="url(#field-pitch)"
            stroke="#E3C48C"
            strokeWidth={0.8}
            opacity={0.96}
          />
          {graphics !== 'low' ? (
            <G opacity={0.28}>
              <Line
                x1={cx - pitchWidth * 0.28}
                y1={pitchTop}
                x2={cx - pitchWidth * 0.28}
                y2={pitchTop + pitchHeight}
                stroke="#FFF0C4"
                strokeWidth={0.8}
              />
              <Line
                x1={cx + pitchWidth * 0.28}
                y1={pitchTop}
                x2={cx + pitchWidth * 0.28}
                y2={pitchTop + pitchHeight}
                stroke="#6F4E2C"
                strokeWidth={0.8}
              />
            </G>
          ) : null}
          {conditions?.pitch === 'CRACKED' ? (
            <G opacity={0.55}>
              <Path
                d={'M ' + (cx - 7) + ' ' + (cy - 18) + ' l 4 6 -3 7 5 8 -4 8'}
                fill="none"
                stroke="#5B3B25"
                strokeWidth={1}
              />
              <Path
                d={'M ' + (cx + 8) + ' ' + (cy + 6) + ' l -3 5 4 6 -3 7'}
                fill="none"
                stroke="#5B3B25"
                strokeWidth={0.9}
              />
            </G>
          ) : null}
          {conditions?.pitch === 'DUSTY' && graphics === 'high' ? (
            <G fill="#6E4D2F" opacity={0.32}>
              <Circle cx={cx - 7} cy={cy - 22} r={1.5} />
              <Circle cx={cx + 5} cy={cy + 19} r={1.2} />
              <Circle cx={cx - 3} cy={cy + 3} r={1} />
            </G>
          ) : null}
          <Line
            x1={cx - size * 0.09}
            y1={strikerStumpY}
            x2={cx + size * 0.09}
            y2={strikerStumpY}
            stroke={colors.white}
            strokeWidth={1.5}
            opacity={0.9}
          />
          <Line
            x1={cx - size * 0.09}
            y1={bowlerStumpY}
            x2={cx + size * 0.09}
            y2={bowlerStumpY}
            stroke={colors.white}
            strokeWidth={1.5}
            opacity={0.9}
          />
          <Stumps x={cx} y={strikerStumpY} direction={-1} size={size} color={colors.white} />
          <Stumps x={cx} y={bowlerStumpY} direction={1} size={size} color={colors.white} />

          {lastShot ? (
            <G>
              <Path
                d={deliveryPath}
                fill="none"
                stroke={colors.white}
                strokeWidth={1.35}
                strokeDasharray="3 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.34}
              />
              <Circle
                cx={bounce.x}
                cy={bounce.y}
                r={size * 0.012}
                fill="none"
                stroke={colors.white}
                strokeWidth={0.9}
                opacity={0.5}
              />
              <Circle
                cx={striker.x}
                cy={striker.y}
                r={size * 0.014}
                fill={ballColor}
                opacity={0.22}
              />
              {showShotPath ? (
                <Path
                  d={trajectory}
                  fill="none"
                  stroke={ballColor}
                  strokeWidth={lastShot.tone === 'six' ? 2.25 : 2.6}
                  strokeDasharray={lastShot.tone === 'six' ? '5 3' : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.72}
                />
              ) : null}
            </G>
          ) : null}

          {caught ? (
            <G>
              <Circle
                cx={fieldActionPoint.x}
                cy={fieldActionPoint.y}
                r={size * 0.035}
                fill={colors.danger}
                opacity={0.14}
              />
              <Circle
                cx={fieldActionPoint.x}
                cy={fieldActionPoint.y}
                r={size * 0.025}
                fill="none"
                stroke={colors.danger}
                strokeWidth={1.6}
              />
            </G>
          ) : null}
          {runOut ? (
            <Circle
              cx={nonStriker.x}
              cy={nonStriker.y}
              r={size * 0.032}
              fill="none"
              stroke={colors.danger}
              strokeWidth={2}
            />
          ) : null}
          {lastShot?.dismissalType === 'LBW' ? (
            <Circle
              cx={striker.x}
              cy={striker.y + size * 0.016}
              r={size * 0.03}
              fill={colors.danger}
              opacity={0.24}
            />
          ) : null}
          {wicketAtStriker ? (
            <G stroke={colors.danger} strokeWidth={1.8} strokeLinecap="round">
              <Line
                x1={cx - size * 0.014}
                y1={strikerStumpY - size * 0.032}
                x2={cx - size * 0.035}
                y2={strikerStumpY - size * 0.045}
              />
              <Line
                x1={cx + size * 0.014}
                y1={strikerStumpY - size * 0.032}
                x2={cx + size * 0.036}
                y2={strikerStumpY - size * 0.018}
              />
            </G>
          ) : null}

          <G>
            {userBatter && userBadgeLabel ? (
              <G>
                <Circle
                  cx={userBatter.x}
                  cy={userBatter.y}
                  r={size * 0.034}
                  fill="none"
                  stroke={colors.accentLight}
                  strokeWidth={2.1}
                />
                <Circle
                  cx={userBatter.x}
                  cy={userBatter.y}
                  r={size * 0.042}
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth={0.8}
                  opacity={0.6}
                />
                <Rect
                  x={userBadgeX}
                  y={userBadgeY}
                  width={userBadgeWidth}
                  height={userBadgeHeight}
                  rx={userBadgeHeight / 2}
                  fill="#10131E"
                  stroke={colors.accentLight}
                  strokeWidth={1.2}
                />
                <Circle
                  cx={userBadgeX + userBadgeHeight * 0.52}
                  cy={userBadgeY + userBadgeHeight / 2}
                  r={userBadgeHeight * 0.2}
                  fill={colors.accent}
                />
                <SvgText
                  x={userBadgeX + userBadgeWidth * 0.57}
                  y={userBadgeY + userBadgeHeight * 0.69}
                  fill={colors.white}
                  fontSize={Math.max(6.3, size * 0.024)}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {userBadgeLabel}
                </SvgText>
              </G>
            ) : null}
          </G>

          {conditions?.weather === 'OVERCAST' ? (
            <Circle cx={cx} cy={cy} r={groundR} fill="#C7D4DD" opacity={0.045} />
          ) : conditions?.weather === 'HUMID' ? (
            <Circle cx={cx} cy={cy} r={groundR} fill="#8BC9B3" opacity={0.035} />
          ) : null}
        </Svg>

        {majorEvent ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.stadiumPulse,
              {
                left: cx - groundR,
                top: cy - groundR,
                width: groundR * 2,
                height: groundR * 2,
                borderRadius: groundR,
                borderColor: eventPulseColor,
                opacity: stadiumPulseOpacity,
                transform: [{ scale: stadiumPulseScale }],
              },
            ]}
          />
        ) : null}

        {majorEvent ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.impactPulse,
                {
                  left: shotEnd.x - impactSize / 2,
                  top: shotEnd.y - impactSize / 2,
                  width: impactSize,
                  height: impactSize,
                  borderRadius: impactSize / 2,
                  borderColor: eventPulseColor,
                  opacity: impactPulseOpacity,
                  transform: [{ scale: impactPulseScale }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.impactCore,
                {
                  left: shotEnd.x - size * 0.014,
                  top: shotEnd.y - size * 0.014,
                  width: size * 0.028,
                  height: size * 0.028,
                  borderRadius: size * 0.014,
                  backgroundColor: eventPulseColor,
                  opacity: impactPulseOpacity,
                  transform: [{ scale: impactCoreScale }],
                },
              ]}
            />
          </>
        ) : null}

        {fielders.map((fielder, index) => {
          const reacting = reaction?.index === index;

          return (
            <CricketerSprite
              key={'fielder-' + index}
              x={fielder.x}
              y={fielder.y}
              rotation={faceCentreRotation(fielder.x, fielder.y, cx, cy)}
              scale={cricketerScale('fielder')}
              primary={fielderPrimary}
              secondary={fielderSecondary}
              role="fielder"
              fieldSize={size}
              style={
                reacting
                  ? {
                      transform: [
                        { translateX: fielderTranslateX },
                        { translateY: fielderTranslateY },
                        { scale: fielderScale },
                      ],
                    }
                  : undefined
              }
            />
          );
        })}
        <CricketerSprite
          x={keeper.x}
          y={keeper.y}
          rotation={180}
          scale={cricketerScale('keeper')}
          primary={fielderPrimary}
          secondary={fielderSecondary}
          role="keeper"
          fieldSize={size}
          style={{ transform: [{ translateY: keeperTranslateY }, { scale: keeperScale }] }}
        />
        <CricketerSprite
          x={bowler.x}
          kitId={userIsBowler ? userKitId : undefined}
          y={bowler.y}
          scale={cricketerScale('bowler')}
          primary={fielderPrimary}
          secondary={fielderSecondary}
          role="bowler"
          fieldSize={size}
          style={{ transform: [{ translateY: bowlerTranslateY }, { rotate: bowlerRotate }] }}
        />
        <CricketerSprite
          x={nonStriker.x}
          kitId={userBatterPosition === 'nonStriker' ? userKitId : undefined}
          y={nonStriker.y}
          scale={cricketerScale('batter')}
          primary={batterPrimary}
          secondary={batterSecondary}
          role="batter"
          fieldSize={size}
          style={{ transform: [{ translateX: nonStrikerRunX }, { translateY: nonStrikerRunY }] }}
        />
        <CricketerSprite
          x={striker.x}
          kitId={userBatterPosition === 'striker' ? userKitId : undefined}
          y={striker.y}
          rotation={180}
          scale={cricketerScale('batter')}
          primary={batterPrimary}
          secondary={batterSecondary}
          role="batter"
          fieldSize={size}
          style={{
            transform: [
              { translateX: strikerRunX },
              { translateY: strikerRunY },
              { rotate: batterRotate },
              { scale: batterScale },
            ],
          }}
        />

        {lastShot ? (
          <>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ballShadow,
                {
                  opacity: shadowOpacity,
                  transform: [{ translateX }, { translateY }, { scale: shadowScale }],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ball,
                {
                  backgroundColor: '#FAF1DA',
                  opacity: ballOpacity,
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
            >
              <View style={styles.ballSeam} />
            </Animated.View>
          </>
        ) : null}
      </View>
      <View style={[styles.broadcastCaption, { width: size, borderTopColor: colors.border }]}>
        <View
          style={[
            styles.resultMark,
            { backgroundColor: colors.bgElevated, borderColor: ballColor },
          ]}
        >
          <AppText
            style={[styles.resultNumber, { color: lastShot ? ballColor : colors.textMuted }]}
          >
            {caption.mark}
          </AppText>
        </View>
        <View style={styles.captionCopy}>
          <AppText style={[styles.captionTitle, { color: colors.text }]} numberOfLines={1}>
            {caption.title}
          </AppText>
          {caption.detail ? (
            <AppText style={[styles.captionDetail, { color: colors.textMuted }]} numberOfLines={1}>
              {caption.detail}
            </AppText>
          ) : null}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  broadcastCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  resultMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultNumber: { fontSize: 21, fontWeight: '800' },
  captionCopy: { flex: 1, minWidth: 0, gap: 2 },
  captionTitle: { fontSize: 13, fontWeight: '700' },
  captionDetail: { fontSize: 10, textTransform: 'capitalize' },
  ballSeam: {
    width: 3,
    height: 7,
    borderLeftWidth: 0.8,
    borderRightWidth: 0.8,
    borderColor: '#A33F3F',
    transform: [{ rotate: '-30deg' }],
    alignSelf: 'center',
  },
  cricketerSprite: {
    position: 'absolute',
  },
  stadiumPulse: {
    position: 'absolute',
    borderWidth: 3,
  },
  impactPulse: {
    position: 'absolute',
    borderWidth: 2.4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  impactCore: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  ballShadow: {
    position: 'absolute',
    width: 9,
    height: 5,
    borderRadius: 5,
    top: 5,
    left: 0.5,
    backgroundColor: '#000000',
  },
  ball: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    top: 0,
    left: 0,
    borderWidth: 1.35,
    borderColor: '#FFFFFF',
  },
});
