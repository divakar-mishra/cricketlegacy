import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { avatarFromSeed, normalizeAvatarConfig } from '../avatar';
import type { AvatarConfig } from '../avatar';
import { AppText } from './AppText';
import { PortraitAvatar } from './avatar';
import {
  AvatarSponsorBadges,
  PortraitSponsorPrint,
  type SponsorBrandRef,
} from './SponsorBranding';
import { largeAvatarBrandingLayout } from './sponsorAvatarLayout';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Record<AvatarSize, number> = { sm: 40, md: 64, lg: 96, xl: 128 };
const ROLE_ICON: Record<string, string> = {
  BATTER: 'BAT',
  BOWLER: 'BWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};

interface Props {
  kitId?: string;
  name: string;
  role?: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: AvatarSize;
  showRole?: boolean;
  legendary?: boolean;
  config?: Partial<AvatarConfig> | null;
  profileFrame?: string;
  earnedSponsor?: SponsorBrandRef;
  premiumSponsor?: SponsorBrandRef;
  testID?: string;
}

function PlayerAvatarComponent({
  kitId,
  name,
  role = 'BATTER',
  primaryColor = '#1A6B3A',
  secondaryColor = '#D5B56D',
  size = 'md',
  showRole = false,
  legendary = false,
  config,
  profileFrame,
  earnedSponsor,
  premiumSponsor,
  testID,
}: Props) {
  const px = SIZE_MAP[size];
  const safeConfig = useMemo(
    () => (config ? normalizeAvatarConfig(config) : avatarFromSeed(name, 'male', profileFrame)),
    [config, name, profileFrame],
  );
  const activeFrame = legendary ? 'frame_gold' : profileFrame;
  const largeLayout =
    px >= SIZE_MAP.lg
      ? largeAvatarBrandingLayout({
          avatarSize: px,
          hasEarned: Boolean(earnedSponsor),
          hasPremium: Boolean(premiumSponsor),
          showRole,
        })
      : undefined;

  return (
    <View style={[styles.wrap, { width: px, height: px }]}>
      <PortraitAvatar
        kitId={kitId}
        config={safeConfig}
        size={px}
        frameId={activeFrame}
        backgroundColor={`${primaryColor}33`}
        accessibilityLabel={`${name} player avatar`}
        testID={testID}
      />
      {largeLayout ? (
        <PortraitSponsorPrint
          earned={earnedSponsor}
          premium={premiumSponsor}
          layout={largeLayout}
        />
      ) : (
        <AvatarSponsorBadges
          earned={earnedSponsor}
          premium={premiumSponsor}
          avatarSize={px}
          reserveRoleSpace={showRole}
        />
      )}
      {showRole ? (
        <View
          style={[
            styles.roleBadge,
            largeLayout?.role
              ? {
                  left: largeLayout.role.x,
                  top: largeLayout.role.y,
                  width: largeLayout.role.width,
                  height: largeLayout.role.height,
                }
              : styles.roleBadgeCompact,
            { backgroundColor: secondaryColor },
          ]}
        >
          <AppText
            numberOfLines={1}
            style={[styles.roleText, { fontSize: Math.max(7, px * 0.1) }]}
          >
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
    zIndex: 5,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBadgeCompact: {
    right: 2,
    bottom: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  roleText: { color: '#090C08', fontWeight: '800', letterSpacing: 0 },
});
