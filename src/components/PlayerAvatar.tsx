/**
 * Layered illustrated player avatar. The face is assembled from deterministic
 * SVG shapes so every saved choice works offline and remains consistent across
 * dashboards, profiles and match presentation.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { DEFAULT_AVATAR_CUSTOMIZATION } from '../data/avatar';
import { AvatarCustomization } from '../domain/types';
import { AppText } from './AppText';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<AvatarSize, number> = { sm: 40, md: 64, lg: 96, xl: 128 };
const ROLE_ICON: Record<string, string> = {
  BATTER: 'BAT',
  BOWLER: 'BWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};

interface Props {
  name: string;
  role?: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: AvatarSize;
  showRole?: boolean;
  legendary?: boolean;
  kitColor?: string;
  customization?: AvatarCustomization;
  profileFrame?: string;
}

function darken(hex: string, amount = 0.3): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 0xff) * (1 - amount))));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 0xff) * (1 - amount))));
  const b = Math.max(0, Math.min(255, Math.round((n & 0xff) * (1 - amount))));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function facePath(shape: AvatarCustomization['faceShape']): string {
  if (shape === 'round')
    return 'M50 17 C34 17 29 27 30 42 C31 57 39 64 50 65 C61 64 69 57 70 42 C71 27 66 17 50 17 Z';
  if (shape === 'angular')
    return 'M50 16 L66 21 L71 39 L65 56 L55 66 L45 66 L35 56 L29 39 L34 21 Z';
  return 'M50 16 C35 16 29 27 30 41 C31 56 40 66 50 67 C60 66 69 56 70 41 C71 27 65 16 50 16 Z';
}

function Hair({ style, color }: { style: AvatarCustomization['hairStyle']; color: string }) {
  if (style === 'bald') return null;
  if (style === 'crop') {
    return (
      <Path d="M31 29 C33 15 42 11 51 12 C62 12 68 19 69 29 C60 24 41 24 31 29 Z" fill={color} />
    );
  }
  if (style === 'swept') {
    return (
      <Path
        d="M30 31 C29 17 39 10 52 11 C63 11 70 18 69 29 C61 21 52 20 42 22 C48 17 56 15 62 16 C50 11 38 18 30 31 Z"
        fill={color}
      />
    );
  }
  if (style === 'fade') {
    return (
      <G>
        <Path d="M31 31 C32 17 39 12 51 12 C62 12 68 18 69 29 C59 24 41 24 31 31 Z" fill={color} />
        <Path d="M30 29 L33 42 M70 29 L67 42" stroke={color} strokeWidth="3" opacity="0.45" />
      </G>
    );
  }
  if (style === 'curly') {
    return (
      <G fill={color}>
        {[33, 40, 47, 54, 61, 67].map((cx, index) => (
          <Circle key={cx} cx={cx} cy={index % 2 === 0 ? 20 : 17} r="7" />
        ))}
        <Path d="M29 31 C30 22 36 17 43 17 L67 21 L70 31 C58 25 41 25 29 31 Z" />
      </G>
    );
  }
  return (
    <Path d="M30 31 C30 18 38 11 50 11 C63 11 70 19 70 31 C61 24 40 23 30 31 Z" fill={color} />
  );
}

function FacialHair({ config }: { config: AvatarCustomization }) {
  const color = config.hairColor;
  return (
    <G>
      {config.facialHair === 'stubble' && (
        <Path
          d="M35 52 C38 62 44 66 50 67 C57 66 63 62 66 52 C62 58 57 62 50 63 C43 62 39 58 35 52 Z"
          fill={color}
          opacity="0.22"
        />
      )}
      {config.facialHair === 'short_beard' && (
        <Path
          d="M34 51 C36 62 42 69 50 71 C59 69 65 62 67 51 L63 55 C60 63 56 66 50 67 C44 66 40 63 37 55 Z"
          fill={color}
          opacity="0.8"
        />
      )}
      {config.facialHair === 'full_beard' && (
        <Path
          d="M32 49 C33 63 39 72 50 76 C61 72 67 63 68 49 C64 57 60 65 50 69 C40 65 36 57 32 49 Z"
          fill={color}
        />
      )}
      {config.moustache === 'classic' && (
        <Path
          d="M40 49 C44 46 48 47 50 50 C52 47 57 46 61 49 C57 53 53 53 50 51 C47 53 43 53 40 49 Z"
          fill={color}
        />
      )}
      {config.moustache === 'handlebar' && (
        <Path
          d="M37 49 C43 44 48 46 50 49 C52 46 58 44 64 49 C61 48 61 53 66 52 C61 57 54 53 50 51 C46 53 39 57 34 52 C39 53 40 48 37 49 Z"
          fill={color}
        />
      )}
    </G>
  );
}

export function PlayerAvatar({
  name,
  role = 'BATTER',
  primaryColor = '#1A6B3A',
  secondaryColor = '#D5B56D',
  size = 'md',
  showRole = false,
  legendary = false,
  kitColor,
  customization,
  profileFrame,
}: Props) {
  const px = SIZE_MAP[size];
  const config = { ...DEFAULT_AVATAR_CUSTOMIZATION, ...(customization ?? {}) };
  const kit = kitColor ?? primaryColor;
  const outline = darken(config.skinTone, 0.42);
  const browWidth = config.browStyle === 'bold' ? 2.5 : config.browStyle === 'soft' ? 1.4 : 2;
  const premiumFrame = profileFrame === 'frame_gold' || profileFrame === 'pass_frame_gold';

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name} illustrated player avatar`}
      style={[styles.wrap, { width: px, height: px }]}
    >
      <Svg width={px} height={px} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="49" fill="#0B100D" />
        <Circle cx="50" cy="50" r="47" fill={darken(kit, 0.58)} />

        <Path d="M15 100 C18 76 29 67 42 64 L58 64 C71 67 82 76 85 100 Z" fill={kit} />
        <Path d="M38 65 L50 78 L62 65 L57 62 L43 62 Z" fill={secondaryColor} opacity="0.95" />
        <Rect
          x="46"
          y="58"
          width="8"
          height="12"
          rx="4"
          fill={config.skinTone}
          stroke={outline}
          strokeWidth="0.7"
        />

        <Ellipse
          cx="29"
          cy="41"
          rx="4"
          ry="7"
          fill={config.skinTone}
          stroke={outline}
          strokeWidth="1"
        />
        <Ellipse
          cx="71"
          cy="41"
          rx="4"
          ry="7"
          fill={config.skinTone}
          stroke={outline}
          strokeWidth="1"
        />
        <Path
          d={facePath(config.faceShape)}
          fill={config.skinTone}
          stroke={outline}
          strokeWidth="1.4"
        />
        <Hair style={config.hairStyle} color={config.hairColor} />

        <Path
          d="M37 35 Q42 32 46 35"
          fill="none"
          stroke={config.hairColor}
          strokeWidth={browWidth}
          strokeLinecap="round"
        />
        <Path
          d="M54 35 Q59 32 64 35"
          fill="none"
          stroke={config.hairColor}
          strokeWidth={browWidth}
          strokeLinecap="round"
        />
        <Ellipse cx="42" cy="40" rx="3.5" ry="2.4" fill="#F8F5EE" />
        <Ellipse cx="58" cy="40" rx="3.5" ry="2.4" fill="#F8F5EE" />
        <Circle cx="42" cy="40" r="2" fill={config.eyeColor} stroke="#151515" strokeWidth="0.35" />
        <Circle cx="58" cy="40" r="2" fill={config.eyeColor} stroke="#151515" strokeWidth="0.35" />
        <Circle cx="42" cy="40" r="0.7" fill="#101010" />
        <Circle cx="58" cy="40" r="0.7" fill="#101010" />
        <Circle cx="42.6" cy="39.35" r="0.4" fill="#FFFFFF" />
        <Circle cx="58.6" cy="39.35" r="0.4" fill="#FFFFFF" />
        <Path
          d="M50 41 L47.5 48 Q50 50 53 48"
          fill="none"
          stroke={outline}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <Path
          d="M44 55 Q50 58 56 55"
          fill="none"
          stroke="#7A382F"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <FacialHair config={config} />

        <Path d="M17 88 H83" stroke={secondaryColor} strokeWidth="3" opacity="0.7" />
        {(legendary || premiumFrame) && (
          <G>
            <Circle cx="50" cy="50" r="47.5" fill="none" stroke="#D5B56D" strokeWidth="2.5" />
            <Circle
              cx="50"
              cy="50"
              r="43.5"
              fill="none"
              stroke="#B9F23D"
              strokeWidth="0.8"
              strokeDasharray="2 4"
            />
          </G>
        )}
      </Svg>

      {showRole && (
        <View style={[styles.roleBadge, { backgroundColor: secondaryColor }]}>
          <AppText style={[styles.roleText, { fontSize: px * 0.1 }]}>
            {ROLE_ICON[role] ?? 'PLR'}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  roleBadge: {
    position: 'absolute',
    bottom: 2,
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  roleText: { color: '#090C08', fontWeight: '800', letterSpacing: 0.5 },
});
