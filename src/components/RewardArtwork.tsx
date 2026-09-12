import { ImageBackground, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SaveGame } from '../domain/types';
import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import { rewardPresentation } from '../game/rewardPresentation';
import { celebrationAppearance } from './celebrationPresentation';
import { KitThumbnail } from './KitDesign';
import { PortraitAvatar } from './avatar/PortraitAvatar';

/** Uses the same artwork/equipped identity as the destination, not a gift placeholder. */
export function RewardArtwork({
  itemId,
  save,
  size = 72,
}: {
  itemId: string;
  save?: SaveGame;
  size?: number;
}) {
  const item = rewardPresentation(itemId);
  if (!item) return null;
  const celebration = celebrationAppearance(itemId);
  const accent =
    celebration?.color ??
    MONTHLY_PASS_CONTENT.find((c) => c.office.inventoryId === itemId)?.office.accent ??
    '#D5B56D';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={item.label}
      testID={`reward-artwork-${itemId}`}
      style={[styles.art, { width: size, height: size }]}
    >
      {item.kind === 'kit' ? (
        <KitThumbnail kitId={itemId} />
      ) : item.kind === 'frame' ? (
        <PortraitAvatar
          config={save?.cosmetics?.avatarConfig}
          kitId={save?.cosmetics?.kit}
          frameId={item.equippedId}
          size={size - 8}
        />
      ) : item.kind === 'celebration' && celebration ? (
        <View style={[styles.motif, { borderColor: `${accent}66` }]}>
          <Ionicons
            name={celebration.icon as keyof typeof Ionicons.glyphMap}
            size={size * 0.42}
            color={accent}
          />
          <View style={[styles.spark, { backgroundColor: accent, left: 4, top: 4 }]} />
          <View style={[styles.spark, { backgroundColor: accent, right: 2, bottom: 4 }]} />
        </View>
      ) : (
        <ImageBackground
          source={
            item.kind === 'office'
              ? require('../../assets/generated/season-pass-manager-office.png')
              : require('../../assets/generated/season-pass-stadium-noir.png')
          }
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {item.kind === 'office' ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: `${accent}55` }]} />
          ) : null}
        </ImageBackground>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  art: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#101722',
  },
  motif: {
    width: '80%',
    height: '80%',
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: { width: 4, height: 4, position: 'absolute', transform: [{ rotate: '45deg' }] },
});
