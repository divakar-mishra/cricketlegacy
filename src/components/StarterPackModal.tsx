/**
 * Starter Pack Modal — shown ONCE in the first 24 hours after first play.
 * Contextual trigger: shown on match result when the user wins their first match,
 * or when they run out of energy for the first time.
 *
 * Designed to convert new players honestly:
 * - Genuine value (coins + gems + a 7-day ad-free trial)
 * - Framed as a one-time new-player offer (no fabricated price anchors or
 *   fake countdowns — those violate India's CCPA dark-pattern rules and app
 *   store policies)
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { BounceIn, FadeIn, FadeOut } from 'react-native-reanimated';
import { haptics } from '../audio';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { fonts, fontSize, fontWeight, radius, shadow, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface Props {
  visible: boolean;
  onPurchase: () => void;
  onDismiss: () => void;
}

export function StarterPackModal({ visible, onPurchase, onDismiss }: Props) {
  const { colors } = useTheme();
  const queueVisible = useModalQueue(visible, MODAL_PRIORITY.engagement, 'starter-pack');

  useEffect(() => {
    if (!queueVisible) return;
    haptics.impact();
  }, [queueVisible]);

  const handlePurchase = useCallback(() => {
    haptics.notify();
    onPurchase();
  }, [onPurchase]);

  if (!visible || !queueVisible) return null;

  return (
    <Modal transparent animationType="none" statusBarTranslucent visible={queueVisible}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View entering={BounceIn.springify().damping(16)} style={styles.card}>
          <LinearGradient
            colors={['#17211B', '#0B100D', '#17211B'] as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerBand}
          >
            <Text style={styles.limitedLabel}>FIRST MATCH COMPLETE</Text>
          </LinearGradient>

          <Text style={[styles.title, { color: colors.text }]}>Starter Pack</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Optional support for the next chapter of your career
          </Text>

          {/* Rewards list */}
          <View style={styles.rewardsList}>
            <RewardRow
              icon="wallet-outline"
              label="3,000 Coins"
              desc="Train and prepare for upcoming fixtures"
            />
            <RewardRow
              icon="diamond-outline"
              label="50 Gems"
              desc="Unlock cosmetics or capped convenience"
            />
            <RewardRow icon="ban-outline" label="Remove Ads" desc="Ad-free for 7 days" />
          </View>

          {/* Pricing */}
          <View style={styles.priceRow}>
            <View style={styles.saveBadge}>
              <Text style={styles.saveText}>ONE PER CAREER</Text>
            </View>
          </View>

          <Button
            label="View starter pack"
            variant="primary"
            size="lg"
            style={{ marginTop: spacing.md }}
            onPress={handlePurchase}
          />
          <Text style={[styles.oneTime, { color: colors.textMuted }]}>
            Google Play shows the localized price before purchase.
          </Text>

          <Pressable onPress={onDismiss} style={styles.dismissBtn} hitSlop={12}>
            <Text style={[styles.dismissText, { color: colors.textMuted }]}>
              No thanks, maybe later
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function RewardRow({ icon, label, desc }: { icon: IconName; label: string; desc: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.rewardRow}>
      <View style={styles.rewardIcon}>
        <Icon name={icon} size={24} color="#D5B56D" />
      </View>
      <View>
        <Text style={[styles.rewardLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rewardDesc, { color: colors.textMuted }]}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: '#0F241A',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: '#C6902A',
    overflow: 'hidden',
    ...shadow.card,
  },
  headerBand: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(213,181,109,0.4)',
  },
  limitedLabel: {
    color: '#D5B56D',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.black,
    fontFamily: fonts.display,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xl,
    lineHeight: 18,
  },
  rewardsList: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.sm },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rewardIcon: { width: 36, alignItems: 'center', justifyContent: 'center' },
  rewardLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  rewardDesc: { fontSize: fontSize.xs, marginTop: 1 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  originalPrice: { fontSize: fontSize.md, textDecorationLine: 'line-through' },
  salePrice: { fontSize: fontSize.xxxl, fontWeight: fontWeight.black, fontFamily: fonts.display },
  saveBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: '#17211B',
    borderWidth: 1,
    borderColor: '#8A6A26',
  },
  saveText: {
    color: '#D5B56D',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
    letterSpacing: 0.5,
  },
  oneTime: { fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing.sm },
  dismissBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  dismissText: { fontSize: fontSize.xs, textDecorationLine: 'underline' },
});
