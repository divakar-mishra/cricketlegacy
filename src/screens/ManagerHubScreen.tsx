import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { playHaptic } from '../audio';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import type { IconName } from '../components';
import {
  AchievementToast,
  Button,
  Card,
  CareerSpotlight,
  CupCard,
  GlassSurface,
  HubTabBar,
  Icon,
  LeagueTable,
  LiveOpsCards,
  MechanicInfoButton,
  ModeGuideModal,
  RewardModal,
  RewardModalData,
  Screen,
  ScreenHeader,
} from '../components';
import { AppText as Text } from '../components/AppText';
import { getAchievement } from '../game/achievements';
import { managerIdentityLine, squadMorale } from '../game/careerExperience';
import { ManagerStepType, resolveNextCareerStep } from '../game/careerStep';
import { formatClubCurrency, seasonWageBill, sponsorIncome } from '../game/finance';
import { calculateClubRating } from '../game/manager';
import {
  MANAGER_PHASE_LABEL,
  MANAGER_PHASE_MONTHS,
  MANAGER_PHASE_ORDER,
  managerControlledTeamId,
  managerPhaseProgress,
  managerPhaseUnlocked,
  managerSquadReadiness,
} from '../game/managerCalendar';
import {
  allowedCompetitionIds,
  checkManagerLevelPromotion,
  MANAGER_LEVEL_DESC,
  MANAGER_LEVEL_LABEL,
  upcomingIccEvents,
} from '../game/managerCareer';
import {
  MANAGER_EMERGENCY_TEAM_TALK_COINS,
  MANAGER_MATCH_ANALYSIS_COINS,
  managerResourceUsed,
} from '../game/managerResources';
import { nextUserFixtureId, nextUserFixturesByCompetition, standings } from '../game/season';
import { isDeadlineDay } from '../game/transferMarket';
import { useIsCompact } from '../hooks/useResponsive';
import { useT } from '../i18n';
import { ScreenProps } from '../navigation';
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

