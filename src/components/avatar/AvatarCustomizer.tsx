import { FlashList } from '@shopify/flash-list';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  avatarFromPreset,
  avatarOptionLabel,
  avatarOptions,
  avatarPresetsForSex,
  DEFAULT_AVATAR_CONFIGS,
  normalizeAvatarConfig,
  randomAvatarConfig,
  selectAvatarAsset,
  switchAvatarRig,
  switchAvatarSex,
} from '../../avatar';
import type {
  AvatarAssetMetadata,
  AvatarConfig,
  AvatarLayerRole,
  AvatarPreset,
  AvatarRigId,
  AvatarSex,
} from '../../avatar';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../../theme';
import { AppText as Text } from '../AppText';
import { Button } from '../Button';
import { LayeredAvatar } from './LayeredAvatar';

type CustomizerTab =
  | 'presets'
  | 'face'
  | 'hair'
  | 'beard'
  | 'moustache'
  | 'eyes'
  | 'headwear'
  | 'outfit';

interface AvatarCustomizerProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  playerName?: string;
  showOutfits?: boolean;
  testID?: string;
}

const TAB_LABELS: Record<CustomizerTab, string> = {
  presets: 'Presets',
  face: 'Face',
  hair: 'Hair',
  beard: 'Beard',
  moustache: 'Moustache',
  eyes: 'Eyes',
  headwear: 'Headwear',
  outfit: 'Kit',
};

const RIG_LABELS: Record<AvatarRigId, string> = {
  narrow: 'Narrow',
  medium: 'Medium',
  wide: 'Wide',
};

function configKey(config: AvatarConfig): string {
  return [
    config.sex,
    config.rigId,
    config.baseFaceId,
    config.eyeColorId,
    config.hairBackId,
    config.hairFrontId,
    config.beardId,
    config.moustacheId,
    config.headwearId,
    config.outfitId,
  ].join('|');
}

