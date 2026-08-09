import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { avatarAssetSource, normalizeAvatarConfig, resolveAvatarLayers } from '../../avatar';
import type { AvatarConfig } from '../../avatar';

interface LayeredAvatarProps {
  config?: Partial<AvatarConfig> | null;
  size?: number;
  frameId?: string;
  accessibilityLabel?: string;
  testID?: string;
  backgroundColor?: string;
}

const EMPTY_LAYER_IDS = new Set([
  'empty_back',
  'empty_front',
  'beard_none',
  'moustache_none',
  'headwear_none',
]);

function AvatarImage({ id, testID }: { id: string | undefined; testID?: string }) {
  if (!id || EMPTY_LAYER_IDS.has(id)) return null;
  const source = avatarAssetSource(id);
  if (!source) return null;
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={[StyleSheet.absoluteFill, styles.layer]}
      testID={testID}
    />
  );
}

function ProfileFrame({ frameId, size }: { frameId?: string; size: number }) {
  if (!frameId || frameId === 'frame_none') return null;
  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
    >
      <Circle cx="50" cy="50" r="47" fill="none" stroke="#D5B56D" strokeWidth="2.4" />
      <Circle
        cx="50"
        cy="50"
        r="43.5"
        fill="none"
        stroke="#B9F23D"
        strokeWidth="0.8"
        strokeDasharray="2 4"
      />
    </Svg>
  );
}

function LayeredAvatarComponent({
  config,
  size = 96,
  frameId,
  accessibilityLabel = 'Player avatar',
  testID,
  backgroundColor = '#101711',
}: LayeredAvatarProps) {
  const safeConfig = useMemo(() => normalizeAvatarConfig(config), [config]);
  const layers = useMemo(() => resolveAvatarLayers(safeConfig), [safeConfig]);
  const activeFrame = frameId ?? safeConfig.frameId;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { width: size, height: size, backgroundColor }]}
      testID={testID}
    >
      <AvatarImage id={layers.hairBack} testID={testID ? `${testID}-hair-back` : undefined} />
      <AvatarImage id={layers.outfit} testID={testID ? `${testID}-outfit` : undefined} />
      <AvatarImage id={layers.base} testID={testID ? `${testID}-base` : undefined} />
      <AvatarImage id={layers.eyes} testID={testID ? `${testID}-eyes` : undefined} />
      <AvatarImage id={layers.hairFront} testID={testID ? `${testID}-hair-front` : undefined} />
      <AvatarImage id={layers.beard} testID={testID ? `${testID}-beard` : undefined} />
      <AvatarImage id={layers.moustache} testID={testID ? `${testID}-moustache` : undefined} />
      <AvatarImage id={layers.headwear} testID={testID ? `${testID}-headwear` : undefined} />
      <ProfileFrame frameId={activeFrame} size={size} />
    </View>
  );
}

export const LayeredAvatar = memo(LayeredAvatarComponent);

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  layer: {
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
});
