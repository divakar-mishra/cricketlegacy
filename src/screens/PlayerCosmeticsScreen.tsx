/**
 * Player Cosmetics — choose your player's look and celebration.
 *
 * Premium cosmetics cost gems (gem sink), creating value for gem purchases.
 * Basic options are free. Premium options are gem-gated.
 */
import { type ComponentProps, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { normalizeAvatarConfig } from '../avatar';
import type { AvatarConfig } from '../avatar';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  Button,
  PortraitPicker,
  Screen,
  ScreenHeader,
  SponsoredKitPreview,
  WalletBar,
} from '../components';
import { AppText as Text } from '../components/AppText';
import { KitThumbnail } from '../components/KitDesign';
import { PortraitAvatar } from '../components/avatar';
import {
  CELEBRATIONS,
  cosmeticCost,
  CosmeticOption,
  KIT_COLORS,
  kitColorHex,
  ownsCosmetic,
  ownsProfileFrame,
  PROFILE_FRAMES,
} from '../data/cosmetics';
import { activeSponsorBranding } from '../game/sponsorship';
import {
  defaultShirtName,
  defaultShirtNumber,
  normalizeShirtName,
  normalizeShirtNumber,
  SHIRT_NAME_MAX_LENGTH,
} from '../game/kitIdentity';
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
          const previewAccent = opt.previewAccent ?? colors.accent;
          const status = isSelected
            ? 'selected'
            : isOwned
              ? 'owned'
              : opt.passExclusive
                ? 'Collection reward'
                : `${opt.gemCost} gems`;

          return (
            <View key={opt.id} style={styles.optionCell}>
              <Pressable
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  !isOwned && !canAfford && styles.optionCardLocked,
                ]}
                accessibilityState={{ disabled: !isOwned && opt.passExclusive }}
                accessibilityLabel={`${opt.label}, ${status}`}
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
                    <KitThumbnail kitId={opt.id} />
                  ) : opt.previewIcon ? (
                    <View style={[styles.iconPreview, { backgroundColor: `${previewAccent}18` }]}>
                      <Ionicons
                        name={opt.previewIcon as ComponentProps<typeof Ionicons>['name']}
                        size={30}
                        color={previewAccent}
                      />
                    </View>
                  ) : (
                    <Text style={[styles.previewEmoji, { color: colors.text }]}>{opt.preview}</Text>
                  )}
                  {!isOwned && opt.passExclusive && (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={10} color={colors.white} />
                    </View>
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
                      style={[styles.costText, { color: isOwned ? colors.accent : colors.info }]}
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
  const player = save?.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const avatar = 'avatar_custom';
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() =>
    normalizeAvatarConfig({
      ...(equipped?.avatarConfig ?? {}),
      ...(equipped?.profileFrame ? { frameId: equipped.profileFrame } : {}),
    }),
  );
  const [kit, setKit] = useState<string>(equipped?.kit ?? 'kit_white');
  const [profileFrame, setProfileFrame] = useState(equipped?.profileFrame ?? equipped?.avatarConfig?.frameId ?? 'frame_none');
  const [celebration, setCelebration] = useState<string>(equipped?.celebration ?? 'cel_wave');
  const [kitSide, setKitSide] = useState<'front' | 'back'>('front');
  const [shirtName, setShirtName] = useState<string>(
    equipped?.shirtName ?? defaultShirtName(player?.name),
  );
  const [shirtNumber, setShirtNumber] = useState<string>(
    String(equipped?.shirtNumber ?? defaultShirtNumber(player?.id)),
  );
  const [hasChanges, setHasChanges] = useState(false);

  const gems = save?.wallet.gems ?? 0;
  // Premium cosmetics already unlocked (persisted in the save's inventory).
  const ownedIds = new Set<string>(
    Object.keys(save?.inventory ?? {}).filter((id) => (save?.inventory?.[id] ?? 0) > 0),
  );
  KIT_COLORS.forEach((item) => {
    if (ownsCosmetic(save?.inventory, item.id)) ownedIds.add(item.id);
  });

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="Cosmetics" onBack={() => navigation.goBack()} />
        <Text style={{ color: colors.textMuted, margin: spacing.xl }}>Start a career first.</Text>
      </Screen>
    );
  }
  const sponsorBranding = activeSponsorBranding(save);

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
        shirtName: normalizeShirtName(shirtName, player?.name),
        shirtNumber: normalizeShirtNumber(shirtNumber, player?.id),
        avatarConfig,
        profileFrame,
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
      <ScreenHeader title="Kit & Look" onBack={() => navigation.goBack()} />
      <WalletBar wallet={save.wallet} />

      <View style={styles.kitHeadingRow}>
        <Text style={styles.sectionTitle}>Your Kit</Text>
        <View style={styles.kitSideControl}>
          {(['front', 'back'] as const).map((side) => (
            <Pressable
              key={side}
              accessibilityRole="button"
              accessibilityState={{ selected: kitSide === side }}
              style={[styles.kitSideButton, kitSide === side && styles.kitSideButtonActive]}
              onPress={() => setKitSide(side)}
            >
              <Text style={[styles.kitSideText, kitSide === side && styles.kitSideTextActive]}>
                {side.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <SponsoredKitPreview
        kitId={kit}
        kitColor={kitColorHex(kit) ?? '#F7F7F7'}
        earned={sponsorBranding.earned}
        premium={sponsorBranding.premium}
        side={kitSide}
        shirtName={normalizeShirtName(shirtName, player?.name)}
        shirtNumber={normalizeShirtNumber(shirtNumber, player?.id)}
      />

      <View style={styles.shirtIdentityCard}>
        <View style={styles.shirtFieldWide}>
          <Text style={styles.fieldLabel}>BACK NAME</Text>
          <TextInput
            value={shirtName}
            onFocus={() => setKitSide('back')}
            onChangeText={(value) => {
              setShirtName(value.toUpperCase().slice(0, SHIRT_NAME_MAX_LENGTH));
              setHasChanges(true);
            }}
            placeholder={defaultShirtName(player?.name)}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            maxLength={SHIRT_NAME_MAX_LENGTH}
            style={styles.shirtInput}
          />
        </View>
        <View style={styles.shirtFieldNumber}>
          <Text style={styles.fieldLabel}>NUMBER</Text>
          <TextInput
            value={shirtNumber}
            onFocus={() => setKitSide('back')}
            onChangeText={(value) => {
              setShirtNumber(value.replace(/\D/g, '').slice(0, 2));
              setHasChanges(true);
            }}
            placeholder="7"
            placeholderTextColor={colors.textFaint}
            keyboardType="number-pad"
            maxLength={2}
            style={[styles.shirtInput, styles.shirtNumberInput]}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Portrait</Text>
      <PortraitPicker
        kitId={kit}
        value={avatarConfig}
        onChange={(next) => {
          setAvatarConfig(next);
          setHasChanges(true);
        }}
        playerName={
          save.userPlayerId
            ? (save.players[save.userPlayerId]?.name ?? 'Your Player')
            : 'Your Player'
        }
        testID="player-cosmetics-avatar"
      />

      <Text style={styles.sectionTitle}>Profile Frame</Text>
      <View style={styles.optionGrid}>
        {PROFILE_FRAMES.map((frame) => {
          const unlocked = ownsProfileFrame(save.inventory, frame.id);
          return (
            <Pressable
              key={frame.id}
              accessibilityRole="button"
              accessibilityLabel={`${frame.label}${unlocked ? '' : ', locked'}`}
              accessibilityState={{ selected: profileFrame === frame.id, disabled: !unlocked }}
              disabled={!unlocked}
              style={[styles.optionCell, styles.optionCard, profileFrame === frame.id && styles.optionCardSelected]}
              onPress={() => { setProfileFrame(frame.id); setAvatarConfig({ ...avatarConfig, frameId: frame.id }); setHasChanges(true); }}
            >
              <PortraitAvatar config={avatarConfig} kitId={kit} frameId={frame.id} size={52} />
              <Text style={styles.optionLabel}>{frame.label}</Text>
              <Text style={styles.freeBadge}>{unlocked ? 'OWNED' : frame.id === 'frame_vip' ? '30-DAY VIP STREAK' : 'LEGEND / PASS'}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Kit designs */}
      <CosmeticGrid
        title="Kit Designs"
        options={KIT_COLORS}
        selected={kit}
        gems={gems}
        ownedIds={ownedIds}
        onSelect={(id, cost) => handleSelect(id, cost, setKit)}
      />

      {/* Celebration */}
      <CosmeticGrid
        title="Celebration"
        options={CELEBRATIONS}
        selected={celebration}
        gems={gems}
        ownedIds={ownedIds}
        onSelect={(id, cost) => handleSelect(id, cost, setCelebration)}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    kitHeadingRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    kitSideControl: {
      flexDirection: 'row',
      padding: 3,
      backgroundColor: colors.surfaceAlt,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    kitSideButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
    },
    kitSideButtonActive: { backgroundColor: colors.accent },
    kitSideText: { color: colors.textMuted, fontSize: 10, fontWeight: fontWeight.black },
    kitSideTextActive: { color: colors.black },
    shirtIdentityCard: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    shirtFieldWide: { flex: 1 },
    shirtFieldNumber: { width: 92 },
    fieldLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      marginBottom: 5,
    },
    shirtInput: {
      minHeight: 46,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
    },
    shirtNumberInput: { textAlign: 'center' },
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
    optionCell: {
      flexBasis: '30%',
      flexGrow: 1,
      maxWidth: '32%',
    },
    optionCard: {
      width: '100%',
      minHeight: 146,
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
    optionCardLocked: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.info + '55',
    },
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
    iconPreview: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    lockBadge: {
      position: 'absolute',
      left: 3,
      bottom: 3,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.info,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: 4,
      lineHeight: 14,
      minHeight: 28,
    },
    costBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    costText: { fontSize: 9, fontWeight: fontWeight.bold },
    freeBadge: {
      color: colors.success,
      fontSize: 9,
      fontWeight: fontWeight.black,
      marginTop: 4,
      letterSpacing: 0.5,
    },
  });
