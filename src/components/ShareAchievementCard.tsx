/**
 * ShareAchievementCard — a beautiful shareable card for achievements.
 * Uses react-native-view-shot to capture the card as a PNG,
 * then expo-sharing to share to WhatsApp, Instagram, etc.
 *
 * Falls back to text-only sharing if view-shot is unavailable (Expo Go).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { EVT, logEvent } from '../services/analytics';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

// ─── Achievement tier colours ─────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  bronze: '#C6902A',
  silver: '#9BA7B0',
  gold: '#E9B23B',
  platinum: '#4C9AFF',
};

const TIER_GRADIENTS: Record<string, readonly [string, string]> = {
  bronze: ['#2A1C08', '#1A1005'],
  silver: ['#1A1E22', '#0E1215'],
  gold: ['#2A1C08', '#1A1005'],
  platinum: ['#081828', '#040E18'],
};

// ─── Card inner component (also used for capture) ────────────────────────────

interface CardInnerProps {
  achievementTitle: string;
  achievementDesc: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  playerName: string;
  statLine?: string; // e.g. "147* in T20 Final"
  date?: string;
}

function TrophyIcon({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? '#E9B23B';
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Circle cx={28} cy={28} r={27} fill={color} opacity={0.15} />
      <Path d="M20 12h16v16c0 9-8 16-8 16s-8-7-8-16V12z" fill={color} opacity={0.9} />
      <Rect x="23" y="38" width="10" height="7" rx="2" fill={color} opacity={0.7} />
      <Rect x="18" y="44" width="20" height="4" rx="2" fill={color} opacity={0.7} />
      <Path
        d="M16 16c-6 0-8 3-8 8s4 9 12 11"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={0.6}
      />
      <Path
        d="M40 16c6 0 8 3 8 8s-4 9-12 11"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* Stars at top */}
      {tier === 'platinum' &&
        [-8, 0, 8].map((ox, i) => (
          <Polygon
            key={i}
            points={`${28 + ox},5 ${29 + ox},8 ${32 + ox},8 ${30 + ox},10 ${31 + ox},13 ${28 + ox},11 ${25 + ox},13 ${26 + ox},10 ${24 + ox},8 ${27 + ox},8`}
            fill={color}
            transform="scale(0.7)"
          />
        ))}
    </Svg>
  );
}

