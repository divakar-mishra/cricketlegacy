/**
 * Player Cosmetics — choose your player's look and celebration.
 *
 * Premium cosmetics cost gems (gem sink), creating value for gem purchases.
 * Basic options are free. Premium options are gem-gated.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, PlayerAvatar, Screen, ScreenHeader, WalletBar } from '../components';
import { AppText as Text } from '../components/AppText';
import {
  AVATAR_BEARD_OPTIONS,
  AVATAR_BROW_OPTIONS,
  AVATAR_EYE_COLORS,
  AVATAR_FACE_OPTIONS,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_OPTIONS,
  AVATAR_MOUSTACHE_OPTIONS,
  AVATAR_SKIN_TONES,
  DEFAULT_AVATAR_CUSTOMIZATION,
} from '../data/avatar';
import { CELEBRATIONS, cosmeticCost, CosmeticOption, KIT_COLORS } from '../data/cosmetics';
import { AvatarCustomization } from '../domain/types';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadow,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

// ─── Section ──────────────────────────────────────────────────────────────────

function CosmeticGrid({
  title,
  options,
  selected,
  gems,
  ownedIds,
  onSelect,
}: {
  title: string;
  options: CosmeticOption[];
  selected: string;
  gems: number;
  ownedIds: Set<string>;
  onSelect: (id: string, cost: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.optionGrid}>
        {options.map((opt, idx) => {
          const isSelected = selected === opt.id;
          const isFree = opt.gemCost === 0 && !opt.passExclusive;
          const isOwned = isFree || ownedIds.has(opt.id);
          const canAfford = !opt.passExclusive && gems >= opt.gemCost;
          const isColor = opt.preview.startsWith('#');

          return (
            <Animated.View key={opt.id} entering={FadeInDown.duration(220).delay(idx * 40)}>
              <Pressable
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  !isOwned && !canAfford && styles.optionCardLocked,
                ]}
                accessibilityState={{ disabled: !isOwned && opt.passExclusive }}
                disabled={!isOwned && opt.passExclusive}
                onPress={() => onSelect(opt.id, opt.gemCost)}
              >
                {/* Preview */}
                <View
                  style={[
                    styles.previewWrap,
                    isSelected && { borderColor: colors.accent, borderWidth: 2 },
                  ]}
                >
                  {isColor ? (
                    <View style={[styles.colorPreview, { backgroundColor: opt.preview }]}>
                      {isSelected && <Text style={styles.colorCheck}>✓</Text>}
                    </View>
                  ) : (
                    <Text style={styles.previewEmoji}>{opt.preview}</Text>
                  )}
                  {isSelected && !isColor && (
                    <Animated.View entering={ZoomIn.duration(200)} style={styles.selectedBadge}>
                      <Text style={styles.selectedCheck}>✓</Text>
                    </Animated.View>
                  )}
                </View>
                <Text
                  style={[styles.optionLabel, isSelected && { color: colors.accent }]}
                  numberOfLines={2}
                >
                  {opt.label}
                </Text>
                {opt.passExclusive ? (
                  <View
                    style={[
                      styles.costBadge,
                      { backgroundColor: isOwned ? colors.accent + '22' : colors.surfaceMuted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.costText,
                        { color: isOwned ? colors.accent : colors.textFaint },
                      ]}
                    >
                      {isOwned ? 'PASS OWNED' : 'PASS REWARD'}
                    </Text>
                  </View>
                ) : opt.gemCost > 0 ? (
                  isOwned ? (
                    <View style={[styles.costBadge, { backgroundColor: colors.success + '22' }]}>
                      <Text style={[styles.costText, { color: colors.success }]}>OWNED</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.costBadge,
                        { backgroundColor: canAfford ? colors.info + '22' : colors.surfaceMuted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.costText,
                          { color: canAfford ? colors.info : colors.textFaint },
                        ]}
                      >
                        {opt.gemCost} 💎
                      </Text>
                    </View>
                  )
                ) : (
                  <Text style={styles.freeBadge}>FREE</Text>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

function ChoiceRow<T extends string>({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { id: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.builderGroup}>
      <Text style={styles.builderLabel}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.choiceRow}
      >
        {options.map((option) => {
          const active = option.id === selected;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(option.id)}
              style={[styles.choiceChip, active && styles.choiceChipActive]}
            >
              <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ColorRow({
  title,
  colors: options,
  selected,
  onSelect,
}: {
  title: string;
  colors: readonly string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.builderGroup}>
      <Text style={styles.builderLabel}>{title}</Text>
      <View style={styles.colorRow}>
        {options.map((color) => {
          const active = color === selected;
          return (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={`${title} ${color}`}
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(color)}
              style={[styles.builderSwatchWrap, active && styles.builderSwatchWrapActive]}
            >
              <View style={[styles.builderSwatch, { backgroundColor: color }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function PlayerCosmeticsScreen({ navigation }: ScreenProps<'PlayerCosmetics'>) {
  const save = useCareer((s) => s.save);
  const saveCosmetics = useCareer((s) => s.saveCosmetics);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Initialise from the persisted equipped look; changes are committed on save.
  const equipped = save?.cosmetics;
  const avatar = 'avatar_custom';
  const [avatarCustomization, setAvatarCustomization] = useState<AvatarCustomization>({
    ...DEFAULT_AVATAR_CUSTOMIZATION,
    ...(equipped?.avatarCustomization ?? {}),
  });
  const [kit, setKit] = useState<string>(equipped?.kit ?? 'kit_white');
  const [celebration, setCelebration] = useState<string>(equipped?.celebration ?? 'cel_wave');
  const [hasChanges, setHasChanges] = useState(false);

  const updateAvatar = <K extends keyof AvatarCustomization>(
    key: K,
    value: AvatarCustomization[K],
  ) => {
    setAvatarCustomization((current) => ({ ...current, [key]: value }));
    setHasChanges(true);
  };

  const gems = save?.wallet.gems ?? 0;
  // Premium cosmetics already unlocked (persisted in the save's inventory).
  const ownedIds = new Set<string>(
    Object.keys(save?.inventory ?? {}).filter((id) => (save?.inventory?.[id] ?? 0) > 0),
  );

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="Cosmetics" onBack={() => navigation.goBack()} />
        <Text style={{ color: colors.textMuted, margin: spacing.xl }}>Start a career first.</Text>
      </Screen>
    );
  }

  const handleSelect = (id: string, cost: number, setter: (id: string) => void) => {
    // Owned premium items (and free items) can always be equipped. Only an
    // unowned premium pick you can't afford is blocked here.
    if (cost > 0 && !ownedIds.has(id) && gems < cost) {
      Alert.alert(
        'Not enough gems',
        `You need ${cost} 💎 for this cosmetic. Visit the Store to get more gems!`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Go to Store', onPress: () => navigation.navigate('Purchase') },
        ],
      );
      return;
    }
    setter(id);
    setHasChanges(true);
  };

  const onSave = () => {
    // Persist the look through the store: it spends gems for any newly-unlocked
    // premium picks, records them as owned, and saves the equipped selection.
    const res = saveCosmetics(
      {
        avatar,
        kit,
        celebration,
        avatarCustomization,
        profileFrame: equipped?.profileFrame,
        stadiumTheme: equipped?.stadiumTheme,
        officeTheme: equipped?.officeTheme,
      },
      { [avatar]: 0, [kit]: cosmeticCost(kit), [celebration]: cosmeticCost(celebration) },
    );
    if (!res.ok) {
      Alert.alert(
        'Not enough gems',
        res.reason ?? 'You cannot afford all of these premium cosmetics.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Get gems', onPress: () => navigation.navigate('Purchase') },
        ],
      );
      return;
    }
    Alert.alert(
      'Look updated!',
      res.spent > 0
        ? `Your new look is equipped — ${res.spent} 💎 spent.`
        : 'Your new look is equipped.',
    );
    setHasChanges(false);
    navigation.goBack();
  };

  return (
    <Screen
      scroll
      gradient={gradients.pitch}
      footer={
        hasChanges ? <Button label="Save My Look" variant="gold" onPress={onSave} /> : undefined
      }
    >
      <ScreenHeader
        title="Player Cosmetics"
        subtitle="Personalise your legend"
        onBack={() => navigation.goBack()}
      />
      <WalletBar wallet={save.wallet} />

      {/* Preview card */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.previewCard}>
        <LinearGradient colors={[colors.surfaceAlt, colors.surface]} style={styles.previewGradient}>
          <PlayerAvatar
            name={
              save.userPlayerId
                ? (save.players[save.userPlayerId]?.name ?? 'Your Player')
                : 'Your Player'
            }
            role={save.userPlayerId ? save.players[save.userPlayerId]?.role : undefined}
            size="xl"
            showRole
            customization={avatarCustomization}
            kitColor={KIT_COLORS.find((option) => option.id === kit)?.preview}
            profileFrame={equipped?.profileFrame}
          />
          <Text style={styles.previewPlayerName}>
            {save.userPlayerId ? save.players[save.userPlayerId]?.name : 'Your Player'}
          </Text>
          <Text style={styles.previewCelLabel}>
            Celebration: {CELEBRATIONS.find((c) => c.id === celebration)?.preview ?? '👋'}{' '}
            {CELEBRATIONS.find((c) => c.id === celebration)?.label}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Gem note */}
      <Animated.View entering={FadeInDown.duration(300).delay(200)} style={styles.gemNote}>
        <Text style={styles.gemNoteText}>
          💎 You have{' '}
          <Text style={[styles.gemNoteText, { color: colors.info, fontWeight: fontWeight.black }]}>
            {gems} gems
          </Text>
          . Premium cosmetics are gem-exclusive.
        </Text>
      </Animated.View>

      <Text style={styles.sectionTitle}>Create Your Avatar</Text>
      <View style={styles.builderSurface}>
        <ColorRow
          title="Skin tone"
          colors={AVATAR_SKIN_TONES}
          selected={avatarCustomization.skinTone}
          onSelect={(value) => updateAvatar('skinTone', value)}
        />
        <ChoiceRow
          title="Face shape"
          options={AVATAR_FACE_OPTIONS}
          selected={avatarCustomization.faceShape}
          onSelect={(value) => updateAvatar('faceShape', value)}
        />
        <ChoiceRow
          title="Hair"
          options={AVATAR_HAIR_OPTIONS}
          selected={avatarCustomization.hairStyle}
          onSelect={(value) => updateAvatar('hairStyle', value)}
        />
        <ColorRow
          title="Hair colour"
          colors={AVATAR_HAIR_COLORS}
          selected={avatarCustomization.hairColor}
          onSelect={(value) => updateAvatar('hairColor', value)}
        />
        <ChoiceRow
          title="Beard"
          options={AVATAR_BEARD_OPTIONS}
          selected={avatarCustomization.facialHair}
          onSelect={(value) => updateAvatar('facialHair', value)}
        />
        <ChoiceRow
          title="Moustache"
          options={AVATAR_MOUSTACHE_OPTIONS}
          selected={avatarCustomization.moustache}
          onSelect={(value) => updateAvatar('moustache', value)}
        />
        <ChoiceRow
          title="Brows"
          options={AVATAR_BROW_OPTIONS}
          selected={avatarCustomization.browStyle}
          onSelect={(value) => updateAvatar('browStyle', value)}
        />
        <ColorRow
          title="Eye colour"
          colors={AVATAR_EYE_COLORS}
          selected={avatarCustomization.eyeColor}
          onSelect={(value) => updateAvatar('eyeColor', value)}
        />
      </View>

      {/* Kit color */}
      <CosmeticGrid
        title="🎽 Kit Colour"
        options={KIT_COLORS}
        selected={kit}
        gems={gems}
        ownedIds={ownedIds}
        onSelect={(id, cost) => handleSelect(id, cost, setKit)}
      />

      {/* Celebration */}
      <CosmeticGrid
        title="🎉 Celebration Style"
        options={CELEBRATIONS}
        selected={celebration}
        gems={gems}
        ownedIds={ownedIds}
        onSelect={(id, cost) => handleSelect(id, cost, setCelebration)}
      />

      <Text style={styles.footer}>
        More cosmetics unlock as you progress your career. Reach Legend tier for exclusive looks!
      </Text>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    previewCard: {
      marginTop: spacing.md,
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
      ...shadow.card,
    },
    previewGradient: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    previewPlayerName: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    previewCelLabel: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4 },

    gemNote: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.info + '44',
    },
    gemNoteText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
    builderSurface: {
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    builderGroup: { paddingVertical: spacing.sm },
    builderLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.xs,
    },
    choiceRow: { gap: spacing.xs, paddingRight: spacing.lg },
    choiceChip: {
      minHeight: 38,
      minWidth: 74,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    choiceChipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
    choiceText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    choiceTextActive: { color: colors.accent },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    builderSwatchWrap: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    builderSwatchWrapActive: { borderColor: colors.accent },
    builderSwatch: { width: 32, height: 32, borderRadius: 16 },

    sectionTitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    optionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    optionCard: {
      width: 88,
      alignItems: 'center',
      padding: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceAlt,
    },
    optionCardLocked: { opacity: 0.6 },
    previewWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    previewEmoji: { fontSize: 26 },
    colorPreview: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    colorCheck: { color: colors.white, fontSize: fontSize.xl, fontWeight: fontWeight.black },
    selectedBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedCheck: { color: colors.white, fontSize: 9, fontWeight: fontWeight.black },
    optionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 14,
    },
    costBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 4,
    },
    costText: { fontSize: 9, fontWeight: fontWeight.bold },
    freeBadge: {
      color: colors.success,
      fontSize: 9,
      fontWeight: fontWeight.black,
      marginTop: 4,
      letterSpacing: 0.5,
    },

    footer: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.xl,
      marginBottom: spacing.xxl,
      lineHeight: 18,
      paddingHorizontal: spacing.md,
    },
  });
