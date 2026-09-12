import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { canEquipReward, isRewardEquipped, rewardPresentation } from '../game/rewardPresentation';
import { useCareer } from '../state/careerStore';
import { useColors } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { RewardArtwork } from './RewardArtwork';
import { CelebrationOverlay } from './CelebrationOverlay';

export function RewardShowcase({
  itemIds,
  saveId,
  allowEquip = true,
}: {
  itemIds: string[];
  saveId: string;
  allowEquip?: boolean;
}) {
  const save = useCareer((s) => s.save);
  const equip = useCareer((s) => s.equipOwnedReward);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<{ id: string; trigger: number }>();
  const colors = useColors();
  if (!save || save.id !== saveId) return null;
  return (
    <View style={styles.list}>
      {[...new Set(itemIds)].map((id) => {
        const item = rewardPresentation(id);
        if (!item) return null;
        const owned = canEquipReward(save, id),
          equipped = isRewardEquipped(save, id);
        return (
          <View key={id} style={[styles.row, { borderColor: colors.border }]}>
            <RewardArtwork itemId={id} save={save} />
            <View style={styles.copy}>
              <AppText style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                {item.label}
              </AppText>
              <AppText style={{ color: colors.textMuted, fontSize: 11 }}>
                {item.kind === 'frame'
                  ? 'On your player profile and match portraits'
                  : item.kind === 'celebration'
                    ? 'During your player’s match highlights'
                    : item.kind === 'kit'
                      ? 'On your player profile and match portraits'
                      : item.kind === 'office' ? 'In your Club Office' : 'On the match ground'}
              </AppText>
              <View style={styles.actions}>
                {item.kind === 'celebration' ? (
                  <Button
                    label="Preview"
                    size="sm"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => setPreview({ id, trigger: 1 })}
                  />
                ) : null}
                {allowEquip && owned ? (
                  <Button
                    label={equipped ? 'Equipped' : 'Equip'}
                    size="sm"
                    fullWidth={false}
                    variant="secondary"
                    disabled={equipped}
                    onPress={() => {
                      const result = equip(id, saveId);
                      setError(
                        result.ok ? undefined : (result.reason ?? 'Unable to equip this reward.'),
                      );
                    }}
                  />
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
      {error ? (
        <AppText accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      {preview ? (
        <Modal
          transparent
          visible
          animationType="fade"
          onRequestClose={() => setPreview(undefined)}
        >
          <View style={styles.preview}>
            <AppText style={styles.previewTitle}>Celebration preview</AppText>
            <CelebrationOverlay kind="six" trigger={preview.trigger} cosmeticId={preview.id} />
            <View style={styles.previewActions}>
              <Button
                label="Replay"
                variant="secondary"
                onPress={() => setPreview({ ...preview, trigger: preview.trigger + 1 })}
              />
              <Button label="Done" onPress={() => setPreview(undefined)} />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preview: {
    flex: 1,
    backgroundColor: 'rgba(6,9,15,.96)',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  previewTitle: { color: '#EEE4CC', fontSize: 16, textAlign: 'center' },
  previewActions: { gap: 10 },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  copy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 5 },
});
