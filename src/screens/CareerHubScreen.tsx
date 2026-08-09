/**
 * CareerHubScreen — the player-career home hub.
 *
 * Each HubTabBar tab now shows a genuinely different page of content instead
 * of navigating to a separate screen. The "Home" tab shows only the 4-5 most
 * important cards (matchday CTA, player hero, live-ops, league position). The
 * other tabs (Stats, Narrative, Progress, Profile) surface depth without
 * overwhelming the home view.
 */
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  BackHandler,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { playHaptic } from '../audio';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  AchievementToast,
  Button,
  Card,
  CareerSpotlight,
  CupCard,
  GlassSurface,
  HubTabBar,
  LeagueTable,
  LiveOpsCards,
  LockedFeatureCard,
  MechanicInfoButton,
  ModeGuideModal,
  NewspaperModal,
  ProgressBar,
  RewardModal,
  RewardModalData,
  RivalryBadge,
  Screen,
  ScreenHeader,
  WalletBar,
} from '../components';
import { AppText as Text } from '../components/AppText';
import { ContextualOffer, OfferBanner, OfferKind } from '../components/ContextualOffer';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { StarterPackModal } from '../components/StarterPackModal';
import { kitColorHex } from '../data/cosmetics';
import { COUNTRIES, getCountry } from '../data/countries';
import { ECONOMY } from '../data/gameConfig';
import type { NewspaperStory, PlayerStats } from '../domain/types';
import { computeOverall } from '../engine/rating';
import {
  ACHIEVEMENTS,
  getAchievement,
  MAX_GAMERSCORE,
  totalGamerscore,
} from '../game/achievements';
import {
  CAREER_PATH_LABEL,
  careerSelectionDecision,
  careerPathProgress,
  careerTier,
  isCareerToManagerEligible,
  managerRepFromCareer,
  nationalState,
  nextCareerPathLabel,
  TIER_LABEL,
} from '../game/career';
import { isInternationalFixture } from '../game/intlCalendar';
import { matchDecisionAuthority } from '../game/matchAuthority';
import { ARCHETYPE_PROFILES } from '../game/careerArchetypes';
import {
  canRetire,
  careerEpitaph,
  careerLegacyScore,
  shouldPromptRetirement,
} from '../game/careerEvents';
import { playerIdentityLine } from '../game/careerExperience';
import { CareerStepType, resolveNextCareerStep } from '../game/careerStep';
import { areAdsRemoved, fixtureEnergyCost } from '../game/economy';
import { renderText } from '../game/narrative';
import { seasonAwards } from '../game/progression';
import { franchiseAuctionGate, seniorProfessionalFeaturesUnlocked } from '../game/readiness';
import { rivalComparison } from '../game/rivalry';
import { PlayerCalendarChoice } from '../game/playerCalendar';
import { nextUserFixtureId, nextUserFixturesByCompetition, standings } from '../game/season';
import { emptyStats } from '../game/stats';
import { trainingAttributeCeiling, youthOpponentQuality } from '../game/youthBalance';
import { careerPlayingTeamId } from '../game/youthFixtures';
import { ScreenProps } from '../navigation';
import { accountPurchases, ads, analytics } from '../services';
import { useCareer } from '../state/careerStore';
import { useSettings } from '../state/settingsStore';
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

const ROLE_LABEL: Record<string, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALLROUNDER: 'All-Rounder',
  WK_BATTER: 'Wicket-Keeper',
};

type HubPage = 'home' | 'stats' | 'narrative' | 'progress' | 'profile';

const EMPTY_PRESS_ARCHIVE: readonly NewspaperStory[] = [];

const PLAYER_GUIDE_STEPS = [
  {
    icon: 'home' as const,
    title: 'Follow the next action',
    body: 'Home prioritises the one thing blocking your career: a story decision, training, recovery or the next match.',
    action: 'Use the highlighted action on Home before exploring the other tabs.',
  },
  {
    icon: 'fitness' as const,
    title: 'Train with a purpose',
    body: 'Training improves attributes but uses coins and recovery. Form, fitness and confidence affect how reliably you perform.',
    action: 'Train your role strengths, then stop when fatigue or cost outweighs the next gain.',
  },
  {
    icon: 'game-controller' as const,
    title: 'Play your role',
    body: 'In matches, choose a batting stance or bowling plan. The simulation pauses for guides and decisions, and speed only changes presentation pace.',
    action:
      'Read the score situation, set your approach, and change it when the required rate or wickets demand it.',
  },
  {
    icon: 'trending-up' as const,
    title: 'Earn selection and progress',
    body: 'Ability, form, coach trust, condition and format readiness drive selection. Match output then drives contracts and pathway promotions.',
    action:
      'Open Progress after each match to see what moved and what your next milestone requires.',
  },
  {
    icon: 'person' as const,
    title: 'Review your career',
    body: 'Stats tracks performance, Story holds career decisions, and Profile keeps identity, records, equipment and legacy in one place.',
    action: 'Return to this guide from the Profile tab whenever you need a refresher.',
  },
] as const;