const ROLE_ABBR: Record<string, string> = {
  BATTER: 'BAT',
  BOWLER: 'BOWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtMoney = formatClubCurrency;

const MANAGER_GUIDE_STEPS = [
  {
    icon: 'home' as const,
    title: 'Use Continue as your inbox',
    body: 'The main action moves through press duties, match preparation, fixtures, playoffs and season rollover without hiding the next requirement.',
    action: 'Clear the highlighted Continue action before starting side projects.',
  },
  {
    icon: 'calendar' as const,
    title: 'Follow the domestic year',
    body: 'September starts the 50-over block, December begins four-day cricket, March starts T20, and June opens contracts and transfers. Locked blocks still run for every club in the background.',
    action:
      'Rookie managers play T20; promotion adds 50-over, then four-day, then the national off-season tour.',
  },
  {
    icon: 'people' as const,
    title: 'Prepare the XI',
    body: 'Squad controls selection and batting order. Fitness, form, morale, roles and injuries all affect whether the XI is ready.',
    action: 'Review the XI before every match and replace unavailable or exhausted players.',
  },
  {
    icon: 'analytics' as const,
    title: 'Build a match plan',
    body: 'Opposition analysis, morale preparation and tactics have explicit effects. Live tactics pause the match while you change approach, bowling plan or legal field.',
    action: 'Choose one preparation edge, then adapt in-match when score pressure changes.',
  },
  {
    icon: 'swap-horizontal' as const,
    title: 'Recruit with evidence',
    body: 'Scout reports reduce uncertainty before a transfer. Fees, wages, squad limits and the transfer window remain separate constraints.',
    action:
      'Scout a target, check the full budget impact, then sign only when the role improves your XI.',
  },
  {
    icon: 'business' as const,
    title: 'Run the club',
    body: 'Club Office handles staff, facilities, wages and club budget. Academy develops youth; Records tracks real results, finishes, trophies and legends produced.',
    action:
      'Balance short-term match preparation against long-term staff, facility and youth investment.',
  },
] as const;

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

function stageDesc(desc: string): string {
  return desc;
}

export function ManagerHubScreen({ navigation }: ScreenProps<'ManagerHub'>) {
  const save = useCareer((s) => s.save);
  const refreshEnergy = useCareer((s) => s.refreshEnergy);
  const advanceSeason = useCareer((s) => s.advanceSeason);
  const advanceManagerCalendar = useCareer((s) => s.advanceManagerCalendar);
  const newSeason = useCareer((s) => s.newSeason);
  const claimDaily = useCareer((s) => s.claimDaily);
  const takeNewJob = useCareer((s) => s.takeNewJob);
  const playCupTie = useCareer((s) => s.playCupTie);
  const purchaseProduct = useCareer((s) => s.purchaseProduct);
  const applySquadRecovery = useCareer((s) => s.applySquadRecovery);
  const setTargetFixture = useCareer((s) => s.setTargetFixture);
  const runManagerResource = useCareer((s) => s.useManagerResource);
  const acceptManagerJobOffer = useCareer((s) => s.acceptManagerJobOffer);
  const declineManagerJobOffer = useCareer((s) => s.declineManagerJobOffer);
  const acknowledgeManagerAppointment = useCareer((s) => s.acknowledgeManagerAppointment);
  const persist = useCareer((s) => s.persist);
  const pendingAchievementIds = useCareer((s) => s.pendingAchievementIds);
  const clearPendingAchievements = useCareer((s) => s.clearPendingAchievements);
  const t = useT();
  const { gradients, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const compact = useIsCompact();
  const [canClaimDaily, setCanClaimDaily] = useState(false);
  const [rewardModal, setRewardModal] = useState<RewardModalData | null>(null);
  const [xiExpanded, setXiExpanded] = useState(false);
  const [talkFlash, setTalkFlash] = useState<string | null>(null);
  const [calendarSimulation, setCalendarSimulation] = useState<{
    played: number;
    total: number;
  } | null>(null);
  const [dealBusy, setDealBusy] = useState<string | null>(null);
  const [toastIdx, setToastIdx] = useState(0);
  const prevPendingLenRef = useRef(-1);
  const appointmentShownRef = useRef<string | null>(null);
  const dismissedTips = useSettings((s) => s.dismissedTips);
  const dismissTip = useSettings((s) => s.dismissTip);
  const showManagerGuide = !dismissedTips.includes('manager_hub_guide');

  const buyManagerDeal = useCallback(
    async (productId: 'transfer_budget_sm' | 'recovery_pack', successText: string) => {
      setDealBusy(productId);
      const res = await purchaseProduct(productId);
      setDealBusy(null);
      Alert.alert(
        res.ok ? 'Applied' : 'Purchase failed',
        res.ok ? successText : (res.error ?? 'Please try again.'),
      );
    },
    [purchaseProduct],
  );

  const confirmTokenRecovery = useCallback(() => {
    if (!save?.userTeamId) return;
    const recoveryTeamId = managerControlledTeamId(save) ?? save.userTeamId;
    const squad = (save.teams[recoveryTeamId]?.playerIds ?? [])
      .map((id) => save.players[id])
      .filter(Boolean);
    const avg = (values: number[]) =>
      values.length ? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length) : 0;
    const before = avg(squad.map((p) => p.condition ?? p.meta.fitness ?? 70));
    const affected = squad.filter((p) => !p.injury);
    const after = avg(
      squad.map((p) =>
        p.injury
          ? (p.condition ?? p.meta.fitness ?? 70)
          : Math.min(95, (p.condition ?? p.meta.fitness ?? 70) + 20),
      ),
    );
    const injured = squad.length - affected.length;
    Alert.alert(
      'Apply Squad Recovery?',
      [
        'Cost: 1 Recovery Token',
        `Average condition: ${before}% -> ${after}%`,
        'Underlying fitness: +20 (up to 100)',
        `Affected players: ${affected.length}`,
        `Injured not healed: ${injured}`,
        'Cooldown: 3 completed fixtures or 7 career days',
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            const res = applySquadRecovery('token');
            Alert.alert(
              res.ok ? 'Recovery applied' : 'Cannot recover squad',
              res.ok
                ? `Squad recovery applied to ${res.preview?.affectedPlayers ?? affected.length} players.`
                : (res.reason ?? 'Please try again later.'),
            );
          },
        },
      ],
    );
  }, [applySquadRecovery, save]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Leave manager career?',
          'Leaving now returns to the main menu. Your save is kept, but the current dashboard flow will be interrupted.',
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
    const appointment = save?.managerAppointmentPending;
    if (!appointment) return;
    const appointmentKey = `${appointment.teamId}:${appointment.appointedAt}`;
    if (appointmentShownRef.current === appointmentKey) return;
    appointmentShownRef.current = appointmentKey;
    const appointedTeam = save.teams[appointment.teamId];
    Alert.alert(
      `NEW APPOINTMENT: ${appointment.clubName}`,
      [
        `Back page: ${appointment.clubName} appoint their new manager.`,
        `Board confidence: ${Math.round(save.boardConfidence ?? 75)}`,
        `Grace period: ${save.managerGraceMatchesRemaining ?? 5} matches`,
        `Senior squad: ${appointedTeam?.playerIds.length ?? 0} players`,
        'Club-specific XI, training and scouting caches have been reset.',
      ].join('\n'),
      [{ text: 'Enter the office', onPress: acknowledgeManagerAppointment }],
      { cancelable: false },
    );
  }, [acknowledgeManagerAppointment, save]);

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
      refreshEnergy();
      const today = Math.floor(Date.now() / 86_400_000);
      setCanClaimDaily(useCareer.getState().save?.lastDailyClaim !== today);
    }, [refreshEnergy]),
  );

  const goMenu = () => navigation.navigate('MainMenu');

  if (!save || !save.userTeamId || !save.teams[save.userTeamId]) {
    return (
      <Screen>
        <ScreenHeader title="Manager" onBack={goMenu} />
        <Text style={styles.msg}>No active manager save. Start one from the menu.</Text>
        <Button label="Back to Menu" variant="secondary" onPress={goMenu} />
      </Screen>
    );
  }

  const team = save.teams[save.userTeamId];
  const activeManagedTeamId = managerControlledTeamId(save) ?? save.userTeamId;
  const activeManagedTeam = save.teams[activeManagedTeamId] ?? team;
  const isNationalManager = save.managerCareerLevel === 'NATIONAL';
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const table = standings(save);
  const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean);
  const hasKeeper = squad.some((p) => p.role === 'WK_BATTER');
  const wages = seasonWageBill(squad);
  const sponsor = sponsorIncome(team.reputation);
  const sacked = Boolean(save.flags?.sacked);
  const otherClubs = Object.values(save.teams)
    .filter((t) => {
      if (t.id === save.userTeamId) return false;
      if (!save.managerCalendar) return true;
      const allowed =
        save.userDivision === 1
          ? save.divisions?.tier1
          : save.userDivision === 2
            ? save.divisions?.tier2
            : save.divisions?.tier3;
      return Boolean(allowed?.includes(t.id));
    })
    .sort((a, b) => a.reputation - b.reputation)
    .slice(0, 6);

  const fixtureId = nextUserFixtureId(save);
  const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
  const fixtureControlledTeamId = fixture?.managerPhase
    ? managerControlledTeamId(save, fixture.managerPhase)
    : save.userTeamId;
  const analysisUsed = managerResourceUsed(save, 'MATCH_ANALYSIS');
  const emergencyTalkUsed = managerResourceUsed(save, 'EMERGENCY_TEAM_TALK');
  const opponentId = fixture
    ? fixture.homeTeamId === fixtureControlledTeamId
      ? fixture.awayTeamId
      : fixture.homeTeamId
    : undefined;
  // Multi-format competitions unlocked at State/National level (empty for Club).
  const competitionOptions = nextUserFixturesByCompetition(save);
  const otherCompetitionOptions = competitionOptions.filter(
    (option) => option.competitionId !== 't20-league',
  );
  const managerIdentity = managerIdentityLine(save);
  const lastImpact = save.experience?.lastMatchImpact;
  const clubRating = calculateClubRating(save);
  const hasLegendBacking = (save.inventory?.manager_legend_backing ?? 0) > 0;
  const calendarProgress = save.managerCalendar ? managerPhaseProgress(save) : null;
  const squadReadiness = save.managerCalendar ? managerSquadReadiness(save) : null;
  const nextStep = resolveNextCareerStep(save);

  const onSaveExit = async () => {
    useCareer.getState().scheduleReminders();
    await persist();
    goMenu();
  };

  const startMatch = async () => {
    try {
      playHaptic('impact-medium');
    } catch {
      /* ok */
    }
    navigation.navigate('Match');
  };

  const requestMatchStart = () => {
    void startMatch();
  };

  const prepareOppositionAnalysis = () => {
    const result = runManagerResource('MATCH_ANALYSIS');
    setTalkFlash(result.detail ?? result.reason ?? 'Opposition analysis is unavailable.');
  };

  const deliverEmergencyTeamTalk = () => {
    const result = runManagerResource('EMERGENCY_TEAM_TALK');
    setTalkFlash(result.detail ?? result.reason ?? 'Emergency team talk is unavailable.');
  };

  const startNextSeason = () => {
    const completedYear = season?.year;
    newSeason();
    const updated = useCareer.getState().save;
    const settlement = updated?.lastSeasonSettlement;
    if (!settlement || settlement.year !== completedYear) return;
    const net = settlement.newBudget - settlement.previousBudget;
    setRewardModal({
      kicker: 'SEASON SETTLED',
      title: `Season ${settlement.year} finances`,
      subtitle: `${ordinal(settlement.leaguePosition)} place league finish`,
      icon: 'trophy',
      items: [
        `League prize: +${fmtMoney(settlement.leaguePrize)}`,
        ...(settlement.continentalPrize
          ? [`Continental prize: +${fmtMoney(settlement.continentalPrize)}`]
          : []),
        `Sponsor and broadcast income: +${fmtMoney(settlement.sponsorIncome)}`,
        `Player wages: -${fmtMoney(settlement.playerWages)}`,
        `Gate receipts: +${fmtMoney(settlement.gateReceipts)}`,
        `Staff wages: -${fmtMoney(settlement.staffWages)}`,
        `Facility upkeep: -${fmtMoney(settlement.facilityUpkeep)}`,
      ],
      balances: [
        `Club budget: ${fmtMoney(settlement.previousBudget)} -> ${fmtMoney(settlement.newBudget)}`,
        `Net change: ${net >= 0 ? '+' : ''}${fmtMoney(net)}`,
        'Wallet coins and gems are separate from this club budget.',
      ],
    });
  };

  const advanceCalendarBlock = () => {
    if (calendarSimulation) return;
    setCalendarSimulation({
      played: calendarProgress?.played ?? 0,
      total: calendarProgress?.total ?? 1,
    });
    const step = () => {
      const result = advanceManagerCalendar(12);
      if (result?.kind === 'IN_PROGRESS') {
        setCalendarSimulation({ played: result.played ?? 0, total: result.total ?? 1 });
        setTimeout(step, 40);
        return;
      }
      setCalendarSimulation(null);
      if (!result?.summary) return;
      const championId = result.summary.championTeamIds[save.userDivision ?? 3];
      const backgroundBlock =
        !isNationalManager &&
        !managerPhaseUnlocked(save.managerCareerLevel ?? 'CLUB', result.summary.phase);
      const formatLabel =
        result.summary.phase === 'LIST_A'
          ? '50-over List A'
          : result.summary.phase === 'FIRST_CLASS'
            ? 'four-day First-Class'
            : '20-over T20';
      setRewardModal({
        kicker: backgroundBlock ? 'AI-MANAGED BLOCK COMPLETE' : 'COMPETITION COMPLETE',
        title: backgroundBlock
          ? `${MANAGER_PHASE_LABEL[result.summary.phase]} background simulation`
          : `${MANAGER_PHASE_LABEL[result.summary.phase]} complete`,
        subtitle: championId
          ? `${save.teams[championId]?.name ?? 'Champions'} won your division`
          : isNationalManager
            ? 'The national programme and domestic world have advanced'
            : 'The domestic world has advanced',
        icon: 'calendar',
        items: [
          `Competition: ${formatLabel}`,
          ...(backgroundBlock
            ? [
                `${MANAGER_LEVEL_LABEL[save.managerCareerLevel ?? 'CLUB']} does not yet unlock manual control, so club staff selected and managed the XI.`,
              ]
            : []),
          `Club record: ${result.summary.userWins} wins from ${result.summary.userMatches} matches`,
          ...(result.summary.userPosition
            ? [`Division finish: ${ordinal(result.summary.userPosition)}`]
            : []),
          ...(result.summary.overRatePenalties
            ? [`Over-rate penalties: ${result.summary.overRatePenalties} point(s)`]
            : []),
          result.summary.phase === 'T20'
            ? `Effect: updates the T20 table and club records.`
            : `Effect: updates this competition's table and club records; it does not alter the separate T20 table.`,
        ],
        balances: result.summary.walletCoins
          ? [
              backgroundBlock
                ? `Passive oversight stipend (30% match rate): +${result.summary.walletCoins.toLocaleString()} coins`
                : `Match rewards: +${result.summary.walletCoins.toLocaleString()} coins`,
              ...(result.summary.salaryCoins
                ? [`Manager salary: +${result.summary.salaryCoins.toLocaleString()} coins`]
                : []),
            ]
          : result.summary.salaryCoins
            ? [`Manager salary: +${result.summary.salaryCoins.toLocaleString()} coins`]
            : [],
      });
    };
    setTimeout(step, 80);
  };

  const runNextStep = () => {
    switch (nextStep.action) {
      case 'OPEN_JOB_OFFER': {
        const offer = save.managerJobOffer;
        if (!offer) return;
        Alert.alert(
          `Approach from ${offer.clubName}`,
          `${offer.reason}\n\nReputation ${offer.reputation}\n${fmtMoney(offer.salaryPromise)}/season`,
          [
            { text: 'Stay loyal', style: 'cancel', onPress: declineManagerJobOffer },
            {
              text: 'Take the job',
              onPress: () => {
                const result = acceptManagerJobOffer();
                if (!result.ok) Alert.alert('Move unavailable', result.reason);
              },
            },
          ],
        );
        break;
      }
      case 'OPEN_PRESS':
        navigation.navigate('Press');
        break;
      case 'PLAY_MATCH':
        requestMatchStart();
        break;
      case 'ADVANCE_MANAGER_CALENDAR':
        advanceCalendarBlock();
        break;
      case 'ADVANCE_SEASON':
        if (nextStep.mode === 'manager' && nextStep.type === ManagerStepType.OFFSEASON) {
          startNextSeason();
        } else {
          advanceSeason();
        }
        break;
      case 'OPEN_JOB_SEARCH':
        setTalkFlash('Choose one of the available club appointments below.');
        break;
      default:
        break;
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
                label: t('hub.tabHome'),
                active: true,
                onPress: () => {},
              },
              {
                key: 'club',
                icon: 'briefcase',
                label: 'Club',
                onPress: () => navigation.navigate('ClubOffice'),
              },
              {
                key: 'store',
                icon: 'cart',
                label: t('hub.tabStore'),
                onPress: () => navigation.navigate('Purchase'),
              },
              {
                key: 'academy',
                icon: 'school',
                label: 'Academy',
                onPress: () => navigation.navigate('Academy'),
              },
              {
                key: 'records',
                icon: 'trophy',
                label: t('hub.tabRecords'),
                onPress: () => navigation.navigate('Records'),
              },
            ]}
          />
        }
      >
        <ScreenHeader
          title={activeManagedTeam.name}
          subtitle={`${isNationalManager ? 'National Head Coach' : 'Manager'} · Season ${season?.year ?? ''}`}
          onBack={goMenu}
        />

        <CareerSpotlight
          mode="manager"
          title={managerIdentity}
          meta={
            isNationalManager
              ? `${activeManagedTeam.name} | Year-round national duty | Reputation ${Math.round(save.managerProgression?.reputation ?? 75)}${hasLegendBacking ? ' | Legend backing' : ''}`
              : `${team.name} | Club ${clubRating.toFixed(1)} | Board ${Math.round(save.boardConfidence ?? 65)} | Morale ${Math.round(squadMorale(save) ?? 60)}${hasLegendBacking ? ' | Legend backing' : ''}`
          }
          accentColor={activeManagedTeam.primaryColor}
          status={`SEASON ${season?.year ?? ''}`}
        />

        {lastImpact ? (
          <View style={styles.managerImpactBand}>
            <Text style={styles.managerImpactTitle}>Matchday Results · {lastImpact.headline}</Text>
            <Text style={styles.managerImpactText} numberOfLines={2}>
              {lastImpact.narrative}
            </Text>
            <Text style={styles.managerImpactText}>
              {lastImpact.why[0]}
              {lastImpact.leaguePosition
                ? ` · League ${ordinal(lastImpact.leaguePosition.before)} → ${ordinal(lastImpact.leaguePosition.after)}`
                : ''}
              {lastImpact.changes.find((change) => change.label === 'Coins')
                ? ` · Earnings +${Math.max(0, lastImpact.changes.find((change) => change.label === 'Coins')!.delta)} coins`
                : ' · Earnings 0 coins'}
            </Text>
            <View style={styles.managerImpactChanges}>
              {lastImpact.changes.slice(0, 3).map((change) => (
                <Text
                  key={change.label}
                  style={[
                    styles.managerImpactDelta,
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

        {/* ── FM-style "Continue" hero: the single most important next action ── */}
        {(() => {
          const monthLabel = MONTHS[(save.currentMonth ?? 1) - 1] ?? '';
          const eyebrow =
            nextStep.mode === 'manager' && nextStep.type === ManagerStepType.MATCHDAY
              ? `NEXT · MATCHDAY${monthLabel ? ` · ${monthLabel}` : ''}`
              : nextStep.mode === 'manager' && nextStep.type === ManagerStepType.PRESS_REQUIRED
                ? 'NEWS'
                : nextStep.mode === 'manager' &&
                    nextStep.type === ManagerStepType.JOB_OFFER_REQUIRED
                  ? 'URGENT JOB OFFER'
                  : nextStep.mode === 'manager' && nextStep.type === ManagerStepType.JOB_SEARCH
                    ? 'CAREER'
                    : isNationalManager
                      ? `${calendarProgress?.months ?? 'SEASON'} | NATIONAL DUTY`
                      : `${calendarProgress?.months ?? 'SEASON'} | Tier ${save.userDivision ?? 3}`;
          const label =
            nextStep.action === 'PLAY_MATCH'
              ? 'Continue to Matchday'
              : nextStep.action === 'OPEN_PRESS'
                ? 'Open Press Room'
                : nextStep.action === 'OPEN_JOB_OFFER'
                  ? 'Review offer'
                  : nextStep.action === 'OPEN_JOB_SEARCH'
                    ? 'View club appointments'
                    : nextStep.action === 'ADVANCE_MANAGER_CALENDAR'
                      ? calendarProgress?.unlocked
                        ? 'Advance calendar'
                        : 'Simulate competition'
                      : nextStep.mode === 'manager' && nextStep.type === ManagerStepType.OFFSEASON
                        ? `Begin ${season?.year ? season.year + 1 : 2027} season`
                        : 'Advance season';
          return (
            <View>
              <GlassSurface highlighted intensity={0.6} style={styles.continueHero}>
                <Text style={styles.continueEyebrow}>{eyebrow}</Text>
                <Text style={styles.continueTitle} numberOfLines={2}>
                  {nextStep.title}
                </Text>
                <Text style={styles.continueSub} numberOfLines={2}>
                  {nextStep.detail}
                </Text>
                <Button
                  label={label}
                  variant="gold"
                  style={{ marginTop: spacing.md }}
                  onPress={runNextStep}
                />
              </GlassSurface>
            </View>
          );
        })()}

        {calendarProgress ? (
          <>
            <Text style={styles.section}>Season Calendar</Text>
            <Card>
              <View style={styles.calendarHeader}>
                <View style={styles.calendarHeaderCopy}>
                  <View style={styles.calendarTitleRow}>
                    <Text style={styles.calendarTitle}>
                      {calendarProgress.label} | {calendarProgress.months}
                    </Text>
                    {calendarProgress.phase === 'FIRST_CLASS' ? (
                      <MechanicInfoButton topicId="first-class-stamina" size={32} />
                    ) : null}
                  </View>
                  <Text style={styles.talkHint}>
                    {isNationalManager
                      ? `${activeManagedTeam.shortName} | ${calendarProgress.userPlayed}/${calendarProgress.userTotal} national fixtures complete`
                      : `Tier ${save.userDivision ?? 3} | ${calendarProgress.userPlayed}/${calendarProgress.userTotal} club fixtures complete`}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.calendarAccess,
                    { color: calendarProgress.unlocked ? colors.success : colors.textMuted },
                  ]}
                >
                  {calendarProgress.unlocked ? 'ACTIVE' : 'AI SIM'}
                </Text>
              </View>
              {MANAGER_PHASE_ORDER.map((phase) => {
                const current = phase === calendarProgress.phase;
                const unlocked = managerPhaseUnlocked(save.managerCareerLevel ?? 'CLUB', phase);
                return (
                  <View
                    key={phase}
                    style={[styles.calendarRow, current && styles.calendarRowCurrent]}
                  >
                    <View
                      style={[
                        styles.calendarMarker,
                        {
                          backgroundColor: current
                            ? colors.accent
                            : unlocked
                              ? colors.success
                              : colors.border,
                        },
                      ]}
                    />
                    <View style={styles.calendarRowCopy}>
                      <Text style={styles.calendarRowTitle}>{MANAGER_PHASE_LABEL[phase]}</Text>
                      <Text style={styles.calendarRowMeta}>{MANAGER_PHASE_MONTHS[phase]}</Text>
                    </View>
                    <Text style={styles.calendarRowState}>
                      {phase === 'OFF_SEASON' ? 'OPEN' : unlocked ? 'PLAY' : 'SIM'}
                    </Text>
                  </View>
                );
              })}
              {squadReadiness ? (
                <Text
                  style={[
                    styles.calendarReadiness,
                    {
                      color:
                        squadReadiness.healthy < 15 || squadReadiness.tired > 5
                          ? colors.warning
                          : colors.textMuted,
                    },
                  ]}
                >
                  Squad: {squadReadiness.healthy}/{squadReadiness.total} healthy
                  {squadReadiness.tired ? ` | ${squadReadiness.tired} need rotation` : ''}
                </Text>
              ) : null}
            </Card>
          </>
        ) : null}

        {/* ── Quick navigation grid (replaces scattered action rows) ── */}
        {fixture && opponentId ? (
          <>
            <Text style={styles.section}>Match Preparation</Text>
            <Card>
              <Text style={styles.talkHint}>
                Review the XI, prepare one opposition report, or use one emergency morale lift.
                These services improve preparation but never guarantee a result.
              </Text>
              <View style={styles.actionRow}>
                <Button
                  label="Review XI"
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  style={styles.actionFlex}
                  onPress={() => navigation.navigate('Squad')}
                />
                <Button
                  label={
                    analysisUsed ? 'Analysis prepared' : `Analyse · ${MANAGER_MATCH_ANALYSIS_COINS}`
                  }
                  variant={analysisUsed ? 'ghost' : 'secondary'}
                  size="sm"
                  fullWidth={false}
                  style={styles.actionFlex}
                  disabled={analysisUsed || save.wallet.coins < MANAGER_MATCH_ANALYSIS_COINS}
                  onPress={prepareOppositionAnalysis}
                />
                <Button
                  label={
                    emergencyTalkUsed
                      ? 'Morale session used'
                      : `Morale session · ${MANAGER_EMERGENCY_TEAM_TALK_COINS.toLocaleString()}`
                  }
                  variant={emergencyTalkUsed ? 'ghost' : 'secondary'}
                  size="sm"
                  fullWidth={false}
                  style={styles.actionFlex}
                  disabled={
                    emergencyTalkUsed || save.wallet.coins < MANAGER_EMERGENCY_TEAM_TALK_COINS
                  }
                  onPress={deliverEmergencyTeamTalk}
                />
              </View>
              {talkFlash ? <Text style={styles.talkFlash}>{talkFlash}</Text> : null}
            </Card>
          </>
        ) : null}

        <View style={styles.navGrid}>
          {(
            [
              { key: 'squad', icon: 'people', label: 'Squad', to: 'Squad' },
              { key: 'transfers', icon: 'swap-horizontal', label: 'Transfers', to: 'Transfers' },
              ...(isDeadlineDay(save)
                ? [
                    {
                      key: 'deadline',
                      icon: 'time' as IconName,
                      label: 'Deadline',
                      to: 'TransferDeadlineDay' as const,
                    },
                  ]
                : []),
              { key: 'office', icon: 'briefcase', label: 'Club Office', to: 'ClubOffice' },
              { key: 'records', icon: 'trophy', label: 'Records', to: 'Records' },
            ] as {
              key: string;
              icon: IconName;
              label: string;
              to:
                | 'Squad'
                | 'Transfers'
                | 'TransferDeadlineDay'
                | 'ClubOffice'
                | 'Records';
            }[]
          ).map((tile) => (
            <Pressable
              key={tile.key}
              style={[styles.navTile, compact && styles.navTileCompact]}
              accessibilityRole="button"
              accessibilityLabel={tile.label}
              onPress={() => navigation.navigate(tile.to)}
            >
              <Icon name={tile.icon} size={22} color={colors.primaryLight} />
              <Text style={styles.navTileLabel} numberOfLines={1}>
                {tile.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Manager Career Level card */}
        {(() => {
          const mgrLevel = save.managerCareerLevel ?? 'CLUB';
          const mgrSeasons = save.managerCareerSeasons ?? 0;
          const mgrTitles = save.managerTitlesAtLevel ?? 0;
          const promo = checkManagerLevelPromotion(save);
          const currentYear = season?.year ?? 2026;
          const iccEvents =
            mgrLevel === 'NATIONAL' && !save.managerCalendar
              ? upcomingIccEvents(currentYear, 4)
              : [];
          const levelColors: Record<string, string> = {
            CLUB: colors.primary,
            STATE: colors.accent,
            ELITE: colors.info,
            NATIONAL: colors.success,
          };
          const levelColor = levelColors[mgrLevel] ?? colors.primary;

          return (
            <View>
              <View style={[styles.levelCard, { borderColor: levelColor }]}>
                <View style={styles.levelHeader}>
                  <Text style={[styles.levelTitle, { color: levelColor }]}>
                    {mgrLevel === 'CLUB'
                      ? 'L1'
                      : mgrLevel === 'STATE'
                        ? 'L2'
                        : mgrLevel === 'ELITE'
                          ? 'L3'
                          : 'L4'}{' '}
                    {MANAGER_LEVEL_LABEL[mgrLevel]}
                  </Text>
                  <Text style={styles.levelSeasonsText}>
                    Season {mgrSeasons + 1} · {mgrTitles} title{mgrTitles !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.levelDesc}>{MANAGER_LEVEL_DESC[mgrLevel]}</Text>

                {/* Multi-format access pills */}
                <View style={styles.formatPills}>
                  {['t20-league', 'list-a', 'first-class'].map((id) => {
                    const unlocked = allowedCompetitionIds(mgrLevel).has(id);
                    const label =
                      id === 't20-league' ? 'T20' : id === 'list-a' ? 'List A' : 'First Class';
                    return (
                      <View
                        key={id}
                        style={[
                          styles.formatPill,
                          {
                            backgroundColor: unlocked ? levelColor + '22' : colors.surfaceMuted,
                            borderColor: unlocked ? levelColor : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.formatPillText,
                            { color: unlocked ? levelColor : colors.textFaint },
                          ]}
                        >
                          {unlocked ? '✓' : '🔒'} {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Promotion hint */}
                {promo.promoted ? (
                  <Text style={[styles.promoReady, { color: colors.success }]}>
                    🎉 Promotion available — start a new season to advance!
                  </Text>
                ) : mgrLevel !== 'NATIONAL' ? (
                  <Text style={styles.levelNextHint}>
                    {mgrLevel === 'CLUB'
                      ? 'Finish in the Tier 3 top two to unlock Tier 2 and 50-over cricket.'
                      : mgrLevel === 'STATE'
                        ? 'Finish in the Tier 2 top two to unlock Tier 1 and the four-day season.'
                        : 'Win the Tier 1 Four-Day Shield to unlock the national team role.'}
                  </Text>
                ) : (
                  <Text style={[styles.levelNextHint, { color: colors.success }]}>
                    You are at the pinnacle of cricket management.
                  </Text>
                )}

                {/* ICC Calendar for NATIONAL managers */}
                {iccEvents.length > 0 && (
                  <View style={styles.iccSection}>
                    <Text style={styles.iccTitle}>📅 ICC Calendar</Text>
                    {iccEvents.slice(0, 4).map((ev) => (
                      <View key={ev.id} style={styles.iccRow}>
                        <Text style={styles.iccYear}>{ev.year}</Text>
                        <Text style={styles.iccName} numberOfLines={1}>
                          {ev.name}
                        </Text>
                        <View style={[styles.iccBadge, { backgroundColor: colors.info + '22' }]}>
                          <Text style={[styles.iccBadgeText, { color: colors.info }]}>
                            {ev.format}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })()}

        {/* Win streak badge */}
        {(save.winStreak ?? 0) >= 3 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakText}>{save.winStreak} match win streak!</Text>
          </View>
        )}

        {canClaimDaily ? (
          <Button
            label="🎁 Claim daily reward"
            variant="gold"
            style={{ marginTop: spacing.md }}
            onPress={() => {
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
            }}
          />
        ) : null}

        {sacked ? (
          <Card style={styles.sackedCard}>
            <Text style={styles.sackedTitle}>⚠ You&apos;ve been sacked</Text>
            <Text style={styles.sackedBody}>
              The board missed its expectations and has parted ways with you. Take charge of a new
              club to continue.
            </Text>
            {otherClubs.map((t) => (
              <Pressable
                key={t.id}
                style={styles.jobRow}
                onPress={() => takeNewJob(t.id)}
                accessibilityRole="button"
                accessibilityLabel={`Take charge of ${t.name}`}
              >
                <Text style={styles.jobName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.jobRep}>Rep {t.reputation}</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {/* Board Confidence Meter — 3-stage system */}
        {save.boardObjective
          ? (() => {
              const currentPos = table.findIndex((r) => r.teamId === save.userTeamId) + 1;
              const target = save.boardObjective.targetPosition;
              // Confidence score: 100 = safe, 0 = sack imminent
              const confidenceScore = Math.max(
                0,
                Math.min(100, Math.round(100 - ((currentPos - 1) / (table.length - 1)) * 100)),
              );

              const stage: 'safe' | 'concerned' | 'ultimatum' | 'danger' =
                confidenceScore >= 60
                  ? 'safe'
                  : confidenceScore >= 35
                    ? 'concerned'
                    : confidenceScore >= 15
                      ? 'ultimatum'
                      : 'danger';

              const stageConfig = {
                safe: {
                  color: colors.success,
                  icon: '✅',
                  label: 'ON TRACK',
                  desc: `Finish top ${target} to meet expectations.`,
                },
                concerned: {
                  color: colors.warning,
                  icon: '👀',
                  label: 'BOARD WATCHING',
                  desc: `${target - currentPos + 1} position${target - currentPos !== 0 ? 's' : ''} outside target — room to recover.`,
                },
                ultimatum: {
                  color: colors.danger,
                  icon: '⚠️',
                  label: 'BOARD ULTIMATUM',
                  desc: `Results MUST improve. Miss target and you\'re sacked.`,
                },
                danger: {
                  color: colors.dangerDark,
                  icon: '🚨',
                  label: 'SACKING IMMINENT',
                  desc: `Critical failure zone. Win immediately or face the consequences.`,
                },
              }[stage];

              return (
                <View>
                  <Card
                    style={[
                      styles.boardCard,
                      stage !== 'safe' && {
                        borderColor: stageConfig.color,
                        borderWidth: stage === 'danger' ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={styles.boardHeader}>
                      <View style={styles.boardTitleRow}>
                        <Text style={styles.boardHeaderTitle}>📋 Board Confidence</Text>
                        <MechanicInfoButton topicId="board-grace" size={32} />
                      </View>
                      <View
                        style={[
                          styles.stageBadge,
                          {
                            backgroundColor: stageConfig.color + '22',
                            borderColor: stageConfig.color,
                          },
                        ]}
                      >
                        <Text style={styles.stageIcon}>{stageConfig.icon}</Text>
                        <Text style={[styles.stageLabel, { color: stageConfig.color }]}>
                          {stageConfig.label}
                        </Text>
                      </View>
                    </View>

                    {/* Confidence bar */}
                    <View style={styles.boardMeterTrack}>
                      <View
                        style={[
                          styles.boardMeterFill,
                          { width: `${confidenceScore}%`, backgroundColor: stageConfig.color },
                        ]}
                      />
                      {/* Stage markers */}
                      {[35, 60].map((pct) => (
                        <View key={pct} style={[styles.stageMark, { left: `${pct}%` as any }]} />
                      ))}
                    </View>

                    <View style={styles.boardDetails}>
                      <Text style={styles.boardDetailText}>🎯 Target: Top {target}</Text>
                      <Text style={styles.boardDetailText}>📍 Now: {ordinal(currentPos)}</Text>
                      <Text style={styles.boardDetailText}>📊 {confidenceScore}% confidence</Text>
                    </View>

                    <Text style={[styles.stageDesc, { color: stageConfig.color }]}>
                      {stageDesc(stageConfig.desc)}
                    </Text>

                    {/* Ultimatum or danger: show sack warning */}
                    {(stage === 'ultimatum' || stage === 'danger') && (
                      <View style={[styles.ultimatumBox, { borderColor: stageConfig.color }]}>
                        <Text style={[styles.ultimatumText, { color: stageConfig.color }]}>
                          {stage === 'danger'
                            ? "🚨 You WILL be sacked if you fail to meet the board's target."
                            : '⚠️ The board has issued an ultimatum — this is your last chance.'}
                        </Text>
                      </View>
                    )}
                  </Card>
                </View>
              );
            })()
          : null}

        <Card style={styles.board}>
          <View style={styles.boardCol}>
            <Text style={styles.boardLabel}>Budget</Text>
            <Text style={styles.boardValue}>{fmtMoney(team.budget)}</Text>
            <Text style={styles.boardPos}>
              Sponsor {fmtMoney(sponsor)} · Wages {fmtMoney(wages)}/yr
            </Text>
            <Text style={styles.boardPos}>
              Wallet Coins pay for personal services like Opposition Analysis, while Club Budget
              manages transfers, facilities, and player contracts.
            </Text>
          </View>
          <View style={styles.budgetMetrics}>
            <View style={styles.budgetMetric}>
              <Text style={styles.budgetMetricLabel}>Sponsor</Text>
              <Text style={styles.budgetMetricValue}>{fmtMoney(sponsor)}</Text>
            </View>
            <View style={styles.budgetMetric}>
              <Text style={styles.budgetMetricLabel}>Wages</Text>
              <Text style={styles.budgetMetricValue}>{fmtMoney(wages)}</Text>
            </View>
            <View style={styles.budgetMetric}>
              <Text style={styles.budgetMetricLabel}>Squad</Text>
              <Text style={styles.budgetMetricValue}>{squad.length}/18</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              label="Wage Ledger"
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => navigation.navigate('WageBreakdown')}
            />
            {team.budget < 800_000 ? (
              <Button
                label={dealBusy === 'transfer_budget_sm' ? 'Applying...' : 'Emergency Funds'}
                variant="secondary"
                size="sm"
                fullWidth={false}
                disabled={dealBusy != null}
                onPress={() =>
                  void buyManagerDeal(
                    'transfer_budget_sm',
                    `+${fmtMoney(500_000)} added to your transfer budget.`,
                  )
                }
              />
            ) : null}
          </View>
        </Card>

        {/* Squad Recovery IAP — shown when multiple players have low match condition */}
        {(() => {
          const recoveryTeamId = managerControlledTeamId(save) ?? save.userTeamId;
          const lowCondition = (save.teams[recoveryTeamId]?.playerIds ?? []).filter(
            (id) => (save.players[id]?.condition ?? save.players[id]?.meta.fitness ?? 99) < 60,
          ).length;
          const recoveryTokens = save.inventory?.squad_recovery_token ?? 0;
          if (lowCondition < 3) return null;
          return (
            <View>
              <Pressable
                style={[styles.iapBanner, { borderColor: colors.info }]}
                disabled={dealBusy != null}
                onPress={() =>
                  recoveryTokens > 0
                    ? confirmTokenRecovery()
                    : void buyManagerDeal(
                        'recovery_pack',
                        'Squad Recovery token added. Use it to apply recovery when ready.',
                      )
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.iapBannerTitle, { color: colors.info }]}>
                    Physio Recovery Pack
                  </Text>
                  <Text style={styles.iapBannerDesc}>
                    {lowCondition} players have low match condition.{' '}
                    {recoveryTokens > 0
                      ? 'Use a token for condition, fitness and morale recovery.'
                      : 'Buy a token, then apply it after review.'}
                  </Text>
                </View>
                <Text style={{ color: colors.info, fontSize: 20 }}>›</Text>
              </Pressable>
            </View>
          );
        })()}

        {/* Manager Career Records */}
        <View>
          <Text style={styles.section}>📊 Your Management Record</Text>
          <Card>
            {(() => {
              const wins = save.careerWins ?? 0;
              const losses = save.careerLosses ?? 0;
              const ties = save.careerDraws ?? 0;
              const total = wins + losses + ties;
              const pct = total > 0 ? Math.round((wins / total) * 100) : 0;
              const trophies =
                (save.leagueTitles ?? 0) + (save.cupWins ?? 0) + (save.continentalTitles ?? 0);
              const currentPos = table.findIndex((r) => r.teamId === save.userTeamId) + 1;
              const unbeaten = save.winStreak ?? 0;
              return (
                <View>
                  <View style={styles.managerRecordGrid}>
                    <View style={styles.managerRecordItem}>
                      <Text style={[styles.managerRecordVal, { color: colors.success }]}>
                        {wins}
                      </Text>
                      <Text style={styles.managerRecordLabel}>Wins</Text>
                    </View>
                    <View style={styles.managerRecordItem}>
                      <Text style={[styles.managerRecordVal, { color: colors.danger }]}>
                        {losses}
                      </Text>
                      <Text style={styles.managerRecordLabel}>Losses</Text>
                    </View>
                    <View style={styles.managerRecordItem}>
                      <Text style={[styles.managerRecordVal, { color: colors.info }]}>{ties}</Text>
                      <Text style={styles.managerRecordLabel}>Ties</Text>
                    </View>
                    <View style={styles.managerRecordItem}>
                      <Text style={[styles.managerRecordVal, { color: colors.accent }]}>
                        {pct}%
                      </Text>
                      <Text style={styles.managerRecordLabel}>Win Rate</Text>
                    </View>
                    <View style={styles.managerRecordItem}>
                      <Text style={[styles.managerRecordVal, { color: colors.accent }]}>
                        {trophies}
                      </Text>
                      <Text style={styles.managerRecordLabel}>Trophies</Text>
                    </View>
                  </View>
                  {unbeaten >= 3 && (
                    <View style={styles.streakRow}>
                      <Text style={styles.streakIcon}>🔥</Text>
                      <Text style={styles.streakRecord}>
                        {unbeaten} match unbeaten run — keep it going!
                      </Text>
                    </View>
                  )}
                  {currentPos === 1 && (
                    <View style={[styles.streakRow, { borderColor: colors.accent }]}>
                      <Text style={styles.streakIcon}>👑</Text>
                      <Text style={[styles.streakRecord, { color: colors.accent }]}>
                        You&apos;re top of the table!
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </Card>
        </View>

        <Text style={styles.section}>Playing XI</Text>
        <Card>
          <View style={styles.xiHeader}>
            <Text style={styles.xiValid}>
              {squad.length} players {hasKeeper ? '· Keeper ✓' : '· No keeper ⚠'}
            </Text>
          </View>
          {(xiExpanded ? squad : squad.slice(0, 5)).map((p, i) => (
            <Pressable
              key={p.id}
              style={styles.playerRow}
              onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}
            >
              <Text style={styles.playerNo}>{i + 1}</Text>
              <Text style={styles.playerName} numberOfLines={1}>
                {p.name}
                {p.isUserPlayer ? ' ★' : ''}
              </Text>
              <Text style={styles.playerRole}>{ROLE_ABBR[p.role] ?? p.role}</Text>
              <Text style={styles.playerOvr}>{p.overall}</Text>
            </Pressable>
          ))}
          {squad.length > 5 ? (
            <Pressable
              onPress={() => setXiExpanded((v) => !v)}
              style={styles.xiToggle}
              accessibilityRole="button"
            >
              <Text style={styles.xiToggleText}>
                {xiExpanded ? 'Show less' : `Show all ${squad.length} players`}
              </Text>
            </Pressable>
          ) : null}
        </Card>

        {/* Multi-format competition picker — appears once promoted to State/National */}
        {!save.managerCalendar && otherCompetitionOptions.length > 0 && (
          <>
            <Text style={styles.section}>Multi-Format Schedule</Text>
            <Card>
              <Text style={styles.talkHint}>
                Promotion to State unlocks both List A and First-Class cricket for this same
                programme. National rank adds ICC responsibility. These buttons select the next
                fixture in an unlocked format; they do not change your team or bypass the manager
                career ladder. Each domestic format has seven matches, earns normal wallet coins and
                career records, and remains separate from the T20 league table.
              </Text>
              {otherCompetitionOptions.map((opt) => (
                <View key={opt.competitionId} style={{ marginTop: spacing.sm }}>
                  <Text style={styles.competitionProgress}>
                    {(() => {
                      const competition = season?.competitions?.find(
                        (item) => item.id === opt.competitionId,
                      );
                      const userFixtures = (competition?.fixtureIds ?? [])
                        .map((id) => save.fixtures[id])
                        .filter(
                          (item) =>
                            item &&
                            (item.homeTeamId === save.userTeamId ||
                              item.awayTeamId === save.userTeamId),
                        );
                      return `${userFixtures.filter((item) => item.played).length}/${userFixtures.length} played`;
                    })()}
                  </Text>
                  <Button
                    label={`▶  ${opt.name} (${opt.format})`}
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      setTargetFixture(opt.fixtureId);
                      navigation.navigate('Match');
                    }}
                  />
                </View>
              ))}
            </Card>
          </>
        )}

        {!save.managerCalendar ? (
          <CupCard
            save={save}
            canPlay
            onPlay={() => {
              if (playCupTie()) navigation.navigate('Match');
            }}
          />
        ) : null}

        <LiveOpsCards />

        <Text style={styles.section}>{t('hub.leagueTable')}</Text>
        <Card>
          <LeagueTable rows={table} teams={save.teams} highlightTeamId={save.userTeamId} />
        </Card>

        <Button
          label="Save &amp; Exit to Menu"
          variant="ghost"
          style={{ marginTop: spacing.xl }}
          onPress={onSaveExit}
        />
      </Screen>
      <Modal transparent visible={Boolean(calendarSimulation)} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.simulationPanel} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.simulationTitle}>Simulating cricket world</Text>
            <Text style={styles.simulationBody}>
              All 24 clubs are completing the current competition.
            </Text>
            <View style={styles.simulationTrack}>
              <View
                style={[
                  styles.simulationFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((calendarSimulation?.played ?? 0) /
                          Math.max(1, calendarSimulation?.total ?? 1)) *
                          100,
                      ),
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.simulationCount}>
              {calendarSimulation?.played ?? 0}/{calendarSimulation?.total ?? 0} fixtures
            </Text>
          </View>
        </View>
      </Modal>
      <AchievementToast achievement={currentToast} onDismiss={onDismissToast} />
      <ModeGuideModal
        visible={showManagerGuide}
        modeLabel="Manager Career"
        steps={MANAGER_GUIDE_STEPS}
        onComplete={() => dismissTip('manager_hub_guide')}
      />
      <RewardModal data={rewardModal} onClose={() => setRewardModal(null)} />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    managerScene: {
      height: 176,
      marginTop: spacing.sm,
      marginHorizontal: -spacing.md,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    managerSceneImage: { opacity: 0.86 },
    managerSceneShade: {
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderLeftWidth: 5,
      padding: spacing.lg,
    },
    managerSceneTitle: {
      color: colors.white,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    managerSceneMeta: { color: 'rgba(255,255,255,0.82)', fontSize: fontSize.xs, marginTop: 4 },
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    clubIdentityLabel: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0,
    },
    managerImpactBand: {
      backgroundColor: colors.surfaceAlt,
      borderLeftColor: colors.info,
      borderLeftWidth: 3,
      borderRadius: radius.sm,
      marginTop: spacing.md,
      padding: spacing.md,
    },
    managerImpactTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    managerImpactText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: 2,
    },
    managerImpactChanges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    managerImpactDelta: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

    // FM-style Continue hero
    continueHero: { marginTop: spacing.md, minWidth: 0 },
    continueEyebrow: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
      textTransform: 'uppercase',
    },
    continueTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      marginTop: 4,
      lineHeight: 27,
    },
    continueSub: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    calendarHeaderCopy: { flex: 1, minWidth: 0 },
    calendarTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    calendarTitle: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginBottom: 3,
    },
    calendarAccess: { fontSize: 10, fontWeight: fontWeight.black },
    calendarRow: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    calendarRowCurrent: { backgroundColor: colors.surfaceAlt },
    calendarMarker: { width: 7, height: 24, borderRadius: 3 },
    calendarRowCopy: { flex: 1, minWidth: 0 },
    calendarRowTitle: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    calendarRowMeta: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
    calendarRowState: { color: colors.textMuted, fontSize: 10, fontWeight: fontWeight.black },
    calendarReadiness: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.md,
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

    // Quick nav grid
    navGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    navTile: {
      width: '31.5%',
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    navTileLabel: { color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    // Compact phones: 2 columns instead of 3 so labels don't clip.
    navTileCompact: { width: '47%' },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    xiHeader: { marginBottom: spacing.sm },
    xiToggle: { paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
    xiToggleText: {
      color: colors.primaryLight,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    xiValid: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    playerNo: { color: colors.textFaint, fontSize: fontSize.sm, width: 20 },
    playerName: {
      color: colors.text,
      fontSize: fontSize.sm,
      flex: 1,
      fontWeight: fontWeight.medium,
    },
    playerRole: { color: colors.textMuted, fontSize: fontSize.xs, width: 42, textAlign: 'right' },
    playerOvr: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      width: 28,
      textAlign: 'right',
    },
    vsLabel: { color: colors.textMuted, fontSize: fontSize.sm },
    vsTeams: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    vsOpp: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    champion: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      marginTop: spacing.xs,
    },
    sackedCard: { marginTop: spacing.md, borderColor: colors.danger, borderWidth: 1.5 },
    sackedTitle: { color: colors.danger, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    sackedBody: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      lineHeight: 18,
    },
    jobRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    jobName: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      flex: 1,
    },
    jobRep: { color: colors.textMuted, fontSize: fontSize.xs },
    // Board confidence meter
    boardCard: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
    boardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    boardHeaderTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    boardTitleRow: {
      flexGrow: 1,
      minWidth: 180,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    boardConfidencePct: { fontSize: fontSize.xs, fontWeight: fontWeight.black, letterSpacing: 0.5 },
    stageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    stageIcon: { fontSize: 12 },
    stageLabel: { fontSize: 10, fontWeight: fontWeight.black, letterSpacing: 0.5 },
    stageDesc: { fontSize: fontSize.xs, marginTop: spacing.xs, lineHeight: 16 },
    boardMeterTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
      marginBottom: spacing.sm,
      position: 'relative',
    },
    boardMeterFill: { height: 10, borderRadius: 5 },
    stageMark: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    boardDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
    boardDetailText: { color: colors.textMuted, fontSize: fontSize.xs },
    ultimatumBox: {
      borderWidth: 1.5,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginTop: spacing.md,
      backgroundColor: 'rgba(229,72,77,0.08)',
    },
    ultimatumText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, lineHeight: 16 },

    board: { marginTop: spacing.md, gap: spacing.sm },
    boardCol: { flex: 1 },
    boardLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    boardValue: {
      color: colors.accent,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    boardPos: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    budgetMetrics: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    budgetMetric: {
      flex: 1,
      minHeight: 58,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      justifyContent: 'center',
    },
    budgetMetricLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    budgetMetricValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      marginTop: 3,
    },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    actionFlex: { width: '48%' },
    talkHint: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.sm },
    competitionProgress: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginBottom: 4,
    },
    talkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    talkChip: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    talkChipText: { color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    talkFlash: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.68)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    simulationPanel: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      padding: spacing.xl,
    },
    simulationTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: spacing.md,
    },
    simulationBody: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    simulationTrack: {
      width: '100%',
      height: 8,
      overflow: 'hidden',
      borderRadius: 4,
      backgroundColor: colors.surfaceMuted,
      marginTop: spacing.lg,
    },
    simulationFill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    simulationCount: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: 'rgba(233,178,59,0.12)',
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
    },
    streakFire: { fontSize: 16 },
    streakText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

    // Manager career records card
    managerRecordGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.sm,
    },
    managerRecordItem: { alignItems: 'center' },
    managerRecordVal: { fontSize: fontSize.xxl, fontWeight: fontWeight.black },
    managerRecordLabel: {
      color: colors.textFaint,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    streakIcon: { fontSize: 18 },
    streakRecord: {
      color: colors.warning,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      flex: 1,
    },

    // Manager career level card
    levelCard: {
      borderWidth: 1.5,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginTop: spacing.md,
      backgroundColor: colors.surfaceAlt,
    },
    levelHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
    },
    levelTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    levelSeasonsText: { color: colors.textFaint, fontSize: fontSize.xs },
    levelDesc: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginBottom: spacing.md,
    },
    formatPills: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
    formatPill: {
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    formatPillText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    promoReady: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: spacing.xs },
    levelNextHint: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
      fontStyle: 'italic',
      lineHeight: 15,
    },

    // Headhunt offer card
    headhuntCard: { marginTop: spacing.md, borderWidth: 1.5 },
    headhuntTitle: { color: colors.accent, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    headhuntReason: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
      lineHeight: 18,
    },
    headhuntMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    headhuntMeta: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    headhuntActions: { flexDirection: 'row', gap: spacing.sm },
    headhuntHint: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
      fontStyle: 'italic',
    },

    // IAP banner (inline contextual offer)
    iapBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
      backgroundColor: colors.surfaceAlt,
      gap: spacing.sm,
    },
    iapBannerTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.heavy, marginBottom: 2 },
    iapBannerDesc: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 15 },

    // ICC Calendar section
    iccSection: {
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    iccTitle: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    iccRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
    iccYear: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      width: 36,
    },
    iccName: { flex: 1, color: colors.text, fontSize: fontSize.sm },
    iccBadge: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 2 },
    iccBadgeText: { fontSize: 10, fontWeight: fontWeight.bold },
  });
