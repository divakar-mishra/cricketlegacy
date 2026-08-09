import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  avatarAssetMetadata,
  avatarFromPreset,
  avatarOptionLabel,
  avatarPresetsForSex,
  DEFAULT_AVATAR_CONFIGS,
  normalizeAvatarConfig,
  randomAvatarConfig,
  selectAvatarAsset,
  switchAvatarRig,
  switchAvatarSex,
} from '../avatar';
import type { AvatarAssetMetadata, AvatarConfig, AvatarRigId, AvatarSex } from '../avatar';
import { AppText as Text, Button, LayeredAvatar, Screen, ScreenHeader } from '../components';
import type { ScreenProps } from '../navigation';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

type QACategory =
  | 'base'
  | 'hair'
  | 'eyes'
  | 'beards'
  | 'moustaches'
  | 'headwear'
  | 'outfits'
  | 'presets';

const CATEGORIES: readonly QACategory[] = [
  'base',
  'hair',
  'eyes',
  'beards',
  'moustaches',
  'headwear',
  'outfits',
  'presets',
];

const qaAssets: readonly AvatarAssetMetadata[] = avatarAssetMetadata;

interface QAItem {
  id: string;
  config: AvatarConfig;
}

export function AvatarQAScreen({ navigation }: ScreenProps<'AvatarQA'>) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const [config, setConfig] = useState<AvatarConfig>({ ...DEFAULT_AVATAR_CONFIGS.male });
  const [category, setCategory] = useState<QACategory>('base');
  const [lightBackground, setLightBackground] = useState(false);
  const [headwearOn, setHeadwearOn] = useState(false);
  const columns = width >= 900 ? 6 : width >= 650 ? 5 : width >= 430 ? 4 : 3;
  const previewBackground = lightBackground ? '#EEF2EE' : '#101711';

  const items = useMemo<QAItem[]>(() => {
    if (category === 'presets') {
      return avatarPresetsForSex(config.sex)
        .slice(0, 30)
        .map((preset) => ({ id: preset.id, config: avatarFromPreset(preset) }));
    }
    return qaAssets
      .filter((asset) => {
        if (asset.category !== category) return false;
        if (asset.sex && asset.sex !== config.sex) return false;
        if (asset.rig && asset.rig !== config.rigId) return false;
        if (asset.category === 'hair' && asset.layer !== 'hairFront') return false;
        return true;
      })
      .map((asset) => ({ id: asset.id, config: selectAvatarAsset(config, asset.id) }));
  }, [category, config]);

  const setSex = (sex: AvatarSex) => {
    setConfig((current) => switchAvatarSex(current, sex));
    if (sex === 'female' && (category === 'beards' || category === 'moustaches')) {
      setCategory('hair');
    }
  };

  const setRig = (rigId: AvatarRigId) => setConfig((current) => switchAvatarRig(current, rigId));

  const setHeadwear = (enabled: boolean) => {
    setHeadwearOn(enabled);
    setConfig((current) =>
      normalizeAvatarConfig({
        ...current,
        headwearId: enabled ? `headwear_${current.rigId}_batting_helmet` : 'headwear_none',
      }),
    );
  };

  return (
    <Screen contentStyle={styles.screen}>
      <ScreenHeader title="Avatar QA" subtitle="Development only" onBack={() => navigation.goBack()} />

      <View style={styles.previewRow}>
        {[40, 96, 160].map((size) => (
          <LayeredAvatar
            key={size}
            config={config}
            size={size}
            backgroundColor={previewBackground}
            accessibilityLabel={`${size}px QA avatar`}
          />
        ))}
      </View>

      <View style={styles.controlRows}>
        <ChoiceGroup
          options={['male', 'female']}
          selected={config.sex}
          onSelect={(value) => setSex(value as AvatarSex)}
        />
        <ChoiceGroup
          options={['narrow', 'medium', 'wide']}
          selected={config.rigId}
          onSelect={(value) => setRig(value as AvatarRigId)}
        />
        <View style={styles.actions}>
          <Button
            label={headwearOn ? 'Helmet off' : 'Helmet on'}
            variant="secondary"
            fullWidth={false}
            onPress={() => setHeadwear(!headwearOn)}
          />
          <Button
            label={lightBackground ? 'Dark canvas' : 'Light canvas'}
            variant="secondary"
            fullWidth={false}
            onPress={() => setLightBackground((current) => !current)}
          />
          <Button
            label="Random"
            variant="ghost"
            fullWidth={false}
            onPress={() => setConfig(randomAvatarConfig(config.sex))}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        <View style={styles.categoryRow}>
          {CATEGORIES.filter(
            (item) => config.sex === 'male' || (item !== 'beards' && item !== 'moustaches'),
          ).map((item) => {
            const selected = item === category;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setCategory(item)}
                style={[styles.category, selected && styles.categorySelected]}
              >
                <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.list}>
        <FlashList
          key={`${category}-${config.sex}-${config.rigId}-${columns}`}
          data={items}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.item}
              onPress={() => setConfig(item.config)}
              accessibilityRole="button"
              accessibilityLabel={avatarOptionLabel(item.id)}
            >
              <LayeredAvatar
                config={item.config}
                size={72}
                backgroundColor={previewBackground}
                accessibilityLabel="QA layer composition"
              />
              <Text style={styles.itemLabel} numberOfLines={2}>
                {avatarOptionLabel(item.id)}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Screen>
  );
}

function ChoiceGroup({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.choiceGroup}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option)}
            style={[styles.choice, active && styles.choiceSelected]}
          >
            <Text style={[styles.choiceText, active && styles.choiceTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { minHeight: 0 },
    previewRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      justifyContent: 'center',
    },
    controlRows: { gap: spacing.sm, marginTop: spacing.md },
    choiceGroup: { flexDirection: 'row', gap: spacing.sm },
    choice: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: 38,
    },
    choiceSelected: { borderColor: colors.accent },
    choiceText: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'capitalize' },
    choiceTextSelected: { color: colors.accent, fontWeight: fontWeight.bold },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    categoryScroll: { flexGrow: 0, marginTop: spacing.md },
    categoryRow: { flexDirection: 'row' },
    category: {
      borderBottomColor: 'transparent',
      borderBottomWidth: 2,
      minHeight: 42,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    categorySelected: { borderBottomColor: colors.accent },
    categoryText: { color: colors.textMuted, fontSize: fontSize.xs, textTransform: 'capitalize' },
    categoryTextSelected: { color: colors.accent, fontWeight: fontWeight.bold },
    list: { flex: 1, minHeight: 160, marginTop: spacing.sm },
    item: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flex: 1,
      margin: 4,
      minHeight: 112,
      padding: spacing.xs,
    },
    itemLabel: {
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 13,
      marginTop: 4,
      textAlign: 'center',
    },
  });
