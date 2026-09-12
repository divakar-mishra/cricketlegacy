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
import { showShortageOffer } from '../components/showShortageOffer';
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
  HubTabBar,
  Icon,
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
  SeasonPassHomeCard,
  WalletBar,
} from '../components';
import { AppText as Text } from '../components/AppText';
import { FranchiseOfferModal } from '../components/FranchiseOfferModal';
import { DomesticClubOfferModal } from '../components/DomesticClubOfferModal';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { StarterPackModal } from '../components/StarterPackModal';
import { getCountry } from '../data/countries';
import { ECONOMY } from '../data/gameConfig';
import type { CareerCompetitionStatScope, NewspaperStory, PlayerStats } from '../domain/types';
import { computeOverall } from '../engine/rating';
import {
  ACHIEVEMENTS,
  getAchievement,
  MAX_GAMERSCORE,
  totalGamerscore,
} from '../game/achievements';
import {
  ACADEMY_COSTS,
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
import { activeCompetitionTable } from '../game/competitionTable';
import { areAdsRemoved, fixtureEnergyCost } from '../game/economy';
import { renderText } from '../game/narrative';
import { seasonAwards } from '../game/progression';
import {
  franchiseAuctionGate,
  seniorProfessionalFeaturesUnlocked,
  stockMarketUnlocked,
} from '../game/readiness';
import { rivalComparison } from '../game/rivalry';
import { activeSponsorBranding, sponsorshipOffers } from '../game/sponsorship';
import { PlayerCalendarChoice } from '../game/playerCalendar';
import { domesticCountryContractOffers } from '../game/playerMigration';
import { nextUserFixtureId, nextUserFixturesByCompetition } from '../game/season';
import { CAREER_COMPETITION_STAT_LABELS, earlierCareerStats, emptyStats } from '../game/stats';
import { getU19WorldCupState, u19WorldCupSelectionStatus } from '../game/u19WorldCup';
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

const CAREER_STAT_GROUPS: readonly {
  label: string;
  scopes: readonly CareerCompetitionStatScope[];
}[] = [
  { label: 'Pathway', scopes: ['GRADE_A', 'U19', 'U19_WORLD_CUP'] },
  {
    label: 'Domestic',
    scopes: ['DOMESTIC_T20', 'LIST_A', 'FIRST_CLASS', 'HUNDRED', 'T10'],
  },
  { label: 'International', scopes: ['T20I', 'ODI', 'TEST'] },
];

const ROLE_LABEL: Record<string, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALLROUNDER: 'All-Rounder',
  WK_BATTER: 'Wicket-Keeper',
};

type HubPage = 'home' | 'stats' | 'narrative' | 'progress' | 'profile';

const EMPTY_PRESS_ARCHIVE: readonly NewspaperStory[] = [];

/** Player Home's cricket-ticket palette. Kept local so the shared Player and Manager shell stays intact. */
const CRICKET_HOME = {
  cream: '#F2E5C6',
  creamDeep: '#C7A96B',
  creamInk: '#281C10',
  creamMuted: '#6D583B',
  leather: '#9B3328',
  leatherDark: '#6F211A',
} as const;

const PLAYER_GUIDE_STEPS = [
  {
    icon: 'home' as const,
    title: 'Follow the next action',
    body: 'Your next step.',
  },
  {
    icon: 'fitness' as const,
    title: 'Train with a purpose',
    body: 'Develop your role.',
  },
  {
    icon: 'game-controller' as const,
    title: 'Play your role',
    body: 'Choose your approach.',
  },
  {
    icon: 'trending-up' as const,
    title: 'Earn selection and progress',
    body: 'Selection and milestones.',
  },
  {
    icon: 'person' as const,
    title: 'Review your career',
    body: 'Stats, story and profile.',
  },
] as const;

