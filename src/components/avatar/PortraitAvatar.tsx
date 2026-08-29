import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { normalizeAvatarConfig, portraitAssetSource } from '../../avatar';
import type { AvatarConfig } from '../../avatar';

interface PortraitAvatarProps {
  config?: Partial<AvatarConfig> | null;
  size?: number;
  frameId?: string;
  accessibilityLabel?: string;
  testID?: string;
  backgroundColor?: string;
}

const FRAME_PALETTES = {
  normal: {
    main: '#24D63B',
    highlight: '#A4FF8A',
    bevel: '#087529',
  },
  championship: {
    main: '#E8B52F',
    highlight: '#FFF19A',
    bevel: '#765008',
  },
} as const;

function ProfileFrame({ frameId, size }: { frameId?: string; size: number }) {
  const palette = frameId === 'frame_gold' ? FRAME_PALETTES.championship : FRAME_PALETTES.normal;
  const radius = size / 2;
  const ringWidth = Math.max(3, Math.round(size * 0.07));
  const highlightInset = Math.max(1, Math.round(size * 0.012));
  const highlightWidth = Math.max(1, Math.round(size * 0.012));
  const bevelInset = Math.max(2, ringWidth - Math.max(1, Math.round(size * 0.01)));
  const bevelWidth = Math.max(1, Math.round(size * 0.018));

  return (
    <View pointerEvents="none" style={styles.frameOverlay}>
      <View
        style={[
          styles.frameRing,
          {
            borderColor: palette.main,
            borderRadius: radius,
            borderWidth: ringWidth,
          },
        ]}
      />
      <View
        style={[
          styles.frameRing,
          {
            borderColor: palette.highlight,
            borderRadius: radius - highlightInset,
            borderWidth: highlightWidth,
            bottom: highlightInset,
            left: highlightInset,
            right: highlightInset,
            top: highlightInset,
          },
        ]}
      />
      <View
        style={[
          styles.frameRing,
          {
            borderColor: palette.bevel,
            borderRadius: radius - bevelInset,
            borderWidth: bevelWidth,
            bottom: bevelInset,
            left: bevelInset,
            right: bevelInset,
            top: bevelInset,
          },
        ]}
      />
    </View>
  );
}

function PortraitAvatarComponent({
  config,
  size = 96,
  frameId,
  accessibilityLabel = 'Player avatar',
  testID,
  backgroundColor = '#101711',
}: PortraitAvatarProps) {
  const safeConfig = useMemo(() => normalizeAvatarConfig(config), [config]);
  const source = portraitAssetSource(safeConfig.portraitId);
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
      {source ? (
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
  frameOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  frameRing: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
