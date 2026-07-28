import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Emblem, Screen, AppText as Text } from '../components';
import { HeroBackground } from '../components/HeroBackground';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../config/app';
import { saveSubtitle } from '../game/saveMeta';
import { useT } from '../i18n';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import { getLastPlayed, ResolvedSave } from '../storage/saveGames';
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

// ─── Continue Card ────────────────────────────────────────────────────────────

function ContinueCard({ resume, onPress }: { resume: ResolvedSave; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  // Extract snapshot data
  const save = resume.save;
  const playerName = save.userPlayerId ? save.players[save.userPlayerId]?.name : null;
  const teamName = save.userTeamId ? save.teams[save.userTeamId]?.name : null;
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : null;
  const isCareer = save.mode === 'career';
  const subtitle = saveSubtitle(save);

  // Latest match result — derive from careerWins / season data
  const lastMatch: { userWon: boolean | null } | null =
    save.careerWins != null ? { userWon: save.lastMatchWon ?? null } : null;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.continueWrapper}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.continueCard, pressed && { opacity: 0.9 }]}
      >
        <LinearGradient
          colors={['#1B4A2C', '#0F2E1B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.continueGradient}
        >
          {/* Top row */}
          <View style={styles.continueTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.continueMode}>
                {isCareer ? '🏏 PLAYER CAREER' : '📋 MANAGER CAREER'}
              </Text>
              <Text style={styles.continueName}>{playerName ?? teamName ?? 'Continue'}</Text>
              <Text style={styles.continueSub}>{subtitle}</Text>
            </View>
            <View style={styles.continueArrow}>
              <Ionicons name="play" size={18} color={colors.white} />
            </View>
          </View>

          {/* Last match snapshot */}
          {lastMatch && (
            <View style={styles.snapshotRow}>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotLabel}>Last Match</Text>
                <Text style={styles.snapshotValue} numberOfLines={1}>
                  {lastMatch.userWon ? '✅ Won' : lastMatch.userWon === false ? '❌ Lost' : '—'}
                </Text>
              </View>
              {season && (
                <View style={styles.snapshotItem}>
                  <Text style={styles.snapshotLabel}>Season</Text>
                  <Text style={styles.snapshotValue}>{season.year}</Text>
                </View>
              )}
              {save.wallet && (
                <View style={styles.snapshotItem}>
                  <Text style={styles.snapshotLabel}>Wallet</Text>
                  <Text style={styles.snapshotValue}>{save.wallet.coins} 🪙</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.resumeButton}>
            <Text style={styles.resumeButtonText}>Resume</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.black} />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Menu buttons ─────────────────────────────────────────────────────────────

function MenuButton({
  label,
  iconName,
  onPress,
  delay,
  variant = 'secondary',
}: {
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  delay: number;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const iconColor =
    variant === 'primary' ? colors.black : variant === 'ghost' ? colors.textFaint : colors.text;
  return (
    <Animated.View entering={FadeInRight.duration(320).delay(delay)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.menuBtn,
          variant === 'primary' && styles.menuBtnPrimary,
          variant === 'ghost' && styles.menuBtnGhost,
          pressed && styles.menuBtnPressed,
        ]}
      >
        <Ionicons name={iconName} size={20} color={iconColor} style={styles.menuBtnIcon} />
        <Text
          style={[
            styles.menuBtnLabel,
            variant === 'primary' && styles.menuBtnLabelPrimary,
            variant === 'ghost' && styles.menuBtnLabelGhost,
          ]}
        >
          {label}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={iconColor}
          style={{ opacity: variant === 'ghost' ? 0 : 0.5 }}
        />
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function MainMenuScreen({ navigation }: ScreenProps<'MainMenu'>) {
  const [resume, setResume] = useState<ResolvedSave | null>(null);
  const setActive = useCareer((s) => s.setActive);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const t = useT();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const last = await getLastPlayed();
        if (alive) setResume(last);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const onContinue = () => {
    if (!resume) return;
    setActive(resume.save, resume.mode, resume.slot);
    navigation.navigate(resume.mode === 'career' ? 'CareerHub' : 'ManagerHub');
  };

  const onExit = () => {
    if (Platform.OS === 'android') BackHandler.exitApp();
    else
      Alert.alert(
        'Exit',
        'iOS does not allow an app to close itself. Use the home gesture to leave.',
      );
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      {/* Hero — pure-code cricket ground, no image asset needed */}
      <HeroBackground variant="menu" style={styles.hero}>
        <LinearGradient
          colors={['transparent', 'rgba(10,25,18,0.65)', colors.bg]}
          style={styles.heroScrim}
        />
        <Animated.View entering={FadeIn.duration(600)} style={styles.heroContent}>
          <Emblem size={68} />
          <Text style={styles.title}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        </Animated.View>
      </HeroBackground>

      {/* Continue card (replaces plain button) */}
      {resume ? <ContinueCard resume={resume} onPress={onContinue} /> : null}

      {/* Main menu items */}
      <View style={styles.menu}>
        <MenuButton
          label={t('menu.newGame')}
          iconName="add-circle"
          variant="primary"
          delay={60}
          onPress={() => navigation.navigate('NewGame')}
        />
        <MenuButton
          label={t('menu.savedGames')}
          iconName="folder-open"
          delay={120}
          onPress={() => navigation.navigate('SavedGames')}
        />
        <MenuButton
          label="Store"
          iconName="storefront"
          delay={180}
          onPress={() => navigation.navigate('Purchase')}
        />
        <MenuButton
          label={t('menu.login')}
          iconName="person-circle"
          delay={240}
          onPress={() => navigation.navigate('Login')}
        />
        <MenuButton
          label={t('menu.settings')}
          iconName="settings"
          delay={300}
          onPress={() => navigation.navigate('Settings')}
        />
        <MenuButton
          label={t('menu.exit')}
          iconName="exit-outline"
          variant="ghost"
          delay={360}
          onPress={onExit}
        />
      </View>

      <Animated.View entering={FadeIn.duration(500).delay(400)}>
        <Text style={styles.version}>
          {APP_NAME} · v{APP_VERSION}
        </Text>
      </Animated.View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: {
      height: 280,
      borderRadius: radius.lg,
      overflow: 'hidden',
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      justifyContent: 'flex-end',
    },
    heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 },

    // Menu buttons (icon-based, premium feel)
    menuBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.soft,
    },
    menuBtnPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    menuBtnGhost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      elevation: 0,
      shadowOpacity: 0,
    },
    menuBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    menuBtnIcon: { marginRight: spacing.md },
    menuBtnLabel: {
      flex: 1,
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
    menuBtnLabelPrimary: { color: colors.black },
    menuBtnLabelGhost: { color: colors.textFaint },
    heroContent: { alignItems: 'center', paddingBottom: spacing.xl, paddingHorizontal: spacing.lg },
    title: {
      color: colors.accent,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      letterSpacing: 3,
      marginTop: spacing.md,
    },
    tagline: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, letterSpacing: 0.8 },

    // Continue card
    continueWrapper: { marginBottom: spacing.lg },
    continueCard: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.primaryLight,
      ...shadow.card,
    },
    continueGradient: { padding: spacing.lg },
    continueTop: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    continueMode: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    continueName: {
      color: colors.white,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    continueSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 3 },
    continueArrow: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.md,
      flexShrink: 0,
    },
    snapshotRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255,255,255,0.1)',
      paddingTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    snapshotItem: { flex: 1, minWidth: 82 },
    snapshotLabel: {
      color: 'rgba(255,255,255,0.45)',
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    snapshotValue: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    resumeButton: {
      minHeight: 42,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      alignSelf: 'stretch',
    },
    resumeButtonText: {
      color: colors.black,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      textAlign: 'center',
    },

    menu: { gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
    version: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginBottom: spacing.lg,
      letterSpacing: 1.5,
    },
  });