export function ShareableAchievementCard({
  achievementTitle,
  achievementDesc,
  tier,
  playerName,
  statLine,
  date,
}: CardInnerProps) {
  const { colors } = useTheme();
  const tierColor = TIER_COLORS[tier] ?? colors.accent;
  const gradients = TIER_GRADIENTS[tier] ?? TIER_GRADIENTS.gold;

  return (
    <LinearGradient
      colors={[...gradients, gradients[1]] as [string, string, string]}
      style={styles.cardBg}
    >
      {/* Top stripe */}
      <LinearGradient
        colors={[tierColor + '60', tierColor + '20', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topStripe}
      />

      {/* Game branding */}
      <View style={styles.brandRow}>
        <Text style={[styles.brandText, { color: tierColor }]}>CRICKET LEGACY</Text>
        <View
          style={[
            styles.tierPill,
            { borderColor: tierColor + '60', backgroundColor: tierColor + '20' },
          ]}
        >
          <Text style={[styles.tierText, { color: tierColor }]}>{tier.toUpperCase()}</Text>
        </View>
      </View>

      {/* Trophy */}
      <View style={styles.trophyWrap}>
        <View style={[styles.trophyGlow, { backgroundColor: tierColor }]} />
        <TrophyIcon tier={tier} />
      </View>

      {/* Achievement */}
      <Text style={[styles.achTitle, { color: tierColor }]}>{achievementTitle}</Text>
      <Text style={styles.achDesc}>{achievementDesc}</Text>

      {/* Stat highlight */}
      {statLine && (
        <View
          style={[
            styles.statBadge,
            { borderColor: tierColor + '40', backgroundColor: tierColor + '15' },
          ]}
        >
          <Text style={[styles.statBadgeText, { color: tierColor }]}>{statLine}</Text>
        </View>
      )}

      {/* Player name */}
      <View style={styles.playerRow}>
        <Text style={styles.playerLabel}>Unlocked by</Text>
        <Text style={[styles.playerName, { color: tierColor }]}>{playerName}</Text>
      </View>

      {/* Date & bottom branding */}
      <View style={styles.bottomRow}>
        <Text style={styles.bottomDate}>
          {date ??
            new Date().toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
        </Text>
        <Text style={styles.bottomBrand}>cricketlegacy.game</Text>
      </View>
    </LinearGradient>
  );
}

// ─── Share modal ──────────────────────────────────────────────────────────────

interface ShareAchievementModalProps {
  visible: boolean;
  achievementTitle: string;
  achievementDesc: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  playerName: string;
  statLine?: string;
  onDismiss: () => void;
}

export function ShareAchievementModal({
  visible,
  achievementTitle,
  achievementDesc,
  tier,
  playerName,
  statLine,
  onDismiss,
}: ShareAchievementModalProps) {
  const styles2 = useThemedStyles(makeModalStyles);
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    logEvent(EVT.SHARE_ACHIEVEMENT, { tier, title: achievementTitle });

    try {
      // Try native ViewShot capture first (only works in EAS Dev Build)
      let shared = false;
      try {
        // Keep this lazy: Expo Go does not always ship the native view-shot module.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const ViewShot = require('react-native-view-shot');
        const Sharing = await import('expo-sharing');

        const uri = await ViewShot.captureRef(cardRef, { format: 'png', quality: 1.0 });
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `${achievementTitle} - Cricket Legacy`,
          });
          shared = true;
        }
      } catch {
        // ViewShot not available (Expo Go) — fall back to text share
      }

      if (!shared) {
        // Text fallback
        try {
          const tierEmoji =
            { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }[tier] ?? '🏆';
          await Share.share({
            message: `${tierEmoji} ${achievementTitle}\n${achievementDesc}${statLine ? `\n📊 ${statLine}` : ''}\n\nPlayed as ${playerName} in Cricket Legacy — the ultimate cricket career game.\n#CricketLegacy #Cricket`,
            title: achievementTitle,
          });
        } catch {
          /* user dismissed */
        }
      }
    } finally {
      setSharing(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles2.backdrop} onPress={onDismiss}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View entering={ZoomIn.duration(350)} style={styles2.modal}>
            {/* The card to share */}
            <View ref={cardRef} collapsable={false}>
              <ShareableAchievementCard
                achievementTitle={achievementTitle}
                achievementDesc={achievementDesc}
                tier={tier}
                playerName={playerName}
                statLine={statLine}
              />
            </View>

            {/* Actions */}
            <View style={styles2.actions}>
              <Button
                label={sharing ? 'Preparing...' : '📤 Share Achievement'}
                variant="primary"
                loading={sharing}
                onPress={handleShare}
              />
              <Pressable onPress={onDismiss} style={styles2.dismissBtn}>
                <Text style={styles2.dismissText}>Close</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardBg: {
    width: 320,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.lg,
  },
  brandText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tierPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tierText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  trophyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    position: 'relative',
  },
  trophyGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.12,
  },
  achTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
    fontFamily: fonts.display,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  achDesc: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  statBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  statBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.black,
  },
  playerRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: spacing.md,
    width: '100%',
    marginBottom: spacing.sm,
  },
  playerLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  playerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.black,
    fontFamily: fonts.display,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  bottomDate: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
  },
  bottomBrand: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});

const makeModalStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    modal: {
      alignItems: 'center',
      gap: spacing.lg,
    },
    actions: {
      width: 320,
      gap: spacing.sm,
    },
    dismissBtn: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    dismissText: {
      color: colors.textFaint,
      fontSize: fontSize.sm,
      textDecorationLine: 'underline',
    },
  });
