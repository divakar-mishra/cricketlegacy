import { memo, useMemo } from 'react';
import { ProfileFrame } from './ProfileFrame';
import { Image, StyleSheet, View } from 'react-native';
import { normalizeAvatarConfig, portraitAssetSource } from '../../avatar';
import type { AvatarConfig } from '../../avatar';
import { layeredPortraitArtwork, LAYERED_PORTRAIT_LAYOUT } from '../../avatar/layeredPortraits';

interface PortraitAvatarProps {
  kitId?: string;
  config?: Partial<AvatarConfig> | null;
  size?: number;
  frameId?: string;
  accessibilityLabel?: string;
  testID?: string;
  backgroundColor?: string;
}

// Shared frame artwork is also used by cosmetic previews.

function PortraitAvatarComponent({
  kitId,
  config,
  size = 96,
  frameId,
  accessibilityLabel = 'Player avatar',
  testID,
  backgroundColor = '#101711',
}: PortraitAvatarProps) {
  const safeConfig = useMemo(() => normalizeAvatarConfig(config), [config]);
  const source = portraitAssetSource(safeConfig.portraitId);
  const artwork = layeredPortraitArtwork(safeConfig.portraitId, kitId);
  const layerStyle = {
    position: 'absolute' as const,
    width: size * LAYERED_PORTRAIT_LAYOUT.width,
    height: size * LAYERED_PORTRAIT_LAYOUT.height,
    left: size * LAYERED_PORTRAIT_LAYOUT.left,
    top: size * LAYERED_PORTRAIT_LAYOUT.top,
  };
  const activeFrame = frameId ?? safeConfig.frameId;
  const borderRadius = size / 2;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { width: size, height: size, borderRadius, backgroundColor }]}
      testID={testID}
    >
      {artwork ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="layered-player-portrait">
          <Image source={artwork.jersey} resizeMode="contain" style={layerStyle} testID="portrait-jersey-layer" accessibilityElementsHidden importantForAccessibility="no" />
          <Image source={artwork.head} resizeMode="contain" style={layerStyle} testID="portrait-head-layer" accessibilityElementsHidden importantForAccessibility="no" />
        </View>
      ) : source ? (
        <Image
          source={source}
          resizeMode="cover"
          style={styles.image}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : null}
      <ProfileFrame frameId={activeFrame} size={size} />
    </View>
  );
}

export const PortraitAvatar = memo(PortraitAvatarComponent);

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