export function CareerHubScreen({ navigation }: ScreenProps<'CareerHub'>) {
  const {
    save,
    refreshEnergy,
    newSeason,
    advanceSeason,
    advanceWhileBenched,
    claimDaily,
    retire,
    acceptAuctionOffer,
    declineAuction,
    acceptDomesticClubOffer,
    declineDomesticClubOffers,
    contractStatus,
    persistCritical,
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
      newSeason: s.newSeason,
      advanceSeason: s.advanceSeason,
      advanceWhileBenched: s.advanceWhileBenched,
      claimDaily: s.claimDaily,
      retire: s.retire,
      acceptAuctionOffer: s.acceptAuctionOffer,
      declineAuction: s.declineAuction,
      acceptDomesticClubOffer: s.acceptDomesticClubOffer,
      declineDomesticClubOffers: s.declineDomesticClubOffers,
      contractStatus: s.contractStatus,
      persistCritical: s.persistCritical,
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
  const [showStarterPack, setShowStarterPack] = useState(false);
  const starterPackShownRef = useRef(false);
  const [toastIdx, setToastIdx] = useState(0);
  const [selectedNewspaper, setSelectedNewspaper] = useState<NewspaperStory | null>(null);
  const prevPendingLenRef = useRef(-1);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert('Leave career?', 'Your save is kept.', [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.navigate('MainMenu') },
        ]);
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
  useEffect(() => {
    if (!pendingPressId) return;
    const pending = pressArchive.find((story) => story.id === pendingPressId);
    if (pending) setSelectedNewspaper(pending);
  }, [pendingPressId, pressArchive]);

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
  const u19WorldCup = getU19WorldCupState(save);
  const u19WorldCupSelection = u19WorldCupSelectionStatus(save);
  const showU19WorldCup =
    save.careerPathLevel === 'U19' ||
    u19WorldCupSelection.status === 'SELECTED' ||
    user.age === 18 ||
    u19WorldCup?.opportunityYear !== undefined;
  const u19WorldCupSummary = (() => {
    switch (u19WorldCupSelection.status) {
      case 'TRACKING':
        return `Age-18 selection · ${u19WorldCupSelection.merit.appearances}/3 appearances · ${u19WorldCupSelection.merit.averageRating.toFixed(1)}/6.0 rating · ${Math.round(u19WorldCupSelection.merit.readiness * 100)}%/55% ready`;
      case 'SELECTED': {
        const fixtureIds = [
          ...(u19WorldCup?.quarterFinalFixtureIds ?? []),
          ...(u19WorldCup?.semiFinalFixtureIds ?? []),
          ...(u19WorldCup?.finalFixtureId ? [u19WorldCup.finalFixtureId] : []),
        ];
        const started = fixtureIds.some((fixtureId) => save.fixtures[fixtureId]?.played);
        return started ? 'Selected · Tournament active' : 'Selected for the tournament';
      }
      case 'NOT_SELECTED':
        return 'Selection missed';
      case 'ELIMINATED':
        return 'Tournament run complete';
      case 'RUNNER_UP':
        return 'U19 World Cup runners-up';
      case 'CHAMPION':
        return 'U19 World Cup champions';
    }
  })();
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const stats = user.careerStats ?? emptyStats();
  const seasonStats = user.seasonStats ?? emptyStats();
  const recentPlayerMatches = save.playerLife?.recentMatches?.slice(0, 5) ?? [];
  const sponsorBranding = activeSponsorBranding(save);
  // Memoize CPU-heavy computations so they don't re-run on every render tick.
  // These are pure reads of the save blob — only recalculate when save changes.
  const competitionTable = activeCompetitionTable(save);
  const table = competitionTable.rows;
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
  const domesticClubOffers = save.domesticClubOffers ?? [];
  const currentSeasonSalary = Math.max(0, user.contract?.wage ?? 0);
  const seniorProUnlocked = seniorProfessionalFeaturesUnlocked(save);
  const contract = seniorProUnlocked ? contractStatus() : null;
  const rivalCmp = rivalComparison(save);
  const gamerscore = totalGamerscore(save);
  const earnedCount = (save.achievements ?? []).length;
  const inboxUnread = (save.inbox ?? []).filter((message) => !message.read).length;
  const nextStep = resolveNextCareerStep(save, {
    pendingPromotion: Boolean(lastPromotion?.promoted),
  });
  const earnedSponsorOffers = sponsorshipOffers(save);
  const portfolioUnlocked = stockMarketUnlocked(save.careerPathLevel, user.age);
  const portfolioHomeVisited = Boolean(save.flags?.playerHomePortfolioVisited);
  const academyReady = !save.personalAcademy && save.wallet.coins >= ACADEMY_COSTS[1];
  const retirementReviewDue = shouldPromptRetirement(user, save);
  const offFieldOpportunity = retirementReviewDue
    ? {
        kind: 'RETIREMENT' as const,
        icon: 'flag-outline' as const,
        title: 'Review your playing future',
        action: 'DECIDE',
      }
    : earnedSponsorOffers.length
    ? {
        kind: 'SPONSOR' as const,
        icon: 'shirt-outline' as const,
        title: 'Kit sponsor offers ready',
        action: 'REVIEW',
      }
    : portfolioUnlocked && !portfolioHomeVisited
      ? {
          kind: 'PORTFOLIO' as const,
          icon: 'trending-up-outline' as const,
          title: 'Portfolio is now available',
          action: 'VIEW',
        }
      : academyReady
        ? {
            kind: 'ACADEMY' as const,
            icon: 'school-outline' as const,
            title: 'Your academy is ready',
            action: 'OPEN',
          }
        : undefined;
  const careerSeasonNumber = (save.careerSeasons ?? 0) + 1;
  const calendarEvent = nextStep.mode === 'career' ? nextStep.calendarEvent : undefined;
  const countryContractOffers =
    calendarEvent?.kind === 'TRANSFER_WINDOW' ? domesticCountryContractOffers(save) : [];
  const identityLine = playerIdentityLine(save);
  const primaryIsStory =
    nextStep.mode === 'career' && nextStep.type === CareerStepType.STORY_EVENT_REQUIRED;
  const primaryIsCalendar = Boolean(
    nextStep.mode === 'career' &&
    nextStep.type === CareerStepType.TRAINING_MANDATORY &&
    calendarEvent,
  );
  const primaryCalendarNeedsChoice = Boolean(
    primaryIsCalendar &&
    (calendarEvent?.kind === 'EXAM' ||
      calendarEvent?.kind === 'TRAINING' ||
      calendarEvent?.kind === 'NCA_CAMP'),
  );
  const primaryCalendarAdvancesDirectly = Boolean(
    primaryIsCalendar && calendarEvent && !primaryCalendarNeedsChoice,
  );
  const primaryActionLabel =
    nextStep.action === 'OPEN_STORY'
      ? 'Open story'
      : nextStep.action === 'PLAY_MATCH'
        ? 'Play match'
        : nextStep.action === 'SIMULATE_MATCH'
          ? 'Advance while benched'
          : nextStep.action === 'REFILL_ENERGY'
            ? 'Restore energy'
            : nextStep.action === 'ACKNOWLEDGE_PROMOTION'
              ? 'Continue'
              : nextStep.action === 'ADVANCE_SEASON'
                ? `Start Season ${careerSeasonNumber + 1}`
                : nextStep.action === 'ADVANCE_CAREER_CALENDAR'
                  ? 'Continue season'
                  : nextStep.action === 'OPEN_TRAINING'
                    ? 'Open training'
                    : 'Continue';
  const openOffFieldOpportunity = () => {
    if (!offFieldOpportunity) return;
    hapticTap();
    if (offFieldOpportunity.kind === 'RETIREMENT') {
      onRetire();
      return;
    }
    if (offFieldOpportunity.kind === 'SPONSOR') {
      navigation.navigate('PlayerLife', { initialTab: 'media' });
      return;
    }
    if (offFieldOpportunity.kind === 'PORTFOLIO') {
      markFlagSeen('playerHomePortfolioVisited');
      navigation.navigate('InvestmentScreen');
      return;
    }
    navigation.navigate('AcademyManagement');
  };
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
        showShortageOffer(save, 'energy', (productId) => navigation.navigate('Purchase', { productId }));
        break;
      case 'PLAY_MATCH':
        void handlePlayMatch();
        break;
      case 'SIMULATE_MATCH': {
        const outcome = advanceWhileBenched();
        if (outcome.ok) {
          const current = useCareer.getState().save;
          const nextFixture = outcome.nextFixtureId
            ? current?.fixtures[outcome.nextFixtureId]
            : undefined;
          const selectedNext =
            current && nextFixture && outcome.nextFixtureId
              ? careerSelectionDecision(current, nextFixture.format, outcome.nextFixtureId).selected
              : false;
          setContractFlash(
            selectedNext
              ? `${outcome.simulated} team fixture${outcome.simulated === 1 ? '' : 's'} advanced. You are back in the XI.`
              : `${outcome.simulated} team fixture${outcome.simulated === 1 ? '' : 's'} advanced while you were outside the XI.`,
          );
          setTimeout(() => setContractFlash(null), 3200);
        } else if (outcome.reason) {
          Alert.alert('Team selection', outcome.reason);
        }
        break;
      }
      case 'ADVANCE_SEASON':
        newSeason();
        break;
      case 'ADVANCE_CAREER_CALENDAR':
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
    try {
      await persistCritical(true);
      goMenu();
    } catch {
      Alert.alert(
        'Save failed',
        'Your device did not confirm the save. Stay in the career and try again before closing the app.',
      );
    }
  };

  function onRetire() {
    Alert.alert(
      'Retire from cricket?',
      'This ends the career for good. You can begin again with a protégé (New Game+).',
      [
        { text: 'Play on', style: 'cancel' },
        { text: 'Retire', style: 'destructive', onPress: () => retire() },
      ],
    );
  }

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
                config={save.cosmetics?.avatarConfig}
                kitId={save.cosmetics?.kit}
                profileFrame={save.cosmetics?.profileFrame}
                earnedSponsor={sponsorBranding.earned}
                premiumSponsor={sponsorBranding.premium}
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
                  <View key={i} style={styles.honourPill}>
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
                <View key={i} style={styles.tlRow}>
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
      <View style={styles.fixtureTicketWrap}>
        <View style={[styles.fixtureTicket, !fixture && styles.fixtureTicketCompact]}>
          <View style={styles.ticketStitchRail}>
            {[0, 1, 2, 3, 4, 5, 6].map((stitch) => (
              <View key={stitch} style={styles.ticketStitch} />
            ))}
          </View>
          <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
          <View style={[styles.ticketNotch, styles.ticketNotchRight]} />
          <View style={styles.ticketTopRule} />
          <Text style={styles.ticketKicker}>
            {primaryIsStory ? 'CAREER DECISION' : fixture ? 'NEXT FIXTURE' : 'NEXT CHAPTER'}
          </Text>
          <Text style={styles.ticketTitle} numberOfLines={2}>
            {primaryIsStory && storyPreview?.title ? storyPreview.title : nextStep.title}
          </Text>

          {fixture && opponentId ? (
            <>
              <View style={styles.ticketTeamsRow}>
                <View style={styles.ticketTeam}>
                  <View
                    style={[
                      styles.ticketCrest,
                      { backgroundColor: fixtureTeam?.primaryColor ?? colors.surfaceAlt },
                    ]}
                  >
                    <Text style={styles.ticketCrestText}>{fixtureTeam?.shortName}</Text>
                  </View>
                  <Text style={styles.ticketTeamName} numberOfLines={2}>
                    {fixtureTeam?.name ?? 'Your team'}
                  </Text>
                </View>
                <View style={styles.ticketVersus}>
                  <Text style={styles.ticketVs}>VS</Text>
                  <Text style={styles.ticketFormat}>{fixture.cupRound ?? fixture.format}</Text>
                  <Text style={styles.ticketRound}>ROUND {fixture.round}</Text>
                </View>
                <View style={styles.ticketTeam}>
                  <View
                    style={[
                      styles.ticketCrest,
                      {
                        backgroundColor:
                          save.teams[opponentId]?.primaryColor ?? CRICKET_HOME.leather,
                      },
                    ]}
                  >
                    <Text style={styles.ticketCrestText}>{save.teams[opponentId]?.shortName}</Text>
                  </View>
                  <Text style={styles.ticketTeamName} numberOfLines={2}>
                    {save.teams[opponentId]?.name ?? 'Opposition'}
                  </Text>
                </View>
              </View>
              <View style={styles.ticketDetailsRow}>
                <View style={styles.ticketDetail}>
                  <Text style={styles.ticketDetailLabel}>VENUE</Text>
                  <Text style={styles.ticketDetailValue} numberOfLines={1}>
                    {fixture.venue}
                  </Text>
                </View>
                <View style={styles.ticketDetailDivider} />
                <View style={styles.ticketDetail}>
                  <Text style={styles.ticketDetailLabel}>STATUS</Text>
                  <Text
                    style={[
                      styles.ticketDetailValue,
                      {
                        color: selectionOutlook?.selected ? colors.success : CRICKET_HOME.leather,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {selectionOutlook?.selected
                      ? 'SELECTED'
                      : selectionOutlook?.reason.startsWith('Unavailable')
                        ? 'UNAVAILABLE'
                        : selectionOutlook?.reason.startsWith('Rested')
                          ? 'RESTED'
                          : 'BENCHED'}
                  </Text>
                </View>
                <View style={styles.ticketInfoButton}>
                  <MechanicInfoButton topicId="selection-formula" size={34} />
                </View>
              </View>
              {selectionOutlook?.selected === false ? (
                <Text style={styles.ticketBenchReason}>{selectionOutlook.reason}</Text>
              ) : null}
            </>
          ) : null}

          {primaryCalendarNeedsChoice ? (
            <View style={styles.calendarChoiceRow}>
              <Button
                label={
                  calendarEvent?.kind === 'EXAM'
                    ? 'Study'
                    : calendarEvent?.kind === 'NCA_CAMP'
                      ? 'Attend camp'
                      : 'Skill work'
                }
                variant="gold"
                style={styles.calendarChoiceButton}
                onPress={() =>
                  resolveCalendar(
                    calendarEvent?.kind === 'EXAM'
                      ? 'STUDY'
                      : calendarEvent?.kind === 'NCA_CAMP'
                        ? 'ATTEND'
                        : 'SKILL',
                  )
                }
              />
              <Button
                label={
                  calendarEvent?.kind === 'EXAM'
                    ? 'Extra nets'
                    : calendarEvent?.kind === 'NCA_CAMP'
                      ? 'Recover'
                      : 'Fitness'
                }
                variant="secondary"
                style={styles.calendarChoiceButton}
                onPress={() =>
                  resolveCalendar(
                    calendarEvent?.kind === 'EXAM'
                      ? 'TRAIN'
                      : calendarEvent?.kind === 'NCA_CAMP'
                        ? 'REST'
                        : 'FITNESS',
                  )
                }
              />
            </View>
          ) : null}

          {primaryCalendarAdvancesDirectly ? (
            <Button
              label={
                calendarEvent?.kind === 'SELECTION'
                  ? 'Attend Selection Meeting'
                  : calendarEvent?.kind === 'RECOVERY'
                    ? 'Complete Recovery Week'
                    : 'Continue'
              }
              variant="gold"
              style={styles.ticketPrimaryAction}
              onPress={() => resolveCalendar()}
            />
          ) : null}

          {!fixture && !primaryIsCalendar ? (
            <>
              <Button
                label={primaryActionLabel}
                variant="gold"
                style={styles.ticketPrimaryAction}
                onPress={runPrimaryAction}
              />
              {nextStep.action === 'ADVANCE_CAREER_CALENDAR' ? (
                <Button
                  label="Train first"
                  variant="secondary"
                  style={styles.ticketSecondaryAction}
                  onPress={() => navigation.navigate('Training')}
                />
              ) : null}
            </>
          ) : null}
          {fixture && !primaryIsCalendar ? (
            <Button
              label={primaryActionLabel}
              variant="gold"
              style={styles.ticketPrimaryAction}
              onPress={runPrimaryAction}
            />
          ) : null}
          <View style={styles.ticketBottomRule} />
        </View>

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
            <Text style={styles.fixtureActionDot}>•</Text>
            <Text style={styles.fixtureEnergyLabel}>
              {selectionOutlook?.selected ? `${matchEnergyCost} energy` : 'No energy cost'}
            </Text>
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
      </View>

      <SeasonPassHomeCard />

      {offFieldOpportunity ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${offFieldOpportunity.title}. ${offFieldOpportunity.action}`}
          onPress={openOffFieldOpportunity}
          style={styles.offFieldOpportunity}
        >
          <View style={styles.offFieldOpportunityIcon}>
            <Icon name={offFieldOpportunity.icon} size={21} color={CRICKET_HOME.cream} />
          </View>
          <View style={styles.offFieldOpportunityCopy}>
            <Text style={styles.offFieldOpportunityKicker}>
              {offFieldOpportunity.kind === 'RETIREMENT'
                ? 'CAREER DECISION'
                : 'OFF-FIELD OPPORTUNITY'}
            </Text>
            <Text style={styles.offFieldOpportunityTitle} numberOfLines={1}>
              {offFieldOpportunity.title}
            </Text>
          </View>
          <Text style={styles.offFieldOpportunityAction}>
            {offFieldOpportunity.action} →
          </Text>
        </Pressable>
      ) : null}

      {calendarEvent?.kind === 'TRANSFER_WINDOW' && countryContractOffers.length > 0 ? (
        <Card style={styles.countryMoveCard}>
          <Text style={styles.tierLabel}>Overseas contract offers</Text>
          <View
            style={[
              styles.countryOffer,
              !save.pendingDomesticCountry && styles.countryOfferSelected,
            ]}
          >
            <View style={styles.countryOfferCopy}>
              <Text style={styles.countryOfferClub}>{team?.name ?? 'Current club'}</Text>
              <Text style={styles.countryOfferMeta}>
                {getCountry(save.playerCareerResources?.domesticCountry ?? '')?.name ?? 'Home'} ·{' '}
                {currentSeasonSalary > 0
                  ? `${currentSeasonSalary.toLocaleString()} coins/season`
                  : 'renewal due'}
              </Text>
            </View>
            <Button
              label={!save.pendingDomesticCountry ? 'Staying' : 'Stay'}
              variant={!save.pendingDomesticCountry ? 'gold' : 'secondary'}
              size="sm"
              fullWidth={false}
              onPress={() => {
                const countryId = save.playerCareerResources?.domesticCountry;
                if (!countryId) return;
                const result = requestDomesticCountryMove(countryId);
                if (!result.ok && result.reason) Alert.alert('Contract offer', result.reason);
              }}
            />
          </View>
          {countryContractOffers.map((offer) => {
            const pending = save.pendingDomesticCountry === offer.countryId;
            const increase =
              currentSeasonSalary > 0
                ? Math.max(
                    0,
                    Math.round((offer.seasonSalary / currentSeasonSalary - 1) * 100),
                  )
                : null;
            return (
              <View
                key={offer.countryId}
                style={[styles.countryOffer, pending && styles.countryOfferSelected]}
              >
                <View style={styles.countryOfferCopy}>
                  <Text style={styles.countryOfferClub}>{offer.teamName}</Text>
                  <Text style={styles.countryOfferMeta}>
                    {offer.countryName} · {offer.seasonSalary.toLocaleString()} coins/season
                    {increase !== null ? ` · +${increase}%` : ''}
                  </Text>
                  <Text style={styles.countryOfferBonus}>
                    {offer.signingBonus.toLocaleString()} coin signing bonus
                  </Text>
                </View>
                <Button
                  label={pending ? 'Accepted' : 'Accept'}
                  variant={pending ? 'gold' : 'secondary'}
                  size="sm"
                  fullWidth={false}
                  onPress={() => {
                    const result = requestDomesticCountryMove(offer.countryId);
                    if (!result.ok && result.reason) Alert.alert('Contract offer', result.reason);
                  }}
                />
              </View>
            );
          })}
        </Card>
      ) : null}

      <View style={styles.formScoreboard} accessibilityRole="summary">
        <View style={styles.scoreboardHeadingRow}>
          <View style={styles.scoreboardBatIcon}>
            <View style={styles.scoreboardBatBlade} />
            <View style={styles.scoreboardBatHandle} />
          </View>
          <Text style={styles.scoreboardHeading}>CURRENT FORM</Text>
          <Text
            style={[
              styles.scoreboardAvailability,
              user.injury && styles.scoreboardAvailabilityRecovery,
            ]}
          >
            {user.injury ? 'IN RECOVERY' : 'AVAILABLE'}
          </Text>
        </View>
        <View style={[styles.formMetricRow, compact && styles.formMetricRowCompact]}>
          <View style={styles.formMetric}>
            <Text style={styles.formMetricLabel}>SEASON RUNS</Text>
            <Text style={styles.formMetricValue}>{seasonStats.runs.toLocaleString()}</Text>
          </View>
          <View style={styles.formMetricDivider} />
          <View style={styles.formMetric}>
            <Text style={styles.formMetricLabel}>BATTING AVG</Text>
            <Text style={styles.formMetricValue}>
              {seasonStats.matches > 0
                ? (
                    seasonStats.runs / Math.max(1, seasonStats.matches - (seasonStats.notOuts ?? 0))
                  ).toFixed(1)
                : '0.0'}
            </Text>
          </View>
          <View style={styles.formMetricDivider} />
          <View style={[styles.formMetric, styles.formRecentMetric]}>
            <Text style={styles.formMetricLabel}>RECENT SCORES</Text>
            {recentPlayerMatches.length ? (
              <View style={styles.recentScoresRow}>
                {recentPlayerMatches.map((match) => (
                  <View
                    key={match.id}
                    style={[
                      styles.recentScoreChip,
                      match.result === 'W'
                        ? styles.recentScoreWin
                        : match.result === 'L'
                          ? styles.recentScoreLoss
                          : styles.recentScoreDraw,
                    ]}
                  >
                    <Text style={styles.recentScoreText}>
                      {user.role === 'BOWLER'
                        ? `${match.wickets}W`
                        : user.role === 'ALLROUNDER'
                          ? `${match.runs}/${match.wickets}W`
                          : match.runs}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noRecentScores}>NO APPEARANCES YET</Text>
            )}
          </View>
        </View>
      </View>

      {/* Contract renewal — now with negotiation */}
      {contract?.expiring && !contractFlash ? (
        <Card style={styles.auctionCard}>
          <Text style={styles.auctionTitle}>📝 Contract Renewal</Text>
          <Text style={styles.note}>
            {contract.offer.years} year{contract.offer.years === 1 ? '' : 's'} ·{' '}
            {contract.offer.wage > 0
              ? `${contract.offer.wage.toLocaleString()} coins/season`
              : 'market rate'}
            {contract.offer.signingBonus > 0
              ? ` · +${contract.offer.signingBonus.toLocaleString()} signing`
              : ''}
          </Text>
          <Button
            label="Review offer"
            variant="gold"
            style={{ marginTop: spacing.sm }}
            onPress={() => navigation.navigate('ContractNegotiation')}
          />
        </Card>
      ) : contractFlash ? (
        <Card style={styles.auctionCard}>
          <Text style={styles.note}>{contractFlash}</Text>
        </Card>
      ) : null}

      {/* Cricket journey — scorebook presentation, same profile route and career data. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open player profile"
        style={styles.journeyBoard}
        onPress={() => navigation.navigate('PlayerProfile', { playerId: user.id })}
      >
        <View style={styles.journeyHeader}>
          <View style={styles.journeyTrophy}>
            <Text style={styles.journeyTrophyGlyph}>🏆</Text>
          </View>
          <View style={styles.journeyHeadingCopy}>
            <Text style={styles.journeyEyebrow}>CRICKET JOURNEY</Text>
            <Text style={styles.journeyTitle} numberOfLines={1}>
              {CAREER_PATH_LABEL[save.careerPathLevel ?? 'DOMESTIC']}
            </Text>
          </View>
          <View style={styles.ovrRingMini}>
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
        <View style={[styles.journeyMetrics, compact && styles.journeyMetricsCompact]}>
          <Stat label="Matches" value={stats.matches} />
          <View style={styles.journeyDivider} />
          <Stat label="Runs" value={stats.runs.toLocaleString()} />
          <View style={styles.journeyDivider} />
          <Stat label="High score" value={stats.highScore} />
          <View style={styles.journeyDivider} />
          <Stat label="Wickets" value={stats.wickets} />
        </View>
        {(save.careerPathLevel ?? 'DOMESTIC') !== 'INTERNATIONAL' ? (
          <View style={styles.journeyProgressRow}>
            <View style={styles.journeyProgressCopy}>
              <Text style={styles.journeyProgressLabel}>NEXT MILESTONE</Text>
              <Text style={styles.journeyProgressValue}>{nextCareerPathLabel(save)}</Text>
            </View>
            <Text style={styles.journeyProgressPct}>
              {Math.round(careerPathProgress(save, user) * 100)}%
            </Text>
          </View>
        ) : null}
        <Text style={styles.journeyOpenLabel}>OPEN MY CAREER →</Text>
      </Pressable>

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

      {canClaimDaily && (
        <Button
          label="🎁 Claim daily reward"
          variant="gold"
          style={{ marginTop: spacing.md }}
          onPress={handleClaimDaily}
        />
      )}

      {/* Competition picker — shown when multiple formats available (Feature 4) */}
      {competitionOptions.length > 1 && (
        <>
          <Text style={styles.section}>Other Competitions</Text>
          <Card style={{ marginTop: 0 }}>
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
            {competitionOptions.some((opt) => {
              const optionFixture = save.fixtures[opt.fixtureId];
              return optionFixture && save.wallet.energy < fixtureEnergyCost(optionFixture);
            }) ? (
              <Button
                label="Restore energy"
                variant="gold"
                size="sm"
                style={{ marginTop: spacing.md }}
                onPress={() => navigation.navigate('Purchase')}
              />
            ) : null}
          </Card>
        </>
      )}

      {/* League position preview — hidden for youth players (they're not in the league yet) */}
      {(() => {
        const pathLevel = save.careerPathLevel ?? 'DOMESTIC';
        const isYouth = pathLevel === 'SCHOOL' || pathLevel === 'U19';
        if (isYouth) return null;
        const tableTeamId = competitionTable.highlightTeamId ?? save.userTeamId;
        const tableTeam = tableTeamId ? save.teams[tableTeamId] : team;
        const myRow = table.find((r) => r.teamId === tableTeamId);
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
                  <Text style={styles.leaguePreviewTeam}>{tableTeam?.name ?? '—'}</Text>
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

      <Text style={styles.section}>Career by Competition</Text>
      <Card style={styles.scopeTable}>
        {(() => {
          const earlier = earlierCareerStats(user);
          if (earlier.matches === 0 && earlier.runs === 0 && earlier.wickets === 0) return null;
          return (
            <View>
              <Text style={styles.scopeGroupLabel}>Earlier record</Text>
              <CareerScopeRow label="Combined career" stats={earlier} />
            </View>
          );
        })()}
        {CAREER_STAT_GROUPS.map((group, groupIndex) => {
          const visibleScopes = group.scopes.filter(
            (scope) =>
              !['HUNDRED', 'T10'].includes(scope) ||
              (user.competitionStats?.[scope]?.matches ?? 0) > 0,
          );
          return (
            <View key={group.label}>
              <Text style={styles.scopeGroupLabel}>{group.label}</Text>
              {visibleScopes.map((scope, scopeIndex) => (
                <CareerScopeRow
                  key={scope}
                  label={CAREER_COMPETITION_STAT_LABELS[scope]}
                  stats={user.competitionStats?.[scope] ?? emptyStats()}
                  last={
                    groupIndex === CAREER_STAT_GROUPS.length - 1 &&
                    scopeIndex === visibleScopes.length - 1
                  }
                />
              ))}
            </View>
          );
        })}
      </Card>
      {/* League table */}
      <Text style={styles.section}>{competitionTable.title}</Text>
      <Card>
        <LeagueTable
          rows={competitionTable.rows}
          teams={save.teams}
          highlightTeamId={competitionTable.highlightTeamId}
        />
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
            const to = lastPromotion.to!;
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
                  <Text style={styles.promotionLine}>Next · {nextObjective}</Text>
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
                  label={canPlay ? `🧢 Represent ${countryName}` : 'Restore energy'}
                  variant="gold"
                  style={{ marginTop: spacing.sm }}
                  onPress={() =>
                    canPlay
                      ? navigation.navigate('Match', { intl: true })
                      : navigation.navigate('Purchase')
                  }
                />
              )}
              {nat.capped && nat.caps === 0 && (
                <>
                  <Text style={[styles.note, { marginTop: spacing.md }]}>
                    {countryName} · Locks after your first senior cap.
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
                  <Text style={styles.note}>{countryName} selection watch</Text>
                  <ProgressBar
                    value={nat.rep / 100}
                    color={colors.primaryLight}
                    style={{ marginTop: spacing.sm }}
                  />
                  <Text style={[styles.note, { marginTop: spacing.md }]}>
                    Locks after your first senior cap.
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
        label="Player Life"
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

      {/* One-time, merit-based U19 World Cup opportunity. */}
      {showU19WorldCup && (
        <>
          <Text style={styles.section}>U19 World Cup</Text>
          <Card>
            <Text style={[styles.tierLabel, { fontSize: fontSize.md }]}>🏆 Under-19 World Cup</Text>
            <Text style={styles.note}>{u19WorldCupSummary}</Text>
            <Button
              label="View tournament"
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
          <Text style={styles.note}>Retire to begin a Manager Career.</Text>
        </Card>
      )}

      {/* Retire */}
      {shouldPromptRetirement(user, save) && (
        <Text style={styles.retireHint}>The time is right to review your playing future.</Text>
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
              <Text style={styles.legacySub}>New Game+ head-start</Text>
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
            {legacyScore >= 100 ? '✦ Maximum legacy' : `Next tier at ${nextMilestone}`}
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
        <LiveOpsCards />
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
          title={page === 'home' ? 'Player Career' : user.name}
          subtitle={
            page === 'home'
              ? `${activePathTeam?.name ?? team?.name ?? ''} · Season ${careerSeasonNumber} · ${season?.year ?? ''}`
              : `${activePathTeam?.name ?? team?.name ?? ''} · Season ${careerSeasonNumber} · Age ${user.age}`
          }
          onBack={goMenu}
        />
        {page === 'home' ? (
          <View style={[styles.playerMasthead, compact && styles.playerMastheadCompact]}>
            <View style={styles.mastheadGoldRule} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${user.name}, ${ROLE_LABEL[user.role] ?? user.role}, ${CAREER_PATH_LABEL[save.careerPathLevel ?? 'DOMESTIC']}, ${countryName}, age ${user.age}, overall ${userOverall}, form ${Math.round(user.meta.form)}, condition ${Math.round(save.playerCareerResources?.playerCondition ?? 100)}, coach trust ${Math.round(save.playerCareerResources?.coachTrust ?? 55)}${sponsorBranding.earned?.brandName ? `, kit sponsor ${sponsorBranding.earned.brandName}` : ''}${sponsorBranding.premium?.brandName ? `, premium sponsor ${sponsorBranding.premium.brandName}` : ''}. Open player profile.`}
              onPress={() => navigation.navigate('PlayerProfile', { playerId: user.id })}
              style={styles.mastheadProfileLink}
            >
              <PlayerAvatar
                name={user.name}
                role={user.role}
                primaryColor={team?.primaryColor}
                secondaryColor={team?.secondaryColor}
                config={save.cosmetics?.avatarConfig}
                kitId={save.cosmetics?.kit}
                profileFrame={save.cosmetics?.profileFrame}
                earnedSponsor={sponsorBranding.earned}
                premiumSponsor={sponsorBranding.premium}
                size="lg"
                showRole
              />
              <View style={styles.mastheadIdentity}>
                <Text style={styles.mastheadName} numberOfLines={1} adjustsFontSizeToFit>
                  {user.name}
                </Text>
                <Text style={styles.mastheadRole} numberOfLines={1}>
                  {user.battingStyle === 'RHB' ? 'RIGHT-HAND BAT' : 'LEFT-HAND BAT'} ·{' '}
                  {(ROLE_LABEL[user.role] ?? user.role).toUpperCase()}
                </Text>
                <Text style={styles.mastheadPath} numberOfLines={2}>
                  {CAREER_PATH_LABEL[save.careerPathLevel ?? 'DOMESTIC']} · {countryName} · Age{' '}
                  {user.age}
                </Text>
                <View style={styles.mastheadAvailability}>
                  <View
                    style={[
                      styles.mastheadStatusDot,
                      {
                        backgroundColor: user.injury ? CRICKET_HOME.leather : colors.success,
                      },
                    ]}
                  />
                  <Text style={styles.mastheadAvailabilityText}>
                    {user.injury ? 'IN RECOVERY' : 'AVAILABLE'}
                  </Text>
                </View>
                <Text style={styles.mastheadReadiness} numberOfLines={1}>
                  FORM {Math.round(user.meta.form)} · CONDITION{' '}
                  {Math.round(save.playerCareerResources?.playerCondition ?? 100)} · TRUST{' '}
                  {Math.round(save.playerCareerResources?.coachTrust ?? 55)}
                </Text>
              </View>
            </Pressable>
            <View style={styles.mastheadSideActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Player Life"
                onPress={() => navigation.navigate('PlayerLife')}
                style={styles.mastheadLifeAction}
              >
                <Text style={styles.mastheadLifeActionText}>PLAYER LIFE</Text>
                <Icon name="chevron-forward" size={14} color={colors.accentLight} />
              </Pressable>
            </View>
          </View>
        ) : (
          <CareerSpotlight
            mode="player"
            title={identityLine}
            meta={`${CAREER_PATH_LABEL[save.careerPathLevel ?? 'DOMESTIC']} | ${countryName} | ${userOverall} OVR`}
            accentColor={activePathTeam?.primaryColor ?? team?.primaryColor ?? colors.accent}
            status={`FORM ${Math.round(user.meta.form)} | COND ${Math.round(save.playerCareerResources?.playerCondition ?? 100)} | TRUST ${Math.round(save.playerCareerResources?.coachTrust ?? 55)}`}
          />
        )}
        <View style={styles.walletSection}>
          <WalletBar wallet={save.wallet} />
        </View>

        <View style={styles.pageContent}>{renderPageContent()}</View>
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
      <FranchiseOfferModal
        save={save}
        offers={selectedNewspaper || domesticClubOffers.length > 0 ? [] : offers}
        onAccept={async (teamId) => {
          await hapticTap();
          acceptAuctionOffer(teamId);
        }}
        onStay={declineAuction}
      />
      <DomesticClubOfferModal
        save={save}
        offers={selectedNewspaper ? [] : domesticClubOffers}
        onAccept={async (teamId) => {
          await hapticTap();
          acceptDomesticClubOffer(teamId);
        }}
        onStay={declineDomesticClubOffers}
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
    walletSection: { marginTop: spacing.md },
    pageContent: { marginTop: spacing.md },
    playerMasthead: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderBottomColor: colors.accentDark,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      marginHorizontal: -spacing.md,
      marginTop: spacing.sm,
      minHeight: 128,
      overflow: 'hidden',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      position: 'relative',
    },
    playerMastheadCompact: {
      alignItems: 'flex-start',
      paddingHorizontal: spacing.md,
    },
    mastheadProfileLink: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: spacing.md,
      minWidth: 0,
    },
    mastheadSideActions: {
      alignItems: 'flex-end',
      flexShrink: 0,
      justifyContent: 'center',
    },
    mastheadLifeAction: {
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderColor: colors.accentDark,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 2,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.sm,
    },
    mastheadLifeActionText: {
      color: colors.accentLight,
      fontFamily: fonts.display,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0.35,
    },
    mastheadGoldRule: {
      backgroundColor: colors.accent,
      height: 2,
      left: spacing.md,
      opacity: 0.78,
      position: 'absolute',
      right: spacing.md,
      top: 0,
    },
    mastheadIdentity: { flex: 1, minWidth: 0 },
    mastheadName: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      letterSpacing: 0.3,
    },
    mastheadRole: {
      color: colors.accentLight,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.4,
      marginTop: 2,
    },
    mastheadPath: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: 3,
    },
    mastheadAvailability: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      marginTop: spacing.xs,
    },
    mastheadStatusDot: { borderRadius: 5, height: 9, width: 9 },
    mastheadAvailabilityText: {
      color: colors.text,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.25,
    },
    mastheadReadiness: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      marginTop: 3,
    },
    fixtureTicketWrap: { marginBottom: spacing.md },
    fixtureTicket: {
      backgroundColor: CRICKET_HOME.cream,
      borderColor: colors.accentDark,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      minHeight: 208,
      overflow: 'hidden',
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingLeft: spacing.xxl,
      paddingTop: spacing.md,
      position: 'relative',
    },
    fixtureTicketCompact: {
      minHeight: 128,
    },
    ticketStitchRail: {
      alignItems: 'center',
      borderRightColor: CRICKET_HOME.leather,
      borderRightWidth: 1,
      bottom: 8,
      gap: 7,
      justifyContent: 'center',
      left: 9,
      position: 'absolute',
      top: 8,
      width: 13,
    },
    ticketStitch: {
      backgroundColor: CRICKET_HOME.leather,
      height: 2,
      transform: [{ rotate: '34deg' }],
      width: 12,
    },
    ticketNotch: {
      backgroundColor: colors.bgElevated,
      borderColor: colors.accentDark,
      borderRadius: 18,
      borderWidth: 1,
      height: 36,
      position: 'absolute',
      top: '48%',
      width: 36,
      zIndex: 4,
    },
    ticketNotchLeft: { left: -22 },
    ticketNotchRight: { right: -22 },
    ticketTopRule: {
      backgroundColor: CRICKET_HOME.leather,
      height: 1,
      left: spacing.xxl,
      opacity: 0.52,
      position: 'absolute',
      right: spacing.md,
      top: 8,
    },
    ticketBottomRule: {
      backgroundColor: CRICKET_HOME.leather,
      bottom: 8,
      height: 1,
      left: spacing.xxl,
      opacity: 0.52,
      position: 'absolute',
      right: spacing.md,
    },
    ticketKicker: {
      color: CRICKET_HOME.leather,
      fontFamily: fonts.display,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      textAlign: 'center',
    },
    ticketTitle: {
      color: CRICKET_HOME.creamInk,
      fontFamily: fonts.display,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      lineHeight: 27,
      marginTop: 2,
      textAlign: 'center',
    },
    ticketTeamsRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    ticketTeam: { alignItems: 'center', flex: 1, minWidth: 0 },
    ticketCrest: {
      alignItems: 'center',
      borderColor: CRICKET_HOME.creamInk,
      borderRadius: radius.sm,
      borderWidth: 2,
      height: 52,
      justifyContent: 'center',
      paddingHorizontal: 3,
      width: 52,
    },
    ticketCrestText: {
      color: '#FFFFFF',
      fontFamily: fonts.display,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.65)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 1,
    },
    ticketTeamName: {
      color: CRICKET_HOME.creamInk,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      lineHeight: 12,
      marginTop: 3,
      textAlign: 'center',
    },
    ticketVersus: { alignItems: 'center', minWidth: 74, paddingTop: 3 },
    ticketVs: {
      color: colors.accentDark,
      fontFamily: fonts.display,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      lineHeight: 31,
    },
    ticketFormat: {
      color: CRICKET_HOME.creamInk,
      fontSize: 10,
      fontWeight: fontWeight.black,
      marginTop: 1,
      textAlign: 'center',
      textTransform: 'uppercase',
    },
    ticketRound: {
      color: CRICKET_HOME.creamMuted,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      marginTop: 1,
    },
    ticketDetailsRow: {
      alignItems: 'center',
      borderBottomColor: CRICKET_HOME.creamDeep,
      borderBottomWidth: 1,
      borderTopColor: CRICKET_HOME.creamDeep,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
      minHeight: 44,
      paddingVertical: spacing.xs,
    },
    ticketDetail: { flex: 1, minWidth: 0 },
    ticketDetailLabel: {
      color: CRICKET_HOME.creamMuted,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.7,
    },
    ticketDetailValue: {
      color: CRICKET_HOME.creamInk,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      marginTop: 1,
    },
    ticketDetailDivider: { backgroundColor: CRICKET_HOME.creamDeep, height: 28, width: 1 },
    ticketInfoButton: { marginLeft: -spacing.xs },
    ticketReason: {
      color: CRICKET_HOME.creamMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    offFieldOpportunity: {
      alignItems: 'center',
      backgroundColor: CRICKET_HOME.leatherDark,
      borderColor: CRICKET_HOME.leather,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
      minHeight: 64,
      padding: spacing.sm,
    },
    offFieldOpportunityIcon: {
      alignItems: 'center',
      backgroundColor: CRICKET_HOME.leather,
      borderColor: CRICKET_HOME.creamDeep,
      borderRadius: 22,
      borderWidth: 1,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    offFieldOpportunityCopy: { flex: 1, minWidth: 0 },
    offFieldOpportunityKicker: {
      color: CRICKET_HOME.creamDeep,
      fontFamily: fonts.display,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0.7,
    },
    offFieldOpportunityTitle: {
      color: CRICKET_HOME.cream,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    offFieldOpportunityAction: {
      color: colors.accentLight,
      flexShrink: 0,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0.25,
      paddingHorizontal: spacing.xs,
    },
    fixtureActionDot: { color: colors.textFaint, fontSize: fontSize.sm },
    fixtureEnergyLabel: { color: colors.textMuted, fontSize: fontSize.xs },
    formScoreboard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.accentDark,
      borderRadius: radius.sm,
      borderWidth: 1,
      marginBottom: spacing.md,
      padding: spacing.md,
    },
    scoreboardHeadingRow: {
      alignItems: 'center',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    scoreboardBatIcon: { height: 25, position: 'relative', width: 14 },
    scoreboardBatBlade: {
      backgroundColor: colors.accentDark,
      borderRadius: 2,
      bottom: 0,
      height: 18,
      left: 2,
      position: 'absolute',
      transform: [{ rotate: '24deg' }],
      width: 7,
    },
    scoreboardBatHandle: {
      backgroundColor: CRICKET_HOME.cream,
      height: 9,
      position: 'absolute',
      right: 1,
      top: 0,
      transform: [{ rotate: '24deg' }],
      width: 3,
    },
    scoreboardHeading: {
      color: colors.accentLight,
      flex: 1,
      fontFamily: fonts.display,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      letterSpacing: 0.7,
    },
    scoreboardAvailability: {
      color: colors.success,
      fontSize: 9,
      fontWeight: fontWeight.bold,
    },
    scoreboardAvailabilityRecovery: { color: CRICKET_HOME.leather },
    formMetricRow: {
      alignItems: 'stretch',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.md,
    },
    formMetricRowCompact: { flexWrap: 'wrap', rowGap: spacing.md },
    formMetric: { flex: 1, minWidth: 60 },
    formMetricDivider: { backgroundColor: colors.borderStrong, marginHorizontal: 6, width: 1 },
    formMetricLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.45,
    },
    formMetricValue: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    formMetricSuccess: { color: colors.success },
    formRecentMetric: { flex: 2.4, minWidth: 150 },
    recentScoresRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 5,
    },
    recentScoreChip: {
      alignItems: 'center',
      borderRadius: 4,
      minWidth: 34,
      paddingHorizontal: 6,
      paddingVertical: 5,
    },
    recentScoreWin: { backgroundColor: 'rgba(39, 130, 74, 0.42)' },
    recentScoreLoss: { backgroundColor: 'rgba(155, 51, 40, 0.46)' },
    recentScoreDraw: { backgroundColor: colors.surfaceAlt },
    recentScoreText: {
      color: colors.text,
      fontFamily: fonts.display,
      fontSize: 11,
      fontWeight: fontWeight.black,
    },
    noRecentScores: { color: colors.textFaint, fontSize: 9, marginTop: 7 },
    journeyBoard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.accentDark,
      borderRadius: radius.sm,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.md,
    },
    journeyHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    journeyTrophy: {
      alignItems: 'center',
      borderColor: colors.accentDark,
      borderRadius: 26,
      borderWidth: 1,
      height: 52,
      justifyContent: 'center',
      width: 52,
    },
    journeyTrophyGlyph: { fontSize: fontSize.xl },
    journeyHeadingCopy: { flex: 1, minWidth: 0 },
    journeyEyebrow: {
      color: colors.accentLight,
      fontFamily: fonts.display,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      letterSpacing: 0.7,
    },
    journeyTitle: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    journeyMetrics: {
      alignItems: 'stretch',
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.md,
      paddingVertical: spacing.md,
    },
    journeyMetricsCompact: { flexWrap: 'wrap', rowGap: spacing.md },
    journeyDivider: { backgroundColor: colors.borderStrong, width: 1 },
    journeyProgressRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    journeyProgressCopy: { flex: 1, minWidth: 0 },
    journeyProgressLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
    },
    journeyProgressValue: {
      color: colors.accentLight,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    journeyProgressPct: {
      color: colors.accent,
      fontFamily: fonts.display,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
    },
    journeyOpenLabel: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      marginTop: spacing.md,
      textAlign: 'right',
    },
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
      color: colors.accentLight,
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
    ticketPrimaryAction: {
      marginTop: spacing.md,
    },
    ticketSecondaryAction: {
      marginTop: spacing.sm,
    },
    ticketBenchReason: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.sm,
    },
    countryMoveCard: {
      marginBottom: spacing.md,
      borderLeftColor: colors.info,
      borderLeftWidth: 3,
    },
    countryOffer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    countryOfferSelected: { borderColor: colors.accent },
    countryOfferCopy: { flex: 1, minWidth: 0 },
    countryOfferClub: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    countryOfferMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    countryOfferBonus: { color: colors.success, fontSize: fontSize.xs, marginTop: 2 },
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
      width: 48,
      height: 48,
      alignItems: 'center',
      flexShrink: 0,
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
      backgroundColor: `${CRICKET_HOME.leather}22`,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: CRICKET_HOME.leather,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.md,
    },
    inboxBannerText: {
      color: colors.accentLight,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    inboxBannerArrow: { color: colors.accentLight, fontSize: fontSize.md },
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
    scopeGroupLabel: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      textTransform: 'uppercase',
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
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
