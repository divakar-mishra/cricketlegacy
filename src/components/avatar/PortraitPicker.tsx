import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  AVATAR_TONE_BANDS,
  DEFAULT_AVATAR_CONFIGS,
  normalizeAvatarConfig,
  portraitOptionLabel,
  portraitsForTone,
  portraitToneBand,
  randomAvatarConfig,
  selectPortrait,
  switchAvatarSex,
} from '../../avatar';
import type { AvatarConfig, AvatarSex, AvatarToneBand, PortraitAssetMetadata } from '../../avatar';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../../theme';
import { AppText as Text } from '../AppText';
import { Button } from '../Button';
import { PortraitAvatar } from './PortraitAvatar';
import { portraitPickerLayout } from './portraitPickerLayout';

interface PortraitPickerProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  playerName?: string;
  testID?: string;
}

const TONE_SWATCHES: Readonly<Record<AvatarToneBand, string>> = {
  1: '#F4D7C4',
  2: '#EBC3A6',
  3: '#DDA984',
  4: '#C98A64',
  5: '#AD6F50',
  6: '#8D553D',
  7: '#6D402F',
  8: '#492A21',
};

const GRID_GAP = spacing.sm;
const GRID_PADDING = spacing.sm;

const PortraitCard = memo(function PortraitCard({
  portrait,
  selected,
  size,
  cardWidth,
  onPress,
}: {
  portrait: PortraitAssetMetadata;
  selected: boolean;
  size: number;
  cardWidth: number;
  onPress: (portraitId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const label = portraitOptionLabel(portrait);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onPress(portrait.id)}
      style={[
        styles.portraitCard,
        { flexBasis: cardWidth, maxWidth: cardWidth },
        selected && styles.portraitCardSelected,
      ]}
    >
      <PortraitAvatar
        config={{ sex: portrait.sex, portraitId: portrait.id }}
        size={size}
        accessibilityLabel={`${label} preview`}
      />
    </Pressable>
  );
});

export function PortraitPicker({
  value,
  onChange,
  playerName = 'Your player',
  testID,
}: PortraitPickerProps) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const layout = useMemo(() => portraitPickerLayout(width), [width]);
  const safeValue = useMemo(() => normalizeAvatarConfig(value), [value]);
  const [selectedTone, setSelectedTone] = useState<AvatarToneBand>(() =>
    portraitToneBand(safeValue),
  );
  const options = useMemo(
    () => portraitsForTone(safeValue.sex, selectedTone),
    [safeValue.sex, selectedTone],
  );
  useEffect(() => {
    setSelectedTone(portraitToneBand(safeValue));
  }, [safeValue]);

  const commit = useCallback(
    (next: AvatarConfig) => onChange(normalizeAvatarConfig(next)),
    [onChange],
  );

  const choosePortrait = useCallback(
    (portraitId: string) => commit(selectPortrait(safeValue, portraitId)),
    [commit, safeValue],
  );

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
              accessibilityLabel={`${sex} portraits`}
              onPress={() => commit(switchAvatarSex(safeValue, sex))}
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
        <PortraitAvatar
          config={safeValue}
          size={layout.previewSize}
          accessibilityLabel={`${playerName} avatar preview`}
          testID={testID ? `${testID}-preview` : undefined}
        />
        <Text style={styles.previewName} numberOfLines={1}>
          {playerName}
        </Text>
        <Text style={styles.previewMeta}>{safeValue.sex === 'male' ? 'Male' : 'Female'}</Text>
        <View style={styles.actionRow}>
          <Button
            label="Randomize"
            variant="secondary"
            fullWidth={false}
            style={styles.actionButton}
            onPress={() => {
              const next = randomAvatarConfig(safeValue.sex, Math.random, safeValue.frameId);
              setSelectedTone(portraitToneBand(next));
              commit(next);
            }}
          />
          <Button
            label="Reset"
            variant="ghost"
            fullWidth={false}
            style={styles.actionButton}
            onPress={() => {
              const next = {
                ...DEFAULT_AVATAR_CONFIGS[safeValue.sex],
                ...(safeValue.frameId ? { frameId: safeValue.frameId } : {}),
              };
              setSelectedTone(portraitToneBand(next));
              commit(next);
            }}
          />
        </View>
      </View>

      <View style={styles.toneSection}>
        <Text style={styles.sectionTitle}>Skin tone range</Text>
        <Text style={styles.sectionHint}>Choose a range, then a portrait.</Text>
        <View
          accessibilityLabel="Skin tone range"
          accessibilityRole="radiogroup"
          style={styles.toneRow}
        >
          {AVATAR_TONE_BANDS.map((toneBand) => {
            const selected = selectedTone === toneBand;
            return (
              <View key={toneBand} style={[styles.toneCell, { width: layout.toneCellWidth }]}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={`Skin tone ${toneBand} of 8`}
                  accessibilityState={{ selected }}
                  hitSlop={2}
                  onPress={() => setSelectedTone(toneBand)}
                  style={[styles.toneButton, selected && styles.toneButtonSelected]}
                >
                  <View style={[styles.toneSwatch, { backgroundColor: TONE_SWATCHES[toneBand] }]} />
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.portraitGrid}>
        {options.map((portrait) => (
          <PortraitCard
            key={portrait.id}
            portrait={portrait}
            selected={portrait.id === safeValue.portraitId}
            size={layout.portraitSize}
            cardWidth={layout.cardWidth}
            onPress={choosePortrait}
          />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      marginTop: spacing.lg,
      overflow: 'hidden',
    },
    sexRow: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
    },
    sexButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      flex: 1,
      justifyContent: 'center',
      minHeight: 52,
    },
    sexButtonSelected: { backgroundColor: colors.primaryDark },
    sexText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    sexTextSelected: { color: colors.white },
    previewSurface: {
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      padding: spacing.lg,
    },
    previewName: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.md,
      maxWidth: '100%',
    },
    previewMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 3 },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    actionButton: { minWidth: 112 },
    toneSection: {
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingTop: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      paddingHorizontal: spacing.md,
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 3,
      paddingHorizontal: spacing.md,
    },
    toneRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: spacing.md,
      rowGap: spacing.sm,
    },
    toneCell: {
      alignItems: 'center',
    },
    toneButton: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 2,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    toneButtonSelected: { borderColor: colors.accent },
    toneSwatch: {
      borderColor: 'rgba(255,255,255,0.28)',
      borderRadius: 17,
      borderWidth: 1,
      height: 34,
      width: 34,
    },
    portraitGrid: {
      alignItems: 'stretch',
      backgroundColor: colors.bg,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_GAP,
      justifyContent: 'center',
      padding: GRID_PADDING,
    },
    portraitCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexGrow: 0,
      flexShrink: 0,
      minWidth: 0,
      padding: spacing.sm,
    },
    portraitCardSelected: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.accent,
      borderWidth: 2,
    },
  });
