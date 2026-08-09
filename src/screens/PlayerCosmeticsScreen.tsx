/**
 * Player Cosmetics — choose your player's look and celebration.
 *
 * Premium cosmetics cost gems (gem sink), creating value for gem purchases.
 * Basic options are free. Premium options are gem-gated.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { avatarFromLegacy, normalizeAvatarConfig, outfitForKitId } from '../avatar';
import type { AvatarConfig } from '../avatar';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { AvatarCustomizer, Button, Screen, ScreenHeader, WalletBar } from '../components';
import { AppText as Text } from '../components/AppText';
import { CELEBRATIONS, cosmeticCost, CosmeticOption, KIT_COLORS } from '../data/cosmetics';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fontSize,
  fontWeight,
  radius,
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
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          const isFree = opt.gemCost === 0 && !opt.passExclusive;
          const isOwned = isFree || ownedIds.has(opt.id);
          const canAfford = !opt.passExclusive && gems >= opt.gemCost;
          const isColor = opt.preview.startsWith('#');

          return (
            <View key={opt.id}>
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
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedCheck}>✓</Text>
                    </View>
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
            </View>
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
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() =>
    normalizeAvatarConfig(
      equipped?.avatarConfig ??
        avatarFromLegacy(
          equipped?.avatarCustomization,
          equipped?.kit,
          equipped?.profileFrame,
        ),
    ),
  );
  const [kit, setKit] = useState<string>(equipped?.kit ?? 'kit_white');
  const [celebration, setCelebration] = useState<string>(equipped?.celebration ?? 'cel_wave');
  const [hasChanges, setHasChanges] = useState(false);

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
        avatarCustomization: equipped?.avatarCustomization,
        avatarConfig,
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

      {/* Gem note */}
      <View style={styles.gemNote}>
        <Text style={styles.gemNoteText}>
          💎 You have{' '}
          <Text style={[styles.gemNoteText, { color: colors.info, fontWeight: fontWeight.black }]}>
            {gems} gems
          </Text>
          . Premium cosmetics are gem-exclusive.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Create Your Avatar</Text>
      <AvatarCustomizer
        value={avatarConfig}
        onChange={(next) => {
          setAvatarConfig(next);
          setHasChanges(true);
        }}
        playerName={
          save.userPlayerId ? (save.players[save.userPlayerId]?.name ?? 'Your Player') : 'Your Player'
        }
        showOutfits={false}
        testID="player-cosmetics-avatar"
      />

      {/* Kit color */}
      <CosmeticGrid
        title="🎽 Kit Colour"
        options={KIT_COLORS}
        selected={kit}
        gems={gems}
        ownedIds={ownedIds}
        onSelect={(id, cost) =>
          handleSelect(id, cost, (nextKit) => {
            setKit(nextKit);
            setAvatarConfig((current) =>
              normalizeAvatarConfig({ ...current, outfitId: outfitForKitId(nextKit) }),
            );
          })
        }
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
    gemNote: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.info + '44',
    },
    gemNoteText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
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