const PresetCard = memo(function PresetCard({
  preset,
  selected,
  onPress,
}: {
  preset: AvatarPreset;
  selected: boolean;
  onPress: (preset: AvatarPreset) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Avatar ${preset.id.replace('preset_', 'preset ')}`}
      accessibilityState={{ selected }}
      onPress={() => onPress(preset)}
      style={[styles.presetCard, selected && styles.selectedCard]}
    >
      <LayeredAvatar config={preset} size={76} accessibilityLabel="Avatar preset preview" />
      <Text style={[styles.optionLabel, selected && styles.selectedText]}>
        {preset.id.slice(-3)}
      </Text>
    </Pressable>
  );
});

function OptionGrid({
  options,
  value,
  selectedId,
  onSelect,
}: {
  options: readonly AvatarAssetMetadata[];
  value: AvatarConfig;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.optionGrid}>
      {options.map((option) => {
        const selected = option.id === selectedId;
        const preview = selectAvatarAsset(value, option.id);
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={avatarOptionLabel(option.id)}
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.id)}
            style={[styles.optionCard, selected && styles.selectedCard]}
          >
            <LayeredAvatar config={preview} size={72} accessibilityLabel="Avatar option preview" />
            <Text
              numberOfLines={2}
              style={[styles.optionLabel, selected && styles.selectedText]}
            >
              {avatarOptionLabel(option.id)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AvatarCustomizer({
  value,
  onChange,
  playerName = 'Your player',
  showOutfits = true,
  testID,
}: AvatarCustomizerProps) {
  const styles = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const safeValue = useMemo(() => normalizeAvatarConfig(value), [value]);
  const [tab, setTab] = useState<CustomizerTab>('presets');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const columns = width >= 900 ? 6 : width >= 700 ? 5 : width >= 480 ? 4 : 3;
  const presetListHeight = height <= 700 ? 320 : width >= 700 ? 500 : 410;
  const presets = useMemo(() => avatarPresetsForSex(safeValue.sex), [safeValue.sex]);
  const tabs = useMemo<CustomizerTab[]>(
    () => [
      'presets',
      'face',
      'hair',
      ...(safeValue.sex === 'male' ? (['beard', 'moustache'] as const) : []),
      'eyes',
      'headwear',
      ...(showOutfits ? (['outfit'] as const) : []),
    ],
    [safeValue.sex, showOutfits],
  );

  const commit = useCallback(
    (next: AvatarConfig, presetId: string | null = null) => {
      setSelectedPresetId(presetId);
      onChange(normalizeAvatarConfig(next));
    },
    [onChange],
  );

  const selectPreset = useCallback(
    (preset: AvatarPreset) => {
      commit(avatarFromPreset(preset, safeValue.frameId), preset.id);
    },
    [commit, safeValue.frameId],
  );

  const selectAsset = useCallback(
    (id: string) => commit(selectAvatarAsset(safeValue, id)),
    [commit, safeValue],
  );

  const selectedIdForTab = (): string => {
    if (tab === 'face') return safeValue.baseFaceId;
    if (tab === 'hair') return safeValue.hairFrontId;
    if (tab === 'beard') return safeValue.beardId;
    if (tab === 'moustache') return safeValue.moustacheId;
    if (tab === 'eyes') return safeValue.eyeColorId;
    if (tab === 'headwear') return safeValue.headwearId;
    return safeValue.outfitId;
  };

  const layerForTab = (): AvatarLayerRole => {
    if (tab === 'face') return 'base';
    if (tab === 'hair') return 'hairFront';
    if (tab === 'beard') return 'beard';
    if (tab === 'moustache') return 'moustache';
    if (tab === 'eyes') return 'eyes';
    if (tab === 'headwear') return 'headwear';
    return 'outfit';
  };

  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.sexRow} accessibilityRole="tablist">
        {(['male', 'female'] as const).map((sex: AvatarSex) => {
          const selected = safeValue.sex === sex;
          return (
            <Pressable
              key={sex}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${sex} avatar`}
              onPress={() => {
                setTab('presets');
                commit(switchAvatarSex(safeValue, sex));
              }}
              style={[styles.sexButton, selected && styles.sexButtonSelected]}
            >
              <Text style={[styles.sexText, selected && styles.sexTextSelected]}>
                {sex === 'male' ? 'Male' : 'Female'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.previewSurface}>
        <LayeredAvatar
          config={safeValue}
          size={width < 380 ? 144 : 168}
          accessibilityLabel={`${playerName} avatar preview`}
          testID={testID ? `${testID}-preview` : undefined}
        />
        <View style={styles.previewActions}>
          <Text style={styles.previewName} numberOfLines={1}>
            {playerName}
          </Text>
          <Text style={styles.previewMeta}>
            {RIG_LABELS[safeValue.rigId]} face | {safeValue.sex === 'male' ? 'Male' : 'Female'}
          </Text>
          <View style={styles.actionRow}>
            <Button
              label="Randomize"
              variant="secondary"
              fullWidth={false}
              style={styles.actionButton}
              onPress={() => commit(randomAvatarConfig(safeValue.sex, Math.random, safeValue.frameId))}
            />
            <Button
              label="Reset"
              variant="ghost"
              fullWidth={false}
              style={styles.actionButton}
              onPress={() =>
                commit({ ...DEFAULT_AVATAR_CONFIGS[safeValue.sex], frameId: safeValue.frameId })
              }
            />
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {tabs.map((item) => {
          const selected = tab === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(item)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                {TAB_LABELS[item]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'face' ? (
        <View style={styles.rigSection}>
          <Text style={styles.sectionLabel}>Face width</Text>
          <View style={styles.rigRow}>
            {(['narrow', 'medium', 'wide'] as const).map((rigId) => {
              const selected = safeValue.rigId === rigId;
              return (
                <Pressable
                  key={rigId}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => commit(switchAvatarRig(safeValue, rigId))}
                  style={[styles.rigButton, selected && styles.rigButtonSelected]}
                >
                  <Text style={[styles.rigText, selected && styles.selectedText]}>
                    {RIG_LABELS[rigId]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {tab === 'presets' ? (
        <View style={[styles.presetList, { height: presetListHeight }]}>
          <FlashList
            key={`${safeValue.sex}-${columns}`}
            data={presets}
            numColumns={columns}
            nestedScrollEnabled
            keyExtractor={(item) => item.id}
            extraData={selectedPresetId}
            renderItem={({ item }) => (
              <PresetCard
                preset={item}
                selected={selectedPresetId === item.id || configKey(item) === configKey(safeValue)}
                onPress={selectPreset}
              />
            )}
          />
        </View>
      ) : (
        <OptionGrid
          options={avatarOptions(layerForTab(), safeValue.sex, safeValue.rigId)}
          value={safeValue}
          selectedId={selectedIdForTab()}
          onSelect={selectAsset}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      marginTop: spacing.lg,
      overflow: 'hidden',
    },
    sexRow: { flexDirection: 'row', borderBottomColor: colors.border, borderBottomWidth: 1 },
    sexButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      flex: 1,
      minHeight: 44,
      justifyContent: 'center',
    },
    sexButtonSelected: { backgroundColor: colors.primaryDark },
    sexText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    sexTextSelected: { color: colors.white },
    previewSurface: {
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.lg,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    previewActions: { flex: 1, minWidth: 150, maxWidth: 300 },
    previewName: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    previewMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 3 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    actionButton: { minWidth: 104 },
    tabRow: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: spacing.sm,
    },
    tab: {
      borderBottomColor: 'transparent',
      borderBottomWidth: 2,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    tabSelected: { borderBottomColor: colors.accent },
    tabText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    tabTextSelected: { color: colors.accent },
    presetList: { backgroundColor: colors.bg, paddingTop: spacing.sm },
    presetCard: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flex: 1,
      margin: 4,
      minHeight: 112,
      padding: spacing.xs,
    },
    optionGrid: {
      backgroundColor: colors.bg,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      padding: spacing.md,
    },
    optionCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      minHeight: 112,
      padding: spacing.sm,
      width: 104,
    },
    selectedCard: { backgroundColor: colors.surfaceAlt, borderColor: colors.accent, borderWidth: 2 },
    optionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      lineHeight: 15,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    selectedText: { color: colors.accent },
    rigSection: { backgroundColor: colors.surface, padding: spacing.md },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
    },
    rigRow: { flexDirection: 'row', gap: spacing.sm },
    rigButton: {
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flex: 1,
      minHeight: 40,
      justifyContent: 'center',
    },
    rigButtonSelected: { borderColor: colors.accent },
    rigText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  });
