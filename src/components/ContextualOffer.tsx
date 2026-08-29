/**
 * ContextualOffer — smart monetization modal that appears at high-emotion moments.
 * Kinds: energy_empty, injury_recovery, streak_protection, gem_sale, vip_unlock.
 * Never shown to VIP/removeAds holders for non-gem offers.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
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
import { AppText as Text } from './AppText';
import { Button } from './Button';

// ─── Offer type definitions ───────────────────────────────────────────────────

export type OfferKind =
  'energy_empty' | 'injury_recovery' | 'streak_protection' | 'vip_unlock' | 'gem_pack';

interface OfferConfig {
  title: string;
  body: string;
  urgencyLabel: string;
  ctaLabel: string;
  dismissLabel: string;
  gemCost?: number;
  accentColor: string;
  Icon: React.FC<{ size: number }>;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function EnergyBoltIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="4" y="4" width="40" height="40" rx="10" fill="#31A85A" />
      <Path d="M26 8L14 26H24L22 40L34 22H24Z" fill="#F7D06E" />
    </Svg>
  );
}

function InjuryIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="4" y="4" width="40" height="40" rx="10" fill="#E5484D" />
      <Rect x="20" y="10" width="8" height="28" rx="3" fill="white" />
      <Rect x="10" y="20" width="28" height="8" rx="3" fill="white" />
    </Svg>
  );
}

function ShieldIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 4L8 10V24C8 33 24 44 24 44C24 44 40 33 40 24V10Z" fill="#4C9AFF" />
      <Path d="M24 8L12 13V24C12 31 24 40 24 40C24 40 36 31 36 24V13Z" fill="#82BFFF" />
      <Path
        d="M18 24L22 28L30 20"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function GemIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M10 18L24 6L38 18L24 42Z" fill="#4C9AFF" />
      <Path d="M10 18L24 6L38 18" fill="#B4D9FF" />
      <Path d="M16 18L24 6L32 18" fill="#D6EEFF" />
    </Svg>
  );
}

function VIPIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 4L29.5 17.5H44L32.5 26L37 40L24 32L11 40L15.5 26L4 17.5H18.5Z" fill="#E9B23B" />
      <Path d="M24 8L28.5 20H41L31 27.5L35 39L24 32.5L13 39L17 27.5L7 20H19.5Z" fill="#F7D06E" />
    </Svg>
  );
}

// ─── Offer configs ────────────────────────────────────────────────────────────

function getOfferConfig(kind: OfferKind, streakDays?: number): OfferConfig {
  switch (kind) {
    case 'energy_empty':
      return {
        title: 'Out of energy',
      body: 'Refill now or wait for recovery.',
        urgencyLabel: 'Match available now',
        ctaLabel: 'Refill · 10 gems',
        dismissLabel: 'Wait for regeneration',
        gemCost: 10,
        accentColor: '#31A85A',
        Icon: EnergyBoltIcon,
      };
    case 'injury_recovery':
      return {
        title: 'Injury setback',
      body: 'Recover before the next match.',
        urgencyLabel: 'Next match approaching',
        ctaLabel: 'Speed up recovery',
        dismissLabel: 'Sit it out',
        accentColor: '#E5484D',
        Icon: InjuryIcon,
      };
    case 'streak_protection':
      return {
        title: `${streakDays ?? 7}-match streak at risk`,
      body: 'Refill and keep playing.',
        urgencyLabel: 'Play before it resets',
        ctaLabel: 'Refill · 10 gems',
        dismissLabel: 'Risk it',
        gemCost: 10,
        accentColor: '#4C9AFF',
        Icon: ShieldIcon,
      };
    case 'gem_pack':
      return {
        title: '2× first gem purchase',
      body: 'First gem purchase: 2× gems.',
        urgencyLabel: 'First-purchase bonus',
        ctaLabel: 'View Gem Packs',
        dismissLabel: 'Maybe later',
        accentColor: '#4C9AFF',
        Icon: GemIcon,
      };
    case 'vip_unlock':
    default:
      return {
        title: 'VIP + Remove Ads',
      body: 'Permanent in both career modes.',
        urgencyLabel: 'Popular upgrade',
        ctaLabel: 'View VIP',
        dismissLabel: 'Not now',
        accentColor: '#E9B23B',
        Icon: VIPIcon,
      };
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ContextualOfferProps {
  kind: OfferKind | null;
  streakDays?: number;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ContextualOffer({ kind, streakDays, onAccept, onDismiss }: ContextualOfferProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const queueVisible = useModalQueue(Boolean(kind), MODAL_PRIORITY.prompt, 'contextual-offer');

  const scale = useSharedValue(0.85);
  const glow = useSharedValue(0.3);

  useEffect(() => {
    if (kind) {
      scale.value = withTiming(1, { duration: 200 });
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0.3, { duration: 900 })),
        -1,
        true,
      );
    }
  }, [glow, kind, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  if (!kind || !queueVisible) return null;
  const cfg = getOfferConfig(kind, streakDays);
  const { Icon, accentColor } = cfg;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View entering={ZoomIn.duration(200)} style={[styles.card, cardStyle]}>
            <LinearGradient colors={[colors.surface, colors.bgElevated]} style={styles.cardInner}>
              {/* Glow ring behind icon */}
              <View style={styles.iconWrap}>
                <Animated.View
                  style={[styles.iconGlow, { backgroundColor: accentColor }, glowStyle]}
                />
                <Icon size={64} />
              </View>

              {/* Urgency chip */}
              <View
                style={[
                  styles.urgencyChip,
                  { borderColor: accentColor + '60', backgroundColor: accentColor + '18' },
                ]}
              >
                <Text style={[styles.urgencyText, { color: accentColor }]}>{cfg.urgencyLabel}</Text>
              </View>

              <Text style={styles.title}>{cfg.title}</Text>
              <Text style={styles.body}>{cfg.body}</Text>

              {/* The VIP body is intentionally brief; its effects live here once. */}
              {kind === 'vip_unlock' ? (
                <View style={styles.bullets}>
                  {[
                    'Permanent ad removal',
                    '60-energy cap',
                    '+20% match coins',
                    'VIP daily rewards',
                  ].map((b, i) => (
                    <View key={i} style={styles.bullet}>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Button
                label={cfg.ctaLabel}
                variant="primary"
                style={styles.ctaBtn}
                onPress={onAccept}
              />
              <Pressable onPress={onDismiss} style={styles.dismissBtn}>
                <Text style={styles.dismissText}>{cfg.dismissLabel}</Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Compact inline offer banner (for inside hubs) ────────────────────────────

interface OfferBannerProps {
  kind: OfferKind;
  streakDays?: number;
  onPress: () => void;
  onDismiss: () => void;
}

export function OfferBanner({ kind, streakDays, onPress, onDismiss }: OfferBannerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cfg = getOfferConfig(kind, streakDays);
  const { Icon, accentColor } = cfg;

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[styles.banner, { borderColor: accentColor + '50' }]}
    >
      <LinearGradient
        colors={[accentColor + '22', accentColor + '08']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bannerGradient}
      >
        <Icon size={36} />
        <View style={styles.bannerBody}>
          <Text style={[styles.bannerTitle, { color: accentColor }]}>{cfg.title}</Text>
          <Text style={styles.bannerSub} numberOfLines={1}>
            {cfg.urgencyLabel}
          </Text>
        </View>
        <Pressable style={[styles.bannerCta, { backgroundColor: accentColor }]} onPress={onPress}>
          <Text style={styles.bannerCtaText}>{cfg.gemCost ? `${cfg.gemCost}💎` : 'View'}</Text>
        </Pressable>
        <Pressable onPress={onDismiss} style={styles.bannerClose}>
          <Text style={{ color: colors.textFaint, fontSize: 16 }}>✕</Text>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border,
      ...shadow.card,
    },
    cardInner: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    iconWrap: {
      position: 'relative',
      marginBottom: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlow: {
      position: 'absolute',
      width: 80,
      height: 80,
      borderRadius: 40,
      opacity: 0.3,
    },
    urgencyChip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      marginBottom: spacing.md,
    },
    urgencyText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 0.8,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    body: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    bullets: {
      width: '100%',
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    bullet: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    bulletText: {
      color: colors.text,
      fontSize: fontSize.sm,
      lineHeight: 22,
    },
    ctaBtn: { width: '100%', marginBottom: spacing.sm },
    dismissBtn: { paddingVertical: spacing.sm },
    dismissText: {
      color: colors.textFaint,
      fontSize: fontSize.sm,
      textDecorationLine: 'underline',
    },

    // Banner styles
    banner: {
      borderRadius: radius.lg,
      borderWidth: 1.5,
      overflow: 'hidden',
      marginVertical: spacing.xs,
    },
    bannerGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.sm,
    },
    bannerBody: { flex: 1 },
    bannerTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    bannerSub: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
    bannerCta: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    bannerCtaText: { color: colors.white, fontSize: fontSize.xs, fontWeight: fontWeight.black },
    bannerClose: { padding: spacing.xs },
  });
