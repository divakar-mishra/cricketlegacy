import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { avatarFromLegacy, normalizeAvatarConfig } from '../avatar';
import type { AvatarConfig } from '../avatar';
import type { AvatarCustomization } from '../domain/types';
import { AppText } from './AppText';
import { LayeredAvatar } from './avatar';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

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
  config?: Partial<AvatarConfig> | null;
  /** Kept during schema-30 rollout so old saves always have a visual fallback. */
  customization?: AvatarCustomization;
  profileFrame?: string;
  testID?: string;
}

function PlayerAvatarComponent({
  name,
  role = 'BATTER',
  primaryColor = '#1A6B3A',
  secondaryColor = '#D5B56D',
  size = 'md',
  showRole = false,
  legendary = false,
  config,
  customization,
  profileFrame,
  testID,
}: Props) {
  const px = SIZE_MAP[size];
  const safeConfig = useMemo(
    () =>
      config
        ? normalizeAvatarConfig(config)
        : avatarFromLegacy(customization, undefined, profileFrame),
    [config, customization, profileFrame],
  );
  const activeFrame = legendary ? 'frame_gold' : profileFrame;

  return (
    <View style={[styles.wrap, { width: px, height: px }]}>
      <LayeredAvatar
        config={safeConfig}
        size={px}
        frameId={activeFrame}
        backgroundColor={`${primaryColor}33`}
        accessibilityLabel={`${name} player avatar`}
        testID={testID}
      />
      {showRole ? (
        <View style={[styles.roleBadge, { backgroundColor: secondaryColor }]}>
          <AppText style={[styles.roleText, { fontSize: Math.max(7, px * 0.1) }]}>
            {ROLE_ICON[role] ?? 'PLR'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

export const PlayerAvatar = memo(PlayerAvatarComponent);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  roleBadge: {
    position: 'absolute',
    bottom: 2,
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  roleText: { color: '#090C08', fontWeight: '800', letterSpacing: 0 },
});