export function CareerHubScreen({ navigation }: ScreenProps<'CareerHub'>) {
  const {
    save,
    refreshEnergy,
    advanceSeason,
    claimDaily,
    retire,
    playCupTie,
    acceptAuctionOffer,
    declineAuction,
    contractStatus,
    renewUserContract,
    persist,
    markFlagSeen,
    lastPromotion,
    clearPromotion,
    setTargetFixture,
    setCareerRestNext,
    markNewspaperSeen,
    resolvePlayerWeek,
    declareInternationalCountry,
    requestDomesticCountryMove,
    pendingStory,
    pendingAchievementIds,
    clearPendingAchievements,
    dismissStarterPack,
  } = useCareer(
    useShallow((s) => ({
      save: s.save,
      refreshEnergy: s.refreshEnergy,
      advanceSeason: s.advanceSeason,
      claimDaily: s.claimDaily,
      retire: s.retire,
      playCupTie: s.playCupTie,
      acceptAuctionOffer: s.acceptAuctionOffer,
      declineAuction: s.declineAuction,
      contractStatus: s.contractStatus,
      renewUserContract: s.renewUserContract,
      persist: s.persist,
      markFlagSeen: s.markFlagSeen,
      lastPromotion: s.lastPromotion,
      clearPromotion: s.clearPromotion,
      setTargetFixture: s.setTargetFixture,
      setCareerRestNext: s.setCareerRestNext,
      markNewspaperSeen: s.markNewspaperSeen,
      resolvePlayerWeek: s.resolvePlayerWeek,
      declareInternationalCountry: s.declareInternationalCountry,
      requestDomesticCountryMove: s.requestDomesticCountryMove,
      pendingStory: s.pendingStory,
      pendingAchievementIds: s.pendingAchievementIds,
      clearPendingAchievements: s.clearPendingAchievements,
      dismissStarterPack: s.dismissStarterPack,
    })),
  );
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const compact = useWindowDimensions().width < 480;
  const [page, setPage] = useState<HubPage>('home');
  const [canClaimDaily, setCanClaimDaily] = useState(false);
  const [rewardModal, setRewardModal] = useState<RewardModalData | null>(null);
  const [contractFlash, setContractFlash] = useState<string | null>(null);
  const [activeOffer, setActiveOffer] = useState<OfferKind | null>(null);
  const [dismissedOffers, setDismissedOffers] = useState<Set<string>>(new Set());
  const dismissOffer = (key: string) => {
    setDismissedOffers((prev) => new Set([...prev, key]));
    setActiveOffer(null);
  };
  const [showStarterPack, setShowStarterPack] = useState(false);
  const starterPackShownRef = useRef(false);
  const [toastIdx, setToastIdx] = useState(0);
  const [selectedNewspaper, setSelectedNewspaper] = useState<NewspaperStory | null>(null);
  const prevPendingLenRef = useRef(-1);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Leave career?',
          'Leaving now returns to the main menu. Your save is kept, but this matchday flow will be interrupted.',
          [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => navigation.navigate('MainMenu') },
          ],
        );
        return true;
      });
      return () => sub.remove();
    }, [navigation]),
  );

  useEffect(() => {
    if (
      pendingAchievementIds.length !== prevPendingLenRef.current &&
      pendingAchievementIds.length > 0
    ) {
      setToastIdx(0);
    }
    prevPendingLenRef.current = pendingAchievementIds.length;
  }, [pendingAchievementIds]);

  const currentToastId = pendingAchievementIds[toastIdx] ?? null;
  const currentToast = currentToastId ? (getAchievement(currentToastId) ?? null) : null;

  const onDismissToast = useCallback(() => {
    setToastIdx((i) => {
      if (i + 1 < pendingAchievementIds.length) return i + 1;
      clearPendingAchievements();
      return 0;
    });
  }, [pendingAchievementIds.length, clearPendingAchievements]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      refreshEnergy();
      const today = Math.floor(Date.now() / 86_400_000);
      setCanClaimDaily(useCareer.getState().save?.lastDailyClaim !== today);
      const currentSave = useCareer.getState().save;
      // Ad monetization: on returning to the hub, occasionally show an
      // interstitial (persistently capped at two per rolling hour). Suppressed for
      // players who removed ads — permanently (VIP) or via the timed Starter
      // Pack trial — and withheld until a few matches in so a brand-new player
      // is never greeted by an ad.
      const matchesPlayed = currentSave?.userPlayerId
        ? (currentSave.players[currentSave.userPlayerId]?.careerStats?.matches ?? 0)
        : 0;
      if (matchesPlayed >= 3) {
        void ads.maybeShowInterstitial(!areAdsRemoved(currentSave?.entitlements));
      }

      // The modest starter offer unlocks only after a completed match. Its
      // persisted 24-hour window never resets through navigation or restart.
      const hasRemoveAds = currentSave?.entitlements?.removeAds;
      const starterUnlockedAt = currentSave?.experience?.starterPackUnlockedAt;
      const starterDismissedAt = currentSave?.experience?.starterPackDismissedAt;
      const starterStillActive =
        Boolean(starterUnlockedAt) &&
        Date.now() < (starterUnlockedAt ?? 0) + 24 * 60 * 60 * 1000 &&
        !currentSave?.firstPurchaseDone;
      void accountPurchases.hasStarterPackPurchase().then((starterPackOwned) => {
        if (
          active &&
          !starterPackOwned &&
          !hasRemoveAds &&
          !starterDismissedAt &&
          starterStillActive &&
          !starterPackShownRef.current
        ) {
          starterPackShownRef.current = true;
          analytics.logEvent(analytics.EVT.STARTER_PACK_SHOWN);
          setShowStarterPack(true);
        }
      });
      return () => {
        active = false;
      };
    }, [refreshEnergy]),
  );

  const goMenu = useCallback(() => navigation.navigate('MainMenu'), [navigation]);

  const hapticTap = async () => {
    try {
      playHaptic('impact-light');
    } catch {
      /* optional */
    }
  };

  const handlePlayMatch = async () => {
    try {
      playHaptic('impact-medium');
    } catch {
      /* optional */
    }
    const activeSave = useCareer.getState().save;
    const nextId = activeSave ? nextUserFixtureId(activeSave) : undefined;
    const isInternational =
      Boolean(nextId) && isInternationalFixture(activeSave?.fixtures[nextId!]);
    navigation.navigate('Match', isInternational ? { intl: true } : undefined);
  };

  const handleClaimDaily = async () => {
    try {
      playHaptic('notify-success');
    } catch {
      /* optional */
    }
    const reward = claimDaily();
    if (reward.ok) {
      setCanClaimDaily(false);
      setRewardModal({
        title: 'Daily reward claimed',
        subtitle: `${reward.streak} day${reward.streak === 1 ? '' : 's'} in a row`,
        items: reward.items,
        balances: [
          `Coins: ${reward.previousCoins.toLocaleString()} -> ${reward.newCoins.toLocaleString()}`,
          `Gems: ${reward.previousGems.toLocaleString()} -> ${reward.newGems.toLocaleString()}`,
        ],
      });
    }
  };

  const handleTabChange = (p: HubPage) => {
    hapticTap();
    setPage(p);
  };

  const dismissedTips = useSettings((s) => s.dismissedTips);
  const dismissTip = useSettings((s) => s.dismissTip);
  const showCareerGuide = !dismissedTips.includes('career_hub_guide');
  const pressArchive = save?.experience?.mediaScrapbook ?? EMPTY_PRESS_ARCHIVE;
  const pendingPressId = save?.experience?.pendingNewspaperId;
  const stockUnlocked = save ? seniorProfessionalFeaturesUnlocked(save) : false;
  const stockUnlockSeen = save?.flags?.stockUnlockSeen;

  useEffect(() => {
    if (!pendingPressId) return;
    const pending = pressArchive.find((story) => story.id === pendingPressId);
    if (pending) setSelectedNewspaper(pending);
  }, [pendingPressId, pressArchive]);

  useEffect(() => {
    if (!stockUnlocked || stockUnlockSeen) return;
    markFlagSeen('stockUnlockSeen');
    Alert.alert(
      'Stock Market unlocked!',
      'Now that you are a senior pro, you can invest a slice of your earnings in the market. Grow your wealth between matches, but remember that values can go down as well as up.',
      [{ text: 'Got it' }],
    );
  }, [markFlagSeen, stockUnlocked, stockUnlockSeen]);

  if (!save || !save.userPlayerId || !save.players[save.userPlayerId]) {
    return (
      <Screen>
        <ScreenHeader title="Career" onBack={goMenu} />
        <Text style={styles.msg}>No active career.</Text>
        <Button label="Back to Menu" variant="secondary" onPress={goMenu} />
      </Screen>
    );
  }

  const user = save.players[save.userPlayerId];
  const userOverall = computeOverall(user);
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const stats = user.careerStats ?? emptyStats();
  const domesticStats = user.domesticStats ?? emptyStats();
  const internationalStats = user.internationalStats ?? emptyStats();

  // Memoize CPU-heavy computations so they don't re-run on every render tick.
  // These are pure reads of the save blob — only recalculate when save changes.
  const table = standings(save);
  const fixtureId = nextUserFixtureId(save);
  const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
  const matchAuthority = matchDecisionAuthority(save, fixture);
  const activePathTeamId = careerPlayingTeamId(save, fixtureId);
  const activePathTeam = activePathTeamId ? save.teams[activePathTeamId] : undefined;
  const fixtureTeamId = isInternationalFixture(fixture) ? fixture?.homeTeamId : activePathTeamId;
  const fixtureTeam = fixtureTeamId ? save.teams[fixtureTeamId] : team;
  const nationalCountryId =
    save.playerCareerResources?.cappedCountry ??
    save.playerCareerResources?.declaredCountry ??
    user.nationality;
  const countryName = getCountry(nationalCountryId)?.name ?? 'Your country';
  const restRequested = Boolean(
    fixtureId && save.playerCareerResources?.requestedRestFixtureId === fixtureId,
  );
  const selectionOutlook = fixture
    ? isInternationalFixture(fixture)
      ? {
          selected: true,
          reason:
            (fixture.competitionId
              ? save.playerCareerResources?.internationalSelections?.[fixture.competitionId]?.reason
              : undefined) ??
            `Selected for ${countryName}. National duty takes priority over a same-date domestic fixture.`,
        }
      : careerSelectionDecision(save, fixture.format, fixture.id)
    : null;
  const matchEnergyCost = fixture ? fixtureEnergyCost(fixture) : ECONOMY.energyPerMatch;
  const canPlay = selectionOutlook?.selected === false || save.wallet.energy >= matchEnergyCost;
  const opponentId = fixture
    ? fixture.homeTeamId === fixtureTeamId
      ? fixture.awayTeamId
      : fixture.homeTeamId
    : undefined;
  const competitionOptions = nextUserFixturesByCompetition(save);
  const awards = seasonAwards(save);
  const nat = nationalState(save);
  const tier = careerTier(save, user);
  const storyN = save.story?.pendingEventIds.length ?? 0;
  const storyPreview = pendingStory();
  const offers = save.auctionOffers ?? [];
  const seniorProUnlocked = seniorProfessionalFeaturesUnlocked(save);
  const contract = seniorProUnlocked ? contractStatus() : null;
  const rivalCmp = rivalComparison(save);
  const gamerscore = totalGamerscore(save);
  const earnedCount = (save.achievements ?? []).length;
  const inboxUnread = (save.inbox ?? []).filter((message) => !message.read).length;
  const nextStep = resolveNextCareerStep(save, {
    pendingPromotion: Boolean(lastPromotion?.promoted),
  });
  const calendarEvent = nextStep.mode === 'career' ? nextStep.calendarEvent : undefined;
  const identityLine = playerIdentityLine(save);
  const lastImpact = save.experience?.lastMatchImpact;
  const latestPress = pressArchive[pressArchive.length - 1];
  const primaryIsStory =
    nextStep.mode === 'career' && nextStep.type === CareerStepType.STORY_EVENT_REQUIRED;
  const primaryIsCalendar = Boolean(
    nextStep.mode === 'career' &&
    nextStep.type === CareerStepType.TRAINING_MANDATORY &&
    calendarEvent,
  );
  const resolveCalendar = (choice?: PlayerCalendarChoice) => {
    const result = resolvePlayerWeek(choice);
    if (result.ok && result.outcome) {
      setContractFlash(result.outcome);
      setTimeout(() => setContractFlash(null), 2400);
    } else if (result.reason) {
      Alert.alert('Calendar', result.reason);
    }
  };
  const runPrimaryAction = () => {
    switch (nextStep.action) {
      case 'ACKNOWLEDGE_PROMOTION':
        clearPromotion();
        break;
      case 'OPEN_STORY':
        navigation.navigate('Narrative');
        break;
      case 'RESOLVE_CALENDAR':
        resolveCalendar();
        break;
      case 'REFILL_ENERGY':
        navigation.navigate('Purchase');
        break;
      case 'PLAY_MATCH':
      case 'SIMULATE_MATCH':
        void handlePlayMatch();
        break;
      case 'ADVANCE_SEASON':
        advanceSeason();
        break;
      case 'OPEN_TRANSFERS':
        navigation.navigate('Transfers');
        break;
      case 'OPEN_TRAINING':
        navigation.navigate('Training');
        break;
      default:
        navigation.navigate('PlayerProfile', { playerId: user.id });
    }
  };

  const onSaveExit = async () => {
    useCareer.getState().scheduleReminders();
    await persist();
    goMenu();
  };

  const onRetire = () => {
    Alert.alert(
      'Retire from cricket?',
      'This ends the career for good. You can begin again with a protégé (New Game+).',
      [
        { text: 'Play on', style: 'cancel' },
        { text: 'Retire', style: 'destructive', onPress: () => retire() },
      ],
    );
  };

  // ---------- RETIRED ----------
  if (user.retired || save.flags?.retired) {
    const legacy = (save.newGamePlus ?? 0) + 1;
    const legacyScore = careerLegacyScore(save).score;
    const timeline = save.timeline ?? [];
    return (
      <Screen scroll gradient={gradients.pitch}>
        <ScreenHeader title="A Career Remembered" onBack={goMenu} />
        <View>
          <Card style={styles.retireCard}>
            <View style={styles.retireHeroRow}>
              <PlayerAvatar
                name={user.name}
                role={user.role}
                primaryColor={team?.primaryColor}
                secondaryColor={team?.secondaryColor}
                kitColor={kitColorHex(save.cosmetics?.kit)}
                customization={save.cosmetics?.avatarCustomization}
                config={save.cosmetics?.avatarConfig}
                profileFrame={save.cosmetics?.profileFrame}
                size="lg"
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.retireName}>{user.name}</Text>
                <Text style={styles.retireRole}>
                  {ROLE_LABEL[user.role] ?? user.role} · {TIER_LABEL[tier]}
                </Text>
                <Text style={styles.retireSeason}>
                  🏏 {stats.matches} matches · {stats.runs} runs · {stats.wickets} wickets
                </Text>
              </View>
            </View>
            <View style={styles.epitaphBox}>
              <Text style={styles.epitaphQuote}>&ldquo;{careerEpitaph(save)}&rdquo;</Text>
            </View>
            {(user.awards ?? []).length ? (
              <View style={styles.honours}>
                {(user.awards ?? []).slice(0, 10).map((a, i) => (
                  <View
                    key={i}
                    style={styles.honourPill}
                  >
                    <Text style={styles.honour}>🏅 {a}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        </View>
        {timeline.length > 0 ? (
          <>
            <Text style={styles.section}>The Journey</Text>
            <Card style={styles.timelineCard}>
              {timeline.slice(0, 20).map((t, i) => (
                <View
                  key={i}
                  style={styles.tlRow}
                >
                  <View style={styles.tlLeft}>
                    <View style={[styles.tlDot, { backgroundColor: colors.accent }]} />
                    {i < timeline.length - 1 && <View style={styles.tlLine} />}
                  </View>
                  <View style={styles.tlContent}>
                    <Text style={styles.tlYear}>{t.year}</Text>
                    <Text style={styles.tlText}>{renderText(t.text, save)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}
        <Text style={styles.section}>Career Statistics</Text>
        <View style={styles.statGrid}>
          <StatCard label="Matches" value={String(stats.matches)} color={colors.primaryLight} />
          <StatCard label="Runs" value={String(stats.runs)} color={colors.accent} />
          <StatCard label="High Score" value={String(stats.highScore)} color={colors.accent} />
          <StatCard
            label="Avg"
            value={stats.matches > 0 ? (stats.runs / Math.max(1, stats.matches)).toFixed(1) : '0'}
            color={colors.success}
          />
          <StatCard label="Wickets" value={String(stats.wickets)} color={colors.info} />
          <StatCard label="Best" value={String(stats.bestBowling)} color={colors.info} />
          <StatCard label="Wins" value={String(save.careerWins ?? 0)} color={colors.success} />
          <StatCard label="Losses" value={String(save.careerLosses ?? 0)} color={colors.danger} />
          <StatCard label="Draws" value={String(save.careerDraws ?? 0)} color={colors.textMuted} />
        </View>
        <Button
          label="Open Legacy Museum"
          variant="secondary"
          style={{ marginTop: spacing.xl }}
          onPress={() => navigation.navigate('PlayerLife', { initialTab: 'legacy' })}
        />
        <Button
          label="Share Career Legacy"
          variant="secondary"
          style={{ marginTop: spacing.md }}
          onPress={() => {
            void Share.share({
              title: `${user.name} - Cricket Legacy`,
              message: [
                `${user.name} | ${playerIdentityLine(save)}`,
                `${stats.matches} matches | ${stats.runs} runs | ${stats.wickets} wickets`,
                `Legacy score ${legacyScore}/100`,
                careerEpitaph(save),
              ].join('\n'),
            });
          }}
        />
        <Button
          label="🌱 Begin a Protégé's Career (New Game+)"
          variant="gold"
          style={{ marginTop: spacing.md }}
          onPress={() => navigation.navigate('PlayerCreation', { legacy, legacyScore })}
        />

        {/* Career-to-Manager transition */}
        {save.careerToManagerEligible &&
          (() => {
            const cs = user.careerStats;
            const mgmtRep = cs
              ? managerRepFromCareer({
                  runs: cs.runs,
                  wickets: cs.wickets,
                  caps: save.userCaps ?? 0,
                  seasons: save.careerSeasons ?? 0,
                })
              : 50;
            const eligible = cs
              ? isCareerToManagerEligible({
                  runs: cs.runs,
                  wickets: cs.wickets,
                  caps: save.userCaps ?? 0,
                  seasons: save.careerSeasons ?? 0,
                })
              : false;
            if (!eligible) return null;
            return (
              <Button
                label="📋 Step into Management"
                variant="secondary"
                style={{ marginTop: spacing.md }}
                onPress={() => {
                  if (!user.nationality) return;
                  Alert.alert(
                    'Begin a Management Career',
                    `Your legendary career has earned you a reputation of ${mgmtRep}/100 in the coaching world. Choose your starting club in the next screen.`,
                    [
                      { text: 'Not yet', style: 'cancel' },
                      {
                        text: 'Step up',
                        onPress: () => navigation.navigate('TeamSelect', { slot: undefined }),
                      },
                    ],
                  );
                }}
              />
            );
          })()}

        <Button
          label="Back to Menu"
          variant="ghost"
          style={{ marginTop: spacing.md }}
          onPress={goMenu}
        />
      </Screen>
    );
  }

  // ── Tab content helpers ────────────────────────────────────────────────────

  const renderHomeTab = () => (
    <>
      <View>
        <GlassSurface highlighted intensity={0.62} style={styles.nextChapterHero}>
          <Text style={styles.nextChapterEyebrow}>{identityLine}</Text>
          <Text style={styles.nextChapterTitle} numberOfLines={2}>
            {primaryIsStory && storyPreview?.title ? storyPreview.title : nextStep.title}
          </Text>
          <Text style={styles.nextChapterReason} numberOfLines={2}>
            {primaryIsStory && storyPreview?.speaker
              ? `${storyPreview.speaker} is waiting for your answer.`
              : nextStep.detail}
          </Text>
          {fixture && opponentId ? (
            <View style={styles.nextFixtureStrip}>
              <View style={styles.nextFixtureCopy}>
                <Text style={styles.nextFixtureTeams} numberOfLines={1}>
                  {fixtureTeam?.shortName} v {save.teams[opponentId]?.shortName}
                </Text>
                <Text
                  style={[
                    styles.nextFixtureStatus,
                    { color: selectionOutlook?.selected ? colors.success : colors.warning },
                  ]}
                  numberOfLines={1}
                >
                  {selectionOutlook?.selected ? 'Selected' : 'Bench / rest'} |{' '}
                  {selectionOutlook?.selected ? `${matchEnergyCost} energy` : 'No energy cost'}
                </Text>
              </View>
              <MechanicInfoButton topicId="selection-formula" size={34} />
            </View>
          ) : null}
          {primaryIsCalendar &&
          (calendarEvent?.kind === 'EXAM' ||
            calendarEvent?.kind === 'TRAINING' ||
            calendarEvent?.kind === 'NCA_CAMP') ? (
            <View style={styles.calendarChoiceRow}>
              <Button
                label={
                  calendarEvent.kind === 'EXAM'
                    ? 'Study'
                    : calendarEvent.kind === 'NCA_CAMP'
                      ? 'Attend camp'
                      : 'Skill work'
                }
                variant="gold"
                style={styles.calendarChoiceButton}
                onPress={() =>
                  resolveCalendar(
                    calendarEvent.kind === 'EXAM'
                      ? 'STUDY'
                      : calendarEvent.kind === 'NCA_CAMP'
                        ? 'ATTEND'
                        : 'SKILL',
                  )
                }
              />
              <Button
                label={
                  calendarEvent.kind === 'EXAM'
                    ? 'Extra nets'
                    : calendarEvent.kind === 'NCA_CAMP'
                      ? 'Recover'
                      : 'Fitness'
                }
                variant="secondary"
                style={styles.calendarChoiceButton}
                onPress={() =>
                  resolveCalendar(
                    calendarEvent.kind === 'EXAM'
                      ? 'TRAIN'
                      : calendarEvent.kind === 'NCA_CAMP'
                        ? 'REST'
                        : 'FITNESS',
                  )
                }
              />
            </View>
          ) : (
            <Button
              label={
                nextStep.action === 'OPEN_STORY'
                  ? 'Open story'
                  : nextStep.action === 'PLAY_MATCH'
                    ? 'Play match'
                    : nextStep.action === 'SIMULATE_MATCH'
                      ? 'Continue fixture'
                      : nextStep.action === 'REFILL_ENERGY'
                        ? 'Restore energy'
                        : nextStep.action === 'ACKNOWLEDGE_PROMOTION'
                          ? 'Continue'
                          : nextStep.action === 'ADVANCE_SEASON'
                            ? 'Advance season'
                            : nextStep.action === 'OPEN_TRAINING'
                              ? 'Open training'
                              : 'Continue'
              }
              variant="gold"
              style={{ marginTop: spacing.md }}
              onPress={runPrimaryAction}
            />
          )}
          {fixture && opponentId ? (
            <View style={styles.nextFixtureActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCareerRestNext(!restRequested)}
                style={styles.heroTextAction}
              >
                <Text style={styles.heroTextActionLabel}>
                  {restRequested ? 'Cancel planned rest' : 'Plan rest'}
                </Text>
              </Pressable>
              {matchAuthority.canControlTeam ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('Squad')}
                  style={styles.heroTextAction}
                >
                  <Text style={styles.heroTextActionLabel}>Captain&apos;s XI</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </GlassSurface>
      </View>

      {calendarEvent?.kind === 'TRANSFER_WINDOW' ? (
        <Card style={styles.countryMoveCard}>
          <Text style={styles.tierLabel}>Domestic country offers</Text>
          <Text style={styles.note}>
            A move starts next season in the same tier with a new country-specific club pyramid.
          </Text>
          <View style={styles.countryChipGrid}>
            {COUNTRIES.filter(
              (country) => country.id !== save.playerCareerResources?.domesticCountry,
            ).map((country) => {
              const pending = save.pendingDomesticCountry === country.id;
              return (
                <Pressable
                  key={country.id}
                  accessibilityRole="button"
                  style={[styles.countryChip, pending && styles.countryChipSelected]}
                  onPress={() => {
                    const result = requestDomesticCountryMove(country.id);
                    if (!result.ok && result.reason) Alert.alert('Country move', result.reason);
                  }}
                >
                  <Text style={[styles.countryChipText, pending && styles.countryChipTextSelected]}>
                    {pending ? `Moving to ${country.name}` : country.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {lastImpact ? (
        <View style={[styles.impactStrip, compact && styles.impactStripCompact]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.impactEyebrow}>LAST MATCH</Text>
            <Text style={styles.impactTitle}>{lastImpact.headline}</Text>
            <Text style={styles.impactText} numberOfLines={2}>
              {lastImpact.narrative}
            </Text>
          </View>
          <View style={[styles.impactChanges, compact && styles.impactChangesCompact]}>
            {lastImpact.changes.slice(0, 2).map((change) => (
              <Text
                key={change.label}
                style={[
                  styles.impactDelta,
                  { color: change.delta >= 0 ? colors.success : colors.warning },
                ]}
              >
                {change.label} {change.delta >= 0 ? '+' : ''}
                {change.delta}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {latestPress ? (
        <Card style={styles.pressClip} onPress={() => setSelectedNewspaper(latestPress)}>
          <Text style={styles.pressClipKicker}>{latestPress.kicker}</Text>
          <Text style={styles.pressClipHeadline} numberOfLines={2}>
            {latestPress.headline}
          </Text>
          <Text style={styles.pressClipBody} numberOfLines={3}>
            {latestPress.subheadline}
          </Text>
        </Card>
      ) : null}

      {/* Notification bell */}
      {inboxUnread > 0 && (
        <Pressable
          style={styles.inboxBanner}
          onPress={() => {
            hapticTap();
            navigation.navigate('NotificationInbox');
          }}
        >
          <Text style={styles.inboxBannerText}>
            🔔 {inboxUnread} new message{inboxUnread > 1 ? 's' : ''}
          </Text>
          <Text style={styles.inboxBannerArrow}>→</Text>
        </Pressable>
      )}

      {/* Daily reward */}
      {canClaimDaily && (
        <View>
          <Button
            label="🎁 Claim daily reward"
            variant="gold"
            style={{ marginTop: spacing.md }}
            onPress={handleClaimDaily}
          />
        </View>
      )}

      {/* Win streak badge + streak protection offer */}
      {(save.winStreak ?? 0) >= 3 && (
        <View style={styles.streakBadge}>
          <Text style={styles.streakFire}>🔥</Text>
          <Text style={styles.streakText}>{save.winStreak} match win streak!</Text>
        </View>
      )}

      {/* Streak at risk — show protection offer if high streak and low energy */}
      {!dismissedOffers.has('streak') && (save.winStreak ?? 0) >= 5 && !canPlay && (
        <OfferBanner
          kind="streak_protection"
          streakDays={save.winStreak}
          onPress={() => {
            analytics.logEvent(analytics.EVT.OFFER_SHOWN, { kind: 'streak_protection' });
            setActiveOffer('streak_protection');
          }}
          onDismiss={() => dismissOffer('streak')}
        />
      )}

      {/* Energy empty offer — shown when out of energy with a match available */}
      {!dismissedOffers.has('energy') && !canPlay && !!fixture && (
        <OfferBanner
          kind="energy_empty"
          onPress={() => {
            analytics.logEvent(analytics.EVT.OFFER_SHOWN, { kind: 'energy_empty' });
            setActiveOffer('energy_empty');
          }}
          onDismiss={() => dismissOffer('energy')}
        />
      )}

      {/* Auction offers */}
      {offers.length > 0 && (
        <Card style={styles.auctionCard}>
          <Text style={styles.auctionTitle}>🏏 Franchise Auction</Text>
          <Text style={styles.note}>
            Clubs are bidding for your signature. Choose your next move.
          </Text>
          {offers.map((o) => (
            <View key={o.teamId} style={styles.offerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.offerTeam} numberOfLines={1}>
                  {save.teams[o.teamId]?.name ?? 'Interested club'}
                </Text>
                <Text style={styles.offerMeta}>
                  ₹{Math.round(o.wagePromise / 52000)}k/wk · +{o.signingBonus.toLocaleString()}{' '}
                  bonus · ₹{(o.fee / 1000).toFixed(0)}k fee
                </Text>
              </View>
              <Button
                label="Sign"
                size="sm"
                fullWidth={false}
                onPress={async () => {
                  await hapticTap();
                  acceptAuctionOffer(o.teamId);
                }}
              />
            </View>
          ))}
          <Button
            label="Stay at my club"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={declineAuction}
          />
        </Card>
      )}

      {/* Contract renewal — now with negotiation */}
      {contract?.expiring && !contractFlash ? (
        <Card style={styles.auctionCard}>
          <Text style={styles.auctionTitle}>📝 Contract Renewal</Text>
          <Text style={styles.note}>
            Your deal is up. The club offers a {contract.offer.years}-year extension at{' '}
            {contract.offer.wage > 0
              ? `₹${Math.round(contract.offer.wage / 52000)}k/week`
              : 'market rate'}
            {contract.offer.signingBonus > 0
              ? ` + ${contract.offer.signingBonus.toLocaleString()} coins signing bonus`
              : ''}
            .
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              label="💬 Negotiate"
              variant="primary"
              fullWidth={false}
              style={{ flex: 1 }}
              onPress={() => navigation.navigate('ContractNegotiation')}
            />
            <Button
              label={`Sign`}
              variant="secondary"
              fullWidth={false}
              style={{ flex: 0, minWidth: 72 }}
              onPress={async () => {
                try {
                  playHaptic('notify-success');
                } catch {
                  /* optional */
                }
                const r = renewUserContract();
                if (r.ok)
                  setContractFlash(`Signed! +${r.bonus.toLocaleString()} coins in the bank.`);
              }}
            />
          </View>
        </Card>
      ) : contractFlash ? (
        <Card style={styles.auctionCard}>
          <Text style={styles.note}>{contractFlash}</Text>
        </Card>
      ) : null}

      {/* Hero player card with avatar */}
      <View>
        <Card
          style={[styles.playerCard, compact && styles.playerCardCompact]}
          onPress={() => navigation.navigate('PlayerProfile', { playerId: user.id })}
        >
          <View style={styles.playerAvatarWrap}>
            <PlayerAvatar
              name={user.name}
              role={user.role}
              primaryColor={team?.primaryColor}
              secondaryColor={team?.secondaryColor}
              kitColor={kitColorHex(save.cosmetics?.kit)}
              customization={save.cosmetics?.avatarCustomization}
              config={save.cosmetics?.avatarConfig}
              profileFrame={save.cosmetics?.profileFrame}
              size="lg"
              showRole
            />
          </View>
          <View style={[styles.playerIdentity, compact && styles.playerIdentityCompact]}>
            <Text style={styles.role}>{ROLE_LABEL[user.role] ?? user.role}</Text>
            <Text style={styles.styleLine}>
              {user.battingStyle === 'RHB' ? 'RH bat' : 'LH bat'}
              {user.bowlingStyle ? ` · ${user.bowlingStyle.replace(/_/g, ' ').toLowerCase()}` : ''}
            </Text>
            <View style={styles.statLine}>
              <Stat label="Mat" value={stats.matches} />
              <Stat label="Runs" value={stats.runs} />
              <Stat label="HS" value={stats.highScore} />
              <Stat label="Wkts" value={stats.wickets} />
            </View>
            {/* OVR ring */}
            <View style={[styles.ovrRingMini, compact && styles.ovrRingMiniCompact]}>
              <Svg width={48} height={48} viewBox="0 0 48 48">
                <Circle
                  cx={24}
                  cy={24}
                  r={20}
                  fill="none"
                  stroke={colors.surfaceAlt}
                  strokeWidth={4}
                />
                <Circle
                  cx={24}
                  cy={24}
                  r={20}
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth={4}
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - userOverall / 100)}`}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="24,24"
                />
              </Svg>
              <View style={styles.ovrCenterMini}>
                <Text style={styles.ovrValueMini}>{userOverall}</Text>
                <Text style={styles.ovrLabelMini}>OVR</Text>
              </View>
            </View>
          </View>
        </Card>
      </View>

      <CupCard
        save={save}
        canPlay={canPlay}
        onPlay={() => {
          if (playCupTie()) navigation.navigate('Match');
        }}
      />

      {/* Competition picker — shown when multiple formats available (Feature 4) */}
      {competitionOptions.length > 1 && (
        <>
          <Text style={styles.section}>Other Competitions</Text>
          <Card style={{ marginTop: 0 }}>
            <Text style={[styles.note, { marginTop: 0, marginBottom: spacing.sm }]}>
              You have fixtures available across multiple formats. Pick which to play next.
            </Text>
            {competitionOptions.map((opt) => {
              const optFixture = save.fixtures[opt.fixtureId];
              const optCost = optFixture ? fixtureEnergyCost(optFixture) : ECONOMY.energyPerMatch;
              const optCanPlay = save.wallet.energy >= optCost;
              return (
                <View key={opt.competitionId} style={{ marginTop: spacing.xs }}>
                  <Button
                    label={`${opt.name} (${opt.format}) - ${optCost} energy`}
                    variant="secondary"
                    size="sm"
                    disabled={!optCanPlay}
                    onPress={() => {
                      setTargetFixture(opt.fixtureId);
                      navigation.navigate('Match');
                    }}
                  />
                </View>
              );
            })}
          </Card>
        </>
      )}

      {/* League position preview — hidden for youth players (they're not in the league yet) */}
      {(() => {
        const pathLevel = save.careerPathLevel ?? 'DOMESTIC';
        const isYouth = pathLevel === 'SCHOOL' || pathLevel === 'U19';
        if (isYouth) return null;
        const myRow = table.find((r) => r.teamId === save.userTeamId);
        const myPos = myRow ? table.indexOf(myRow) + 1 : '—';
        return (
          <>
            <Text style={styles.section}>League Position</Text>
            <Card style={styles.leaguePreviewCard} onPress={() => handleTabChange('stats')}>
              <View style={styles.leaguePreviewRow}>
                <Text
                  style={[
                    styles.leaguePreviewPos,
                    { color: myPos === 1 ? colors.accent : colors.text },
                  ]}
                >
                  {myPos}
                </Text>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.leaguePreviewTeam}>{team?.name ?? '—'}</Text>
                  {myRow ? (
                    <Text style={styles.leaguePreviewMeta}>
                      {myRow.points} pts · W{myRow.won} L{myRow.lost}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.leaguePreviewArrow}>Full table →</Text>
              </View>
            </Card>
          </>
        );
      })()}

      <LiveOpsCards />

      {/* Quick links */}
      <View style={styles.quickRow}>
        <Button
          label="🏋️ Training"
          variant="secondary"
          fullWidth={false}
          style={styles.flex}
          onPress={() => navigation.navigate('Training')}
        />
        <Button
          label="🛒 Store"
          variant="secondary"
          fullWidth={false}
          style={styles.flex}
          onPress={() => navigation.navigate('Purchase')}
        />
      </View>
      <View style={[styles.quickRow, { marginTop: spacing.sm }]}>
        <Button
          label="🏆 Records"
          variant="ghost"
          fullWidth={false}
          style={styles.flex}
          onPress={() => navigation.navigate('Records')}
        />
      </View>

      <Button
        label="Save & Exit to Menu"
        variant="ghost"
        style={{ marginTop: spacing.xl }}
        onPress={onSaveExit}
      />
    </>
  );

  const renderStatsTab = () => (
    <>
      <Text style={styles.section}>Career Statistics</Text>
      <View style={styles.statGrid}>
        <StatCard label="Matches" value={String(stats.matches)} color={colors.primaryLight} />
        <StatCard label="Runs" value={String(stats.runs)} color={colors.accent} />
        <StatCard label="High Score" value={String(stats.highScore)} color={colors.accent} />
        <StatCard
          label="Bat Avg"
          value={
            stats.matches > 0
              ? (stats.runs / Math.max(1, stats.matches - (stats.notOuts ?? 0))).toFixed(1)
              : '0'
          }
          color={colors.success}
        />
        <StatCard label="Wickets" value={String(stats.wickets)} color={colors.info} />
        <StatCard label="Best" value={String(stats.bestBowling)} color={colors.info} />
        <StatCard label="Wins" value={String(save.careerWins ?? 0)} color={colors.success} />
        <StatCard label="Losses" value={String(save.careerLosses ?? 0)} color={colors.danger} />
        <StatCard label="Draws" value={String(save.careerDraws ?? 0)} color={colors.textMuted} />
        <StatCard label="50s" value={String(stats.fifties)} color={colors.primaryLight} />
        <StatCard label="100s" value={String(stats.hundreds)} color={colors.accent} />
        <StatCard label="Catches" value={String(stats.catches)} color={colors.textMuted} />
      </View>

      <Text style={styles.section}>Domestic and International</Text>
      <Card style={styles.scopeTable}>
        <CareerScopeRow label="Domestic" stats={domesticStats} />
        <CareerScopeRow label="International" stats={internationalStats} last />
      </Card>

      {/* League table */}
      <Text style={styles.section}>League Table</Text>
      <Card>
        <LeagueTable rows={table} teams={save.teams} highlightTeamId={save.userTeamId} />
      </Card>

      {/* Rival comparison — persistent head-to-head badge */}
      {rivalCmp ? <RivalryBadge comparison={rivalCmp} userName={user?.name ?? 'You'} /> : null}

      {/* Locked franchise auction (senior pros only) — standardized locked state */}
      {(() => {
        const level = save.careerPathLevel ?? 'DOMESTIC';
        if (level !== 'DOMESTIC' && level !== 'INTERNATIONAL') return null;
        if ((save.auctionOffers?.length ?? 0) > 0) return null;
        const gate = franchiseAuctionGate(save);
        if (gate.unlocked || !gate.reason) return null;
        const matches = user?.careerStats?.matches ?? 0;
        return (
          <View style={{ marginTop: spacing.md }}>
            <LockedFeatureCard
              title="Franchise Auction"
              reason={gate.reason}
              icon="hammer"
              progress={Math.min(1, matches / 10)}
              progressLabel={`${matches} / 10 career matches`}
            />
          </View>
        );
      })()}
    </>
  );

  const renderNarrativeTab = () => (
    <>
      {storyN > 0 && (
        <Button
          label={`📨 Your Story · ${storyN} moment${storyN === 1 ? '' : 's'}`}
          variant="gold"
          style={{ marginTop: spacing.md }}
          onPress={() => navigation.navigate('Narrative')}
        />
      )}

      <View style={styles.archetypeBand}>
        <Text style={styles.nextChapterEyebrow}>{identityLine}</Text>
        <Text style={styles.archetypePromise}>
          {ARCHETYPE_PROFILES[save.experience?.playerArchetype ?? 'SPECIALIST'].promise}
        </Text>
        <Text style={styles.archetypePressure}>
          Pressure: {ARCHETYPE_PROFILES[save.experience?.playerArchetype ?? 'SPECIALIST'].pressure}
        </Text>
      </View>

      {(save.experience?.relationshipMemories?.length ?? 0) > 0 ? (
        <>
          <Text style={styles.section}>What They Remember</Text>
          {save.experience!.relationshipMemories!.slice(0, 5).map((memory) => (
            <View key={memory.id} style={styles.memoryRow}>
              <View style={styles.memoryHeading}>
                <Text style={styles.memoryName}>{memory.characterName}</Text>
                <Text
                  style={[
                    styles.memoryDelta,
                    { color: memory.delta >= 0 ? colors.success : colors.warning },
                  ]}
                >
                  {memory.delta >= 0 ? '+' : ''}
                  {memory.delta}
                </Text>
              </View>
              <Text style={styles.memoryRole}>
                {memory.role} | Season {memory.season}
              </Text>
              <Text style={styles.memorySummary}>{memory.summary}</Text>
              <Text style={styles.memoryConsequence}>{memory.consequence}</Text>
            </View>
          ))}
        </>
      ) : null}

      {/* Promotion alert */}
      {lastPromotion?.promoted
        ? (() => {
            const from = lastPromotion.from!;
            const to = lastPromotion.to!;
            const newCap = trainingAttributeCeiling(to);
            const opponentQuality = youthOpponentQuality(to);
            const reason =
              to === 'U19'
                ? 'Your school performances have earned you a regional Under-19 place.'
                : to === 'DOMESTIC'
                  ? 'Your youth performances have earned a senior domestic contract.'
                  : 'Your domestic body of work has put you on the international stage.';
            const competitions =
              to === 'U19'
                ? 'Regional Under-19 fixtures and national youth tournaments.'
                : to === 'DOMESTIC'
                  ? 'List A, First-Class and T20 cricket, plus contracts and auctions.'
                  : 'International tours, caps and national leadership goals.';
            const nextObjective =
              to === 'U19'
                ? 'Build a run of strong youth performances.'
                : to === 'DOMESTIC'
                  ? 'Secure your place and chase national selection.'
                  : 'Win matches for your country and build a legacy.';
            return (
              <View>
                <Card style={styles.promotionCard}>
                  <Text style={styles.promotionKicker}>PROMOTED TO</Text>
                  <Text style={styles.promotionTitle}>{CAREER_PATH_LABEL[to]}</Text>
                  <Text style={styles.promotionBody}>{reason}</Text>
                  <View style={styles.promotionGrid}>
                    <InfoPill label="From" value={CAREER_PATH_LABEL[from]} />
                    <InfoPill label="Training cap" value={String(newCap)} />
                    <InfoPill label="Opponent quality" value={`${opponentQuality} OVR`} />
                  </View>
                  <Text style={styles.promotionLine}>New competitions: {competitions}</Text>
                  <Text style={styles.promotionLine}>Next objective: {nextObjective}</Text>
                </Card>
              </View>
            );
          })()
        : null}

      {/* Career Path Level */}
      <Text style={styles.section}>Career Path</Text>
      <Card>
        {(() => {
          const pathLevel = save.careerPathLevel ?? 'DOMESTIC';
          const pathLabel = CAREER_PATH_LABEL[pathLevel];
          const nextLabel = nextCareerPathLabel(save);
          const progress = careerPathProgress(save, user);
          return (
            <>
              <View style={styles.tierRow}>
                <Text style={styles.tierLabel}>{pathLabel}</Text>
                {nat.capped ? (
                  <Text style={styles.caps}>
                    🧢 {nat.caps} {countryName} cap{nat.caps === 1 ? '' : 's'}
                  </Text>
                ) : null}
              </View>
              {pathLevel !== 'INTERNATIONAL' && (
                <>
                  <Text style={styles.note}>Next: {nextLabel}</Text>
                  <ProgressBar
                    value={progress}
                    color={colors.accent}
                    style={{ marginTop: spacing.sm }}
                  />
                  <Text style={styles.repText}>
                    {Math.round(progress * 100)}% toward {nextLabel}
                  </Text>
                </>
              )}
              {nat.capped && isInternationalFixture(fixture) && (
                <Button
                  label={canPlay ? `🧢 Represent ${countryName}` : 'Not enough energy'}
                  variant="gold"
                  disabled={!canPlay}
                  style={{ marginTop: spacing.sm }}
                  onPress={() => navigation.navigate('Match', { intl: true })}
                />
              )}
              {nat.capped && !isInternationalFixture(fixture) && (
                <Text style={[styles.note, { marginTop: spacing.sm }]}>
                  You remain contracted to {team?.name ?? 'your domestic club'}. International tours
                  appear here when you are selected; domestic cricket continues between call-ups.
                </Text>
              )}
              {nat.capped && nat.caps === 0 && (
                <>
                  <Text style={[styles.note, { marginTop: spacing.md }]}>
                    Declared country: {countryName}. You may change between eligible countries until
                    your first senior cap permanently locks allegiance.
                  </Text>
                  <View style={styles.countryChipGrid}>
                    {(save.playerCareerResources?.eligibleCountries ?? [user.nationality]).map(
                      (countryId) => {
                        const country = getCountry(countryId);
                        const selected = countryId === nationalCountryId;
                        return (
                          <Pressable
                            key={countryId}
                            accessibilityRole="button"
                            style={[styles.countryChip, selected && styles.countryChipSelected]}
                            onPress={() => {
                              const result = declareInternationalCountry(countryId);
                              if (!result.ok && result.reason) {
                                Alert.alert('International eligibility', result.reason);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.countryChipText,
                                selected && styles.countryChipTextSelected,
                              ]}
                            >
                              {country?.name ?? 'Eligible country'}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </View>
                </>
              )}
              {!nat.capped && pathLevel === 'DOMESTIC' && (
                <>
                  <Text style={styles.note}>
                    National selection watch — strong performances earn a call-up for {countryName}.
                  </Text>
                  <ProgressBar
                    value={nat.rep / 100}
                    color={colors.primaryLight}
                    style={{ marginTop: spacing.sm }}
                  />
                  <Text style={[styles.note, { marginTop: spacing.md }]}>
                    Declared country: {countryName}. Your first senior cap permanently locks this
                    choice.
                  </Text>
                  <View style={styles.countryChipGrid}>
                    {(save.playerCareerResources?.eligibleCountries ?? [user.nationality]).map(
                      (countryId) => {
                        const country = getCountry(countryId);
                        const selected = countryId === nationalCountryId;
                        return (
                          <Pressable
                            key={countryId}
                            accessibilityRole="button"
                            style={[styles.countryChip, selected && styles.countryChipSelected]}
                            onPress={() => {
                              const result = declareInternationalCountry(countryId);
                              if (!result.ok && result.reason) {
                                Alert.alert('International eligibility', result.reason);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.countryChipText,
                                selected && styles.countryChipTextSelected,
                              ]}
                            >
                              {country?.name ?? 'Eligible country'}
                            </Text>
                          </Pressable>
                        );
                      },
                    )}
                  </View>
                  <Text style={styles.repText}>Selection rep · {nat.rep}/100</Text>
                </>
              )}
            </>
          );
        })()}
      </Card>

      {/* Season awards */}
      {(awards.topScorer || awards.topWicketTaker) && (
        <>
          <Text style={styles.section}>Season Awards</Text>
          <Card>
            {awards.topScorer && (
              <Text style={styles.award}>
                🏏 Top runs · {save.players[awards.topScorer.playerId]?.name} (
                {awards.topScorer.runs})
              </Text>
            )}
            {awards.topWicketTaker && (
              <Text style={styles.award}>
                🎯 Top wickets · {save.players[awards.topWicketTaker.playerId]?.name} (
                {awards.topWicketTaker.wickets})
              </Text>
            )}
          </Card>
        </>
      )}

      <Button
        label="Player Life: media, support and finance"
        variant="secondary"
        style={{ marginTop: spacing.lg }}
        onPress={() => navigation.navigate('PlayerLife')}
      />

      {/* International Calendar (Feature 5 + 8) */}
      {save.capped && (
        <>
          <Text style={styles.section}>International Calendar</Text>
          <Card onPress={() => navigation.navigate('InternationalCalendar')}>
            <View style={styles.tierRow}>
              <Text style={styles.tierLabel}>🌍 ICC Schedule</Text>
              <Text style={styles.caps}>{save.userCaps ?? 0} caps</Text>
            </View>
            <Text style={styles.note}>
              View ICC events, bilateral series and your international record.
            </Text>
            <Button
              label="View Calendar →"
              variant="ghost"
              size="sm"
              style={{ marginTop: spacing.sm }}
              onPress={() => navigation.navigate('InternationalCalendar')}
            />
          </Card>
        </>
      )}

      {/* U19 World Cup status (Feature 5) */}
      {save.careerPathLevel === 'U19' && (
        <>
          <Text style={styles.section}>U19 World Cup</Text>
          <Card onPress={() => navigation.navigate('U19WorldCup')}>
            <Text style={[styles.tierLabel, { fontSize: fontSize.md }]}>🏆 Under-19 World Cup</Text>
            <Text style={styles.note}>Track your U19 qualification and bracket progress.</Text>
            <Button
              label="View Bracket →"
              variant="ghost"
              size="sm"
              style={{ marginTop: spacing.sm }}
              onPress={() => navigation.navigate('U19WorldCup')}
            />
          </Card>
        </>
      )}

      {/* Career → Manager transition */}
      {save.careerToManagerEligible && (
        <Card style={{ borderColor: colors.info + '88', borderWidth: 1, marginTop: spacing.md }}>
          <Text
            style={{
              color: colors.info,
              fontSize: fontSize.md,
              fontWeight: fontWeight.heavy,
              marginBottom: spacing.xs,
            }}
          >
            Management Path Available
          </Text>
          <Text style={styles.note}>
            Your career qualifies you to step into management. Retire on your terms, then take
            charge of a club.
          </Text>
        </Card>
      )}

      {/* Retire */}
      {shouldPromptRetirement(user) && (
        <Text style={styles.retireHint}>
          The years are catching up. When you're ready, you can retire on your own terms.
        </Text>
      )}
      {canRetire(user) && (
        <Button
          label="🏁 Retire"
          variant="ghost"
          style={{ marginTop: spacing.xl }}
          onPress={onRetire}
        />
      )}
    </>
  );

  const renderProgressTab = () => {
    // Shared with the New Game+ head-start so the meter reflects what's carried forward.
    const {
      score: legacyScore,
      runs: legacyRuns,
      wkts: legacyWkts,
      titles: legacyTitles,
      caps: legacyCaps,
    } = careerLegacyScore(save);
    const nextMilestone =
      legacyScore < 25 ? 25 : legacyScore < 50 ? 50 : legacyScore < 75 ? 75 : 100;

    return (
      <>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitleInline}>Selection Readiness</Text>
          {save.careerPathLevel === 'U19' ? (
            <MechanicInfoButton topicId="u19-readiness" />
          ) : (
            <MechanicInfoButton topicId="selection-formula" />
          )}
        </View>
        <Card>
          <View style={styles.readinessGrid}>
            <InfoPill
              label="Condition"
              value={`${Math.round(save.playerCareerResources?.playerCondition ?? 100)}`}
            />
            <InfoPill
              label="Coach trust"
              value={`${Math.round(save.playerCareerResources?.coachTrust ?? 55)}`}
            />
            <InfoPill
              label="Adaptability"
              value={`${Math.round(save.playerCareerResources?.adaptability ?? 50)}`}
            />
          </View>
          <Text style={styles.note}>
            White-ball tempo {Math.round(save.playerCareerResources?.whiteBallTempo ?? 50)} |
            Red-ball memory {Math.round(save.playerCareerResources?.redBallMemory ?? 50)}
          </Text>
          {save.playerCareerResources?.lastSelection ? (
            <Text style={styles.selectionReason}>
              {save.playerCareerResources.lastSelection.reason}
            </Text>
          ) : null}
        </Card>

        {/* Legacy meter */}
        <Text style={styles.section}>Legacy Meter</Text>
        <Card style={[styles.legacyCard, { borderColor: colors.accent + '55' }]}>
          <View style={styles.legacyHeader}>
            <View>
              <Text style={styles.legacyTitle}>🌱 Legacy</Text>
              <Text style={styles.legacySub}>Boosts your New Game+ protégé&apos;s head-start</Text>
            </View>
            <View style={styles.legacyScoreBadge}>
              <Text style={styles.legacyScoreVal}>{legacyScore}</Text>
              <Text style={styles.legacyScoreLabel}>/ 100</Text>
            </View>
          </View>
          <ProgressBar
            value={legacyScore / 100}
            color={colors.accent}
            style={{ marginTop: spacing.sm }}
          />
          <Text style={styles.legacyNextHint}>
            {legacyScore >= 100
              ? '✦ Max legacy — your protégé starts with a massive head-start!'
              : `Next tier at ${nextMilestone}`}
          </Text>
          <View style={styles.legacyBreakdown}>
            {[
              { label: 'Runs', pct: legacyRuns, color: colors.primaryLight },
              { label: 'Wickets', pct: legacyWkts, color: colors.info },
              { label: 'Titles', pct: legacyTitles, color: colors.accent },
              { label: 'Caps', pct: legacyCaps, color: colors.success },
            ].map((item) => (
              <View key={item.label} style={styles.legacyBreakItem}>
                <Text style={styles.legacyBreakLabel}>{item.label}</Text>
                <View style={styles.legacyBreakBarBg}>
                  <View
                    style={[
                      styles.legacyBreakBarFill,
                      { width: `${item.pct}%` as any, backgroundColor: item.color },
                    ]}
                  />
                </View>
                <Text style={[styles.legacyBreakPct, { color: item.color }]}>{item.pct}%</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Gamerscore */}
        <Text style={styles.section}>Achievements</Text>
        <Card>
          <View style={styles.gsRow}>
            <View>
              <Text style={styles.gsScore}>{gamerscore}</Text>
              <Text style={styles.gsMax}>/ {MAX_GAMERSCORE} pts</Text>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <ProgressBar value={gamerscore / MAX_GAMERSCORE} color={colors.accent} />
              <Text style={styles.gsLabel}>
                {earnedCount} / {ACHIEVEMENTS.length} unlocked
              </Text>
            </View>
          </View>
          <Button
            label="View All Achievements →"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={() => navigation.navigate('Records')}
          />
        </Card>

        {/* Career timeline */}
        {(save.timeline ?? []).length > 0 && (
          <>
            <Text style={styles.section}>Career Journey</Text>
            <Card style={styles.timelineCard}>
              {(save.timeline ?? [])
                .slice(-8)
                .reverse()
                .map((t, i) => (
                  <View key={i} style={styles.tlRow}>
                    <View style={styles.tlLeft}>
                      <View
                        style={[
                          styles.tlDot,
                          { backgroundColor: i === 0 ? colors.accent : colors.borderStrong },
                        ]}
                      />
                      {i < Math.min(7, (save.timeline ?? []).length - 1) && (
                        <View style={styles.tlLine} />
                      )}
                    </View>
                    <View style={styles.tlContent}>
                      <Text style={styles.tlYear}>{t.year}</Text>
                      <Text style={styles.tlText}>{renderText(t.text, save)}</Text>
                    </View>
                  </View>
                ))}
            </Card>
          </>
        )}
      </>
    );
  };

  const renderProfileTab = () => (
    <>
      <Button
        label="View Full Profile"
        variant="primary"
        style={{ marginTop: spacing.md }}
        onPress={() => navigation.navigate('PlayerProfile', { playerId: user.id })}
      />
      <Button
        label="Player Life"
        variant="secondary"
        style={{ marginTop: spacing.sm }}
        onPress={() => navigation.navigate('PlayerLife')}
      />
      {pressArchive.length > 0 ? (
        <>
          <Text style={styles.section}>Media Scrapbook</Text>
          {[...pressArchive]
            .reverse()
            .slice(0, 6)
            .map((story) => (
              <Card
                key={story.id}
                style={styles.scrapbookItem}
                onPress={() => setSelectedNewspaper(story)}
              >
                <Text style={styles.pressClipKicker}>
                  {story.format} | SEASON {story.season}
                </Text>
                <Text style={styles.scrapbookHeadline}>{story.headline}</Text>
                <Text style={styles.pressClipBody} numberOfLines={2}>
                  {story.subheadline}
                </Text>
              </Card>
            ))}
        </>
      ) : null}
      <Button
        label="🎨 Cosmetics"
        variant="secondary"
        style={{ marginTop: spacing.sm }}
        onPress={() => navigation.navigate('PlayerCosmetics')}
      />
      <Button
        label="📊 Records & Hall of Fame"
        variant="secondary"
        style={{ marginTop: spacing.sm }}
        onPress={() => navigation.navigate('Records')}
      />
      <Button
        label="⚙️ Settings"
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={() => navigation.navigate('Settings')}
      />
      <Button
        label="Save & Exit to Menu"
        variant="ghost"
        style={{ marginTop: spacing.xl }}
        onPress={onSaveExit}
      />
    </>
  );

  const renderPageContent = () => {
    switch (page) {
      case 'home':
        return renderHomeTab();
      case 'stats':
        return renderStatsTab();
      case 'narrative':
        return renderNarrativeTab();
      case 'progress':
        return renderProgressTab();
      case 'profile':
        return renderProfileTab();
      default:
        return renderHomeTab();
    }
  };

  return (
    <>
      <Screen
        scroll
        gradient={gradients.pitch}
        footer={
          <HubTabBar
            tabs={[
              {
                key: 'home',
                icon: 'home',
                label: 'Home',
                active: page === 'home',
                onPress: () => handleTabChange('home'),
              },
              {
                key: 'stats',
                icon: 'stats-chart',
                label: 'Stats',
                active: page === 'stats',
                onPress: () => handleTabChange('stats'),
              },
              {
                key: 'progress',
                icon: 'trophy',
                label: 'Progress',
                active: page === 'progress',
                onPress: () => handleTabChange('progress'),
              },
              {
                key: 'profile',
                icon: 'person',
                label: 'Profile',
                active: page === 'profile',
                onPress: () => handleTabChange('profile'),
              },
            ]}
          />
        }
      >
        <ScreenHeader
          title={user.name}
          subtitle={`${activePathTeam?.name ?? team?.name ?? ''} · Season ${season?.year ?? ''} · Age ${user.age}`}
          onBack={goMenu}
        />
        <CareerSpotlight
          mode="player"
          title={identityLine}
          meta={`${CAREER_PATH_LABEL[save.careerPathLevel ?? 'DOMESTIC']} | ${countryName} | ${userOverall} OVR`}
          accentColor={activePathTeam?.primaryColor ?? team?.primaryColor ?? colors.accent}
          status={`FORM ${Math.round(user.meta.form)} | COND ${Math.round(save.playerCareerResources?.playerCondition ?? 100)} | TRUST ${Math.round(save.playerCareerResources?.coachTrust ?? 55)}`}
        />
        <View>
          <WalletBar wallet={save.wallet} />
        </View>

        <View>{renderPageContent()}</View>
      </Screen>
      <AchievementToast achievement={currentToast} onDismiss={onDismissToast} />
      <ModeGuideModal
        visible={showCareerGuide}
        modeLabel="Player Career"
        steps={PLAYER_GUIDE_STEPS}
        onComplete={() => dismissTip('career_hub_guide')}
      />
      <RewardModal data={rewardModal} onClose={() => setRewardModal(null)} />
      <NewspaperModal
        story={selectedNewspaper}
        onClose={(storyId) => {
          markNewspaperSeen(storyId);
          setSelectedNewspaper(null);
        }}
      />
      {/* Contextual monetization modal */}
      <ContextualOffer
        kind={activeOffer}
        streakDays={save?.winStreak}
        onAccept={() => {
          const kind = activeOffer;
          if (kind) analytics.logEvent(analytics.EVT.OFFER_ACCEPTED, { kind });
          setActiveOffer(null);
          const store = useCareer.getState();
          // Perform the real action the CTA promises; fall back to the store
          // (to buy gems) when the player can't afford it.
          if (kind === 'energy_empty' || kind === 'streak_protection') {
            if (!store.refillEnergy().ok) navigation.navigate('Purchase');
            return;
          }
          if (kind === 'injury_recovery') {
            if (!store.recoverInjuryNow().ok) navigation.navigate('Purchase');
            return;
          }
          navigation.navigate('Purchase');
        }}
        onDismiss={() => {
          if (activeOffer) analytics.logEvent(analytics.EVT.OFFER_DISMISSED, { kind: activeOffer });
          setActiveOffer(null);
        }}
      />
      {/* Starter pack — unlocked by the first completed match */}
      <StarterPackModal
        visible={showStarterPack}
        onPurchase={() => {
          dismissStarterPack();
          setShowStarterPack(false);
          navigation.navigate('Purchase');
        }}
        onDismiss={() => {
          dismissStarterPack();
          setShowStarterPack(false);
        }}
      />
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number | string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CareerScopeRow({
  label,
  stats,
  last,
}: {
  label: string;
  stats: PlayerStats;
  last?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.scopeRow, last && styles.scopeRowLast]}>
      <Text style={styles.scopeLabel}>{label}</Text>
      <View style={styles.scopeMetric}>
        <Text style={styles.scopeValue}>{stats.matches}</Text>
        <Text style={styles.scopeMeta}>M</Text>
      </View>
      <View style={styles.scopeMetric}>
        <Text style={styles.scopeValue}>{stats.runs}</Text>
        <Text style={styles.scopeMeta}>RUNS</Text>
      </View>
      <View style={styles.scopeMetric}>
        <Text style={styles.scopeValue}>{stats.wickets}</Text>
        <Text style={styles.scopeMeta}>WKTS</Text>
      </View>
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillLabel}>{label}</Text>
      <Text style={styles.infoPillValue}>{value}</Text>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexBasis: '30%',
        flexGrow: 1,
        minWidth: 88,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.sm,
        alignItems: 'center',
        minHeight: 64,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color,
          fontSize: fontSize.xl,
          fontWeight: fontWeight.black,
          fontFamily: fonts.display,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text
        style={{
          color: colors.textFaint,
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: 2,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    careerScene: {
      height: 176,
      marginTop: spacing.sm,
      marginHorizontal: -spacing.md,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    careerSceneImage: { opacity: 0.88 },
    careerSceneShade: { backgroundColor: 'rgba(0,0,0,0.58)', padding: spacing.lg },
    careerSceneEyebrow: { color: colors.accent, fontSize: 10, fontWeight: fontWeight.black },
    careerSceneTitle: {
      color: colors.white,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    careerSceneMeta: { color: 'rgba(255,255,255,0.82)', fontSize: fontSize.xs, marginTop: 4 },
    archetypeBand: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    archetypePromise: { color: colors.text, fontSize: fontSize.sm, lineHeight: 19, marginTop: 4 },
    archetypePressure: {
      color: colors.warning,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: 3,
    },
    memoryRow: {
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    memoryHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    memoryName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, flex: 1 },
    memoryDelta: { fontSize: fontSize.sm, fontWeight: fontWeight.black },
    memoryRole: { color: colors.accent, fontSize: fontSize.xs, marginTop: 2 },
    memorySummary: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: 4 },
    memoryConsequence: { color: colors.textFaint, fontSize: 10, lineHeight: 15, marginTop: 2 },
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    nextChapterHero: {
      borderColor: colors.accent,
      borderWidth: 1.5,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    nextChapterEyebrow: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0,
    },
    nextChapterTitle: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      lineHeight: 31,
      marginTop: spacing.xs,
    },
    nextChapterReason: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginTop: spacing.xs,
    },
    nextFixtureStrip: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
    },
    nextFixtureCopy: { flex: 1, minWidth: 0 },
    nextFixtureTeams: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    nextFixtureStatus: { fontSize: fontSize.xs, marginTop: 2 },
    nextFixtureActions: {
      minHeight: 40,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    heroTextAction: {
      minHeight: 38,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    heroTextActionLabel: {
      color: colors.primaryLight,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    calendarChoiceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    calendarChoiceButton: {
      flexGrow: 1,
      flexBasis: 140,
    },
    countryMoveCard: {
      marginBottom: spacing.md,
      borderLeftColor: colors.info,
      borderLeftWidth: 3,
    },
    countryChipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    countryChip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    countryChipSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentDark,
    },
    countryChipText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    countryChipTextSelected: {
      color: colors.accent,
    },
    guideCard: {
      marginTop: spacing.md,
      borderLeftColor: colors.primary,
      borderLeftWidth: 3,
    },
    guideHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    guideKicker: {
      color: colors.primaryLight,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
    },
    guideTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    guideStep: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 4,
    },
    guideStepNo: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.surfaceMuted,
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      lineHeight: 22,
      textAlign: 'center',
    },
    guideStepText: { flex: 1, color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18 },
    impactStrip: {
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderLeftColor: colors.success,
      borderLeftWidth: 3,
      borderRadius: radius.sm,
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
    },
    impactStripCompact: { alignItems: 'stretch', flexDirection: 'column', gap: spacing.sm },
    impactEyebrow: {
      color: colors.success,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0,
    },
    impactTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    impactText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    impactChanges: { alignItems: 'flex-end', gap: 3, maxWidth: '42%' },
    impactChangesCompact: { alignItems: 'flex-start', maxWidth: '100%' },
    impactDelta: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textAlign: 'right' },
    pressClip: {
      backgroundColor: colors.surface,
      borderColor: colors.accent,
      borderLeftColor: colors.accent,
      borderLeftWidth: 3,
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
    },
    pressClipKicker: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    pressClipHeadline: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      lineHeight: 23,
      marginTop: spacing.xs,
    },
    pressClipBody: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginTop: spacing.xs,
    },
    scrapbookItem: {
      marginBottom: spacing.sm,
      borderLeftWidth: 2,
      borderLeftColor: colors.accent,
    },
    scrapbookHeadline: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      lineHeight: 21,
      marginTop: spacing.xs,
    },
    // Player hero card
    playerCard: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
    playerCardCompact: { alignItems: 'stretch', flexDirection: 'column', gap: spacing.md },
    playerAvatarWrap: { alignItems: 'center', flexShrink: 0 },
    playerIdentity: { flex: 1, marginLeft: spacing.md, minWidth: 0, paddingRight: 56 },
    playerIdentityCompact: { marginLeft: 0, paddingRight: 0 },
    role: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    styleLine: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    statLine: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' },
    stat: { alignItems: 'flex-start' },
    statValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    statLabel: {
      color: colors.textFaint,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // OVR ring (mini — shown inline in player card)
    ovrRingMini: {
      position: 'absolute',
      right: 0,
      top: 0,
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ovrRingMiniCompact: {
      alignSelf: 'flex-start',
      marginTop: spacing.md,
      position: 'relative',
      right: 0,
      top: 0,
    },
    ovrCenterMini: { position: 'absolute', alignItems: 'center' },
    ovrValueMini: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    ovrLabelMini: {
      color: colors.textMuted,
      fontSize: 7,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    // Matchday section
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    sectionTitleRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    sectionTitleInline: {
      flex: 1,
      minWidth: 0,
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    youthTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minWidth: 0,
    },
    selectionHeadingRow: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    vsLabel: { color: colors.textMuted, fontSize: fontSize.sm },
    vsTeams: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      marginTop: 2,
      fontFamily: fonts.display,
    },
    vsOpp: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    note: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm },
    selectionStatus: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      marginTop: spacing.md,
    },
    selectionStatusInline: { flex: 1, minWidth: 0, marginTop: 0 },
    selectionReason: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginTop: spacing.md,
    },
    champion: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      marginTop: spacing.xs,
    },
    award: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.xs },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    flex: { flex: 1, minWidth: '45%' },
    tierRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tierLabel: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    caps: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    repText: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    // Auction
    auctionCard: { marginTop: spacing.md, borderColor: colors.accent, borderWidth: 1.5 },
    auctionTitle: { color: colors.accent, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    offerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.sm,
      marginTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    offerTeam: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    offerMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    // Inbox banner
    inboxBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primary + '22',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    inboxBannerText: {
      color: colors.primaryLight,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    inboxBannerArrow: { color: colors.primaryLight, fontSize: fontSize.md },
    storyHomeCard: {
      marginTop: spacing.md,
      borderColor: colors.accent,
      borderWidth: 1.5,
    },
    storyHomeEyebrow: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    storyHomeTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    // Win streak
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: 'rgba(233,178,59,0.12)',
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
    },
    streakFire: { fontSize: 16 },
    streakText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    // Energy
    energyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    topUpBtn: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    topUpText: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    // League preview
    leaguePreviewCard: { marginTop: 0 },
    leaguePreviewRow: { flexDirection: 'row', alignItems: 'center' },
    leaguePreviewPos: {
      fontSize: 32,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      width: 44,
    },
    leaguePreviewTeam: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    leaguePreviewMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    leaguePreviewArrow: { color: colors.textFaint, fontSize: fontSize.xs },
    // Legacy meter
    legacyCard: { marginTop: 0, borderWidth: 1 },
    legacyHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    legacyTitle: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    legacySub: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
    legacyScoreBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
    legacyScoreVal: {
      color: colors.accent,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    legacyScoreLabel: { color: colors.textFaint, fontSize: fontSize.sm },
    legacyNextHint: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
    legacyBreakdown: { marginTop: spacing.md, gap: 6 },
    legacyBreakItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    legacyBreakLabel: { color: colors.textFaint, fontSize: fontSize.xs, width: 50 },
    legacyBreakBarBg: {
      flex: 1,
      height: 4,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    legacyBreakBarFill: { height: '100%' as any, borderRadius: radius.pill },
    legacyBreakPct: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      width: 32,
      textAlign: 'right',
    },
    // Gamerscore
    gsRow: { flexDirection: 'row', alignItems: 'center' },
    gsScore: {
      color: colors.accent,
      fontSize: 32,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    gsMax: { color: colors.textFaint, fontSize: fontSize.xs },
    gsLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
    scopeTable: { paddingVertical: 0 },
    scopeRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    scopeRowLast: { borderBottomWidth: 0 },
    scopeLabel: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      flex: 1,
      minWidth: 0,
    },
    scopeMetric: { minWidth: 52, alignItems: 'flex-end' },
    scopeValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    scopeMeta: { color: colors.textFaint, fontSize: 9, marginTop: 1 },
    promotionCard: {
      borderColor: colors.accent,
      borderWidth: 1.5,
      marginBottom: spacing.md,
    },
    promotionKicker: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    promotionTitle: {
      color: colors.accent,
      fontFamily: fonts.display,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    promotionBody: {
      color: colors.text,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginTop: spacing.xs,
    },
    promotionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    readinessGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    promotionLine: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
      marginTop: spacing.sm,
    },
    infoPill: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexGrow: 1,
      minWidth: '30%',
      padding: spacing.sm,
    },
    infoPillLabel: {
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    infoPillValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    // Timeline
    timelineCard: { paddingVertical: spacing.xs },
    tlRow: { flexDirection: 'row', paddingBottom: spacing.md, gap: spacing.sm },
    tlLeft: { alignItems: 'center', width: 16 },
    tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
    tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 },
    tlContent: { flex: 1, paddingBottom: 4 },
    tlYear: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      marginBottom: 2,
    },
    tlText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18 },
    // Retired
    retireCard: { marginTop: spacing.md },
    retireHeroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    retireName: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    retireRole: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    retireSeason: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    epitaphBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    epitaphQuote: {
      color: colors.text,
      fontSize: fontSize.md,
      fontStyle: 'italic',
      lineHeight: 22,
    },
    honours: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
    honourPill: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    honour: { color: colors.textMuted, fontSize: fontSize.xs },
    retireHint: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.xl,
      fontStyle: 'italic',
      textAlign: 'center',
      lineHeight: 16,
    },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  });
