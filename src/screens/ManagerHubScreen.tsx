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
  CupCard,
  HubTabBar,
  Icon,
  MechanicInfoButton,
  ModeGuideModal,
  RewardModal,
  RewardModalData,
  Screen,
  ScreenHeader,
  SeasonPassHomeCard,
  SponsorBrandRow,
} from '../components';
import { AppText as Text } from '../components/AppText';
import { ManagerAppointmentPaper } from '../components/ManagerAppointmentPaper';
import { getAchievement } from '../game/achievements';
import { ManagerStepType, resolveNextCareerStep } from '../game/careerStep';
import { activeCompetitionTable } from '../game/competitionTable';
import { formatClubCurrency } from '../game/finance';
import { leadershipReviewFlag } from '../game/leadership';
import {
  MANAGER_PHASE_LABEL,
  managerControlledTeamId,
  managerPhaseProgress,
  managerPhaseUnlocked,
} from '../game/managerCalendar';
import { MANAGER_LEVEL_LABEL } from '../game/managerCareer';
import { nextUserFixturesByCompetition } from '../game/season';
import { activeSponsorBranding } from '../game/sponsorship';
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtMoney = formatClubCurrency;

/** Screen-local cricket materials. Shared theme tokens stay untouched. */
const MANAGER_HOME_MATERIALS = {
  leather: '#9B3328',
  leatherDark: '#6F211A',
  paper: '#F2E5C6',
  paperEdge: '#C7A96B',
  paperInk: '#281C10',
  paperMuted: '#6D583B',
  pitchSuccess: '#54B63F',
} as const;

const MANAGER_GUIDE_STEPS = [
  {
    icon: 'home' as const,
    title: 'Use Continue',
    body: 'Your next step.',
  },
  {
    icon: 'calendar' as const,
    title: 'Follow the domestic year',
    body: 'Competition blocks.',
  },
  {
    icon: 'people' as const,
    title: 'Prepare the XI',
    body: 'Set your XI and batting order.',
  },
  {
    icon: 'analytics' as const,
    title: 'Build a match plan',
    body: 'Set and adapt tactics.',
  },
  {
    icon: 'swap-horizontal' as const,
    title: 'Recruit with evidence',
    body: 'Scout before signing.',
  },
  {
    icon: 'business' as const,
    title: 'Run the club',
    body: 'Facilities, staff and academy.',
  },
] as const;

const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

export function ManagerHubScreen({ navigation }: ScreenProps<'ManagerHub'>) {
  const save = useCareer((s) => s.save);
  const refreshEnergy = useCareer((s) => s.refreshEnergy);
  const advanceSeason = useCareer((s) => s.advanceSeason);
  const advanceManagerCalendar = useCareer((s) => s.advanceManagerCalendar);
  const newSeason = useCareer((s) => s.newSeason);
  const takeNewJob = useCareer((s) => s.takeNewJob);
  const playCupTie = useCareer((s) => s.playCupTie);
  const setTargetFixture = useCareer((s) => s.setTargetFixture);
  const acceptManagerJobOffer = useCareer((s) => s.acceptManagerJobOffer);
  const declineManagerJobOffer = useCareer((s) => s.declineManagerJobOffer);
  const acknowledgeManagerAppointment = useCareer((s) => s.acknowledgeManagerAppointment);
  const persistCritical = useCareer((s) => s.persistCritical);
  const pendingAchievementIds = useCareer((s) => s.pendingAchievementIds);
  const clearPendingAchievements = useCareer((s) => s.clearPendingAchievements);
  const t = useT();
  const { gradients, colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const compact = useIsCompact();
  const [rewardModal, setRewardModal] = useState<RewardModalData | null>(null);
  const [calendarSimulation, setCalendarSimulation] = useState<{
    played: number;
    total: number;
  } | null>(null);
  const [toastIdx, setToastIdx] = useState(0);
  const prevPendingLenRef = useRef(-1);
  const dismissedTips = useSettings((s) => s.dismissedTips);
  const dismissTip = useSettings((s) => s.dismissTip);
  const showManagerGuide = !dismissedTips.includes('manager_hub_guide');

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert('Leave manager career?', 'Return to the main menu? Your save is kept.', [
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
      refreshEnergy();
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

  if (save.managerRetired) {
    const played = (save.careerWins ?? 0) + (save.careerLosses ?? 0) + (save.careerDraws ?? 0);
    return (
      <Screen scroll gradient={gradients.pitch}>
        <ScreenHeader title="Manager Career" subtitle="Retired · Age 60" onBack={goMenu} />
        <Card>
          <Text style={styles.managerClubName}>Twenty-five seasons in the dugout</Text>
          <Text style={styles.msg}>
            {played.toLocaleString()} matches · {(save.careerWins ?? 0).toLocaleString()} wins ·{' '}
            {(
              (save.leagueTitles ?? 0) +
              (save.cupWins ?? 0) +
              (save.continentalTitles ?? 0)
            ).toLocaleString()}{' '}
            trophies
          </Text>
          <Button label="Open career records" onPress={() => navigation.navigate('Records')} />
          <Button label="Back to Menu" variant="secondary" onPress={goMenu} />
        </Card>
      </Screen>
    );
  }

  const team = save.teams[save.userTeamId];
  const activeManagedTeamId = managerControlledTeamId(save) ?? save.userTeamId;
  const activeManagedTeam = save.teams[activeManagedTeamId] ?? team;
  const isNationalManager = save.managerCareerLevel === 'NATIONAL';
  const managerSponsorBranding = isNationalManager
    ? { earned: undefined, premium: undefined }
    : activeSponsorBranding(save);
  const leadershipNeedsReview =
    !isNationalManager && Boolean(save.flags?.[leadershipReviewFlag(save.userTeamId)]);
  const season = save.currentSeasonId ? save.seasons[save.currentSeasonId] : undefined;
  const competitionTable = activeCompetitionTable(save);
  const table = competitionTable.rows;
  const sacked = Boolean(save.flags?.sacked);
  const allOtherClubs = Object.values(save.teams).filter(
    (candidate) => candidate.id !== save.userTeamId,
  );
  const allowedAppointmentIds = !save.managerCalendar
    ? undefined
    : save.userDivision === 1
      ? save.divisions?.tier1
      : save.userDivision === 2
        ? save.divisions?.tier2
        : save.divisions?.tier3;
  const divisionAppointments = allowedAppointmentIds?.length
    ? allOtherClubs.filter((candidate) => allowedAppointmentIds.includes(candidate.id))
    : allOtherClubs;
  const otherClubs = (divisionAppointments.length ? divisionAppointments : allOtherClubs)
    .sort((a, b) => a.reputation - b.reputation)
    .slice(0, 6);

  // Multi-format competitions unlocked at State/National level (empty for Club).
  const competitionOptions = nextUserFixturesByCompetition(save);
  const otherCompetitionOptions = competitionOptions.filter(
    (option) => option.competitionId !== 't20-league',
  );
  const managerLevel = save.managerCareerLevel ?? 'CLUB';
  const calendarProgress = save.managerCalendar ? managerPhaseProgress(save) : null;
  const nextStep = resolveNextCareerStep(save);
  const nextFixtureOption = competitionOptions[0];
  const nextFixture = nextStep.fixtureId
    ? save.fixtures[nextStep.fixtureId]
    : nextFixtureOption
      ? save.fixtures[nextFixtureOption.fixtureId]
      : undefined;
  const tablePositionIndex = table.findIndex((row) => row.teamId === activeManagedTeamId);
  const tablePosition = tablePositionIndex >= 0 ? tablePositionIndex + 1 : null;
  const fixtureHomeTeam = nextFixture ? save.teams[nextFixture.homeTeamId] : undefined;
  const fixtureAwayTeam = nextFixture ? save.teams[nextFixture.awayTeamId] : undefined;
  const showFixtureTicket = Boolean(
    nextStep.action === 'PLAY_MATCH' && nextFixture && fixtureHomeTeam && fixtureAwayTeam,
  );
  const fixtureMonth = nextFixture?.calendarMonth ?? save.currentMonth ?? 1;
  const fixtureDateLabel = `${MONTHS[fixtureMonth - 1] ?? 'Season'}${nextFixture?.calendarWeek ? ` · Week ${nextFixture.calendarWeek}` : ''}`;
  const fixtureRoundLabel = nextFixture?.cupRound
    ? nextFixture.cupRound
    : nextFixture
      ? `Round ${nextFixture.round}`
      : '';
  const managerMeta = isNationalManager
    ? MANAGER_LEVEL_LABEL[managerLevel]
    : `${MANAGER_LEVEL_LABEL[managerLevel]} · Tier ${save.userDivision ?? 3}`;
  const monthLabel = MONTHS[(save.currentMonth ?? 1) - 1] ?? '';
  const nextActionKicker =
    nextStep.mode === 'manager' && nextStep.type === ManagerStepType.MATCHDAY
      ? `NEXT · MATCHDAY${monthLabel ? ` · ${monthLabel}` : ''}`
      : nextStep.mode === 'manager' && nextStep.type === ManagerStepType.PRESS_REQUIRED
        ? 'NEWS'
        : nextStep.mode === 'manager' && nextStep.type === ManagerStepType.JOB_OFFER_REQUIRED
          ? 'URGENT JOB OFFER'
          : nextStep.mode === 'manager' && nextStep.type === ManagerStepType.JOB_SEARCH
            ? 'CAREER'
            : isNationalManager
              ? `${calendarProgress?.months ?? 'SEASON'} · NATIONAL DUTY`
              : `${calendarProgress?.months ?? 'SEASON'} · Tier ${save.userDivision ?? 3}`;
  const continueLabel =
    nextStep.action === 'PLAY_MATCH'
      ? 'Enter Matchday'
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

  const confidenceScore = Math.max(0, Math.min(100, Math.round(save.boardConfidence ?? 60)));
  const boardStage: 'safe' | 'concerned' | 'ultimatum' | 'danger' =
    confidenceScore >= 60
      ? 'safe'
      : confidenceScore >= 35
        ? 'concerned'
        : confidenceScore >= 15
          ? 'ultimatum'
          : 'danger';
  const boardPresentation =
    boardStage === 'danger'
      ? {
          color: colors.dangerDark,
          label: 'Sacking imminent',
        }
      : {
          color: colors.danger,
          label: 'Ultimatum',
        };

  const onSaveExit = async () => {
    useCareer.getState().scheduleReminders();
    try {
      await persistCritical(true);
      goMenu();
    } catch {
      Alert.alert('Save failed', 'Save not confirmed. Stay here and retry before closing the app.');
    }
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

  const startNextSeason = () => {
    const completedYear = season?.year;
    newSeason();
    const updated = useCareer.getState().save;
    const settlement = updated?.lastSeasonSettlement;
    if (!settlement || settlement.year !== completedYear) return;
    const net = settlement.newBudget - settlement.previousBudget;
    const broadcast = settlement.broadcastIncome ?? settlement.sponsorIncome;
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
        `Broadcast rights: +${fmtMoney(broadcast)}`,
        `Kit sponsorship: +${fmtMoney(settlement.kitSponsorIncome ?? 0)}`,
        `Player wages: -${fmtMoney(settlement.playerWages)}`,
        `Gate receipts: +${fmtMoney(settlement.gateReceipts)}`,
        `Staff wages: -${fmtMoney(settlement.staffWages)}`,
        `Infrastructure upkeep: -${fmtMoney(settlement.facilityUpkeep)}`,
      ],
      balances: [
        `Club budget: ${fmtMoney(settlement.previousBudget)} -> ${fmtMoney(settlement.newBudget)}`,
        `Net change: ${net >= 0 ? '+' : ''}${fmtMoney(net)}`,
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
          ...(backgroundBlock ? ['Club staff controlled this block.'] : []),
          `Club record: ${result.summary.userWins} wins from ${result.summary.userMatches} matches`,
          ...(result.summary.userPosition
            ? [`Division finish: ${ordinal(result.summary.userPosition)}`]
            : []),
          ...(result.summary.overRatePenalties
            ? [`Over-rate penalties: ${result.summary.overRatePenalties} point(s)`]
            : []),
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
        Alert.alert('Club appointments', 'Select a club below.');
        break;
      default:
        break;
    }
  };

  return (
    <>
      {save.managerAppointmentPending && (
        <ManagerAppointmentPaper
          club={save.managerAppointmentPending.clubName}
          salary={save.managerProgression?.contractSalary}
          year={season?.year}
          onContinue={acknowledgeManagerAppointment}
        />
      )}
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
                label: 'Standings',
                onPress: () => navigation.navigate('Records'),
              },
            ]}
          />
        }
      >
        <ScreenHeader
          title="Manager Career"
          subtitle={`Age ${save.managerAge ?? 35} · Season ${season?.year ?? ''}`}
          onBack={goMenu}
        />

        <View style={styles.managerMasthead}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${activeManagedTeam.name} club crest`}
            style={[styles.clubCrest, { borderColor: activeManagedTeam.primaryColor }]}
          >
            <View
              style={[styles.clubCrestInner, { backgroundColor: activeManagedTeam.secondaryColor }]}
            >
              <Icon name="trophy" size={26} color={activeManagedTeam.primaryColor} />
            </View>
          </View>
          <View style={styles.managerMastheadCopy}>
            <Text style={styles.managerClubName} numberOfLines={2} accessibilityRole="header">
              {activeManagedTeam.name}
            </Text>
            <Text style={styles.managerRole} numberOfLines={1}>
              {isNationalManager ? 'National Head Coach' : 'Club Manager'}
            </Text>
            <Text style={styles.managerMeta} numberOfLines={2}>
              {managerMeta}
            </Text>
          </View>
        </View>
        <SponsorBrandRow
          earned={managerSponsorBranding.earned}
          premium={managerSponsorBranding.premium}
          compact
          style={styles.clubSponsorHeader}
        />

        <View
          style={[styles.fixtureTicket, !showFixtureTicket && styles.deskTicket]}
          accessible
          accessibilityLabel={
            showFixtureTicket && nextFixture && fixtureHomeTeam && fixtureAwayTeam
              ? `Next fixture, ${fixtureHomeTeam.name} versus ${fixtureAwayTeam.name}, ${nextFixture.format}, ${nextFixture.venue}`
              : `${nextActionKicker}. ${nextStep.title}`
          }
        >
          <View style={styles.ticketStitchRail}>
            {[0, 1, 2, 3, 4, 5, 6].map((stitch) => (
              <View key={stitch} style={styles.ticketStitch} />
            ))}
          </View>
          <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
          <View style={[styles.ticketNotch, styles.ticketNotchRight]} />
          <View style={styles.ticketTopRule} />
          <Text style={styles.ticketKicker}>
            {showFixtureTicket ? '★  MATCHDAY ACCREDITATION  ★' : '★  MANAGER DESK  ★'}
          </Text>
          {showFixtureTicket && nextFixture && fixtureHomeTeam && fixtureAwayTeam ? (
            <>
              <View style={styles.ticketTeams}>
                <View style={styles.ticketTeam}>
                  <View
                    style={[
                      styles.ticketTeamBadge,
                      {
                        backgroundColor: fixtureHomeTeam.primaryColor,
                        borderColor: fixtureHomeTeam.secondaryColor,
                      },
                    ]}
                  >
                    <View style={styles.ticketBadgeShade} />
                    <Text style={styles.ticketBadgeText} numberOfLines={1}>
                      {fixtureHomeTeam.shortName.slice(0, 3).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.ticketTeamName} numberOfLines={2}>
                    {fixtureHomeTeam.name}
                  </Text>
                  <Text style={styles.ticketTeamRole}>HOME</Text>
                </View>
                <View style={styles.ticketVersus}>
                  <Text style={styles.ticketVs}>VS</Text>
                  <Text style={styles.ticketFormat} numberOfLines={1}>
                    {calendarProgress?.label ?? nextFixture.format}
                  </Text>
                  <Text style={styles.ticketRound} numberOfLines={1}>
                    {fixtureRoundLabel}
                  </Text>
                </View>
                <View style={styles.ticketTeam}>
                  <View
                    style={[
                      styles.ticketTeamBadge,
                      {
                        backgroundColor: fixtureAwayTeam.primaryColor,
                        borderColor: fixtureAwayTeam.secondaryColor,
                      },
                    ]}
                  >
                    <View style={styles.ticketBadgeShade} />
                    <Text style={styles.ticketBadgeText} numberOfLines={1}>
                      {fixtureAwayTeam.shortName.slice(0, 3).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.ticketTeamName} numberOfLines={2}>
                    {fixtureAwayTeam.name}
                  </Text>
                  <Text style={styles.ticketTeamRole}>AWAY</Text>
                </View>
              </View>
              <View style={styles.ticketDetails}>
                <View style={styles.ticketDetail}>
                  <Icon name="calendar-outline" size={16} color={MANAGER_HOME_MATERIALS.leather} />
                  <Text style={styles.ticketDetailText}>{fixtureDateLabel}</Text>
                </View>
                <View style={styles.ticketDetail}>
                  <Icon name="location-outline" size={16} color={MANAGER_HOME_MATERIALS.leather} />
                  <Text style={styles.ticketDetailText} numberOfLines={2}>
                    {nextFixture.venue}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.deskTicketBody}>
              <Icon name="clipboard-outline" size={28} color={MANAGER_HOME_MATERIALS.leather} />
              <View style={styles.deskTicketCopy}>
                <Text style={styles.deskTicketKicker}>{nextActionKicker}</Text>
                <Text style={styles.deskTicketTitle} numberOfLines={2}>
                  {nextStep.title}
                </Text>
              </View>
            </View>
          )}
          <View style={styles.ticketBottomRule} />
        </View>

        {nextStep.action === 'OPEN_JOB_SEARCH' ? (
          <Card style={styles.sackedCard}>
            <Text style={styles.sackedTitle}>Choose your next club</Text>
            <Text style={styles.sackedBody}>Select an available appointment to continue.</Text>
            {otherClubs.map((candidate) => (
              <Pressable
                key={candidate.id}
                style={styles.jobRow}
                onPress={() => takeNewJob(candidate.id)}
                accessibilityRole="button"
                accessibilityLabel={`Take charge of ${candidate.name}`}
              >
                <Text style={styles.jobName} numberOfLines={1}>
                  {candidate.name}
                </Text>
                <Text style={styles.jobRep}>Rep {candidate.reputation} →</Text>
              </Pressable>
            ))}
          </Card>
        ) : (
          <View style={styles.continueAction}>
            <Button label={continueLabel} variant="gold" size="lg" onPress={runNextStep} />
          </View>
        )}

        <SeasonPassHomeCard />

        {/* Dressing-room actions preserve every existing destination. */}
        {!sacked ? (
          <View style={styles.navGrid}>
            {(
              [
                { key: 'squad', icon: 'people', label: 'Team Sheet', to: 'Squad' },
                ...(isNationalManager
                  ? [
                      {
                        key: 'rankings',
                        icon: 'podium-outline' as IconName,
                        label: 'Rankings',
                        to: 'InternationalCalendar' as const,
                      },
                    ]
                  : []),
                ...(!isNationalManager
                  ? [
                      {
                        key: 'training',
                        icon: 'barbell-outline' as IconName,
                        label: 'Training',
                        to: 'Training' as const,
                      },
                      {
                        key: 'transfers',
                        icon: 'swap-horizontal' as IconName,
                        label: 'Transfers',
                        to: 'Transfers' as const,
                      },
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
                    ]
                  : []),
              ] as {
                key: string;
                icon: IconName;
                label: string;
                to:
                  | 'Squad'
                  | 'InternationalCalendar'
                  | 'Training'
                  | 'Transfers'
                  | 'TransferDeadlineDay';
              }[]
            ).map((tile) => (
              <Pressable
                key={tile.key}
                style={[styles.navTile, compact && styles.navTileCompact]}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
                onPress={() => navigation.navigate(tile.to)}
              >
                <Icon name={tile.icon} size={24} color={colors.accentLight} />
                <Text style={styles.navTileLabel} numberOfLines={1}>
                  {tile.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {leadershipNeedsReview ? (
          <Pressable
            style={styles.leadershipReview}
            accessibilityRole="button"
            accessibilityLabel="Review captain and vice-captain"
            onPress={() => navigation.navigate('ManagerLeadership')}
          >
            <Icon name="people" size={20} color={colors.accent} />
            <View style={styles.leadershipReviewCopy}>
              <Text style={styles.leadershipReviewTitle}>Review team leadership</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {/* Board information interrupts Home only when the manager's job is in immediate danger. */}
        {!isNationalManager && save.boardObjective && confidenceScore < 35 ? (
          <View style={styles.boardMemo}>
            <View style={styles.boardMemoHeader}>
              <View style={styles.boardTitleRow}>
                <Icon
                  name="document-text-outline"
                  size={18}
                  color={MANAGER_HOME_MATERIALS.leather}
                />
                <Text
                  style={styles.boardHeaderTitle}
                  accessibilityRole="header"
                  accessibilityLabel={`Board confidence: ${boardPresentation.label}, ${confidenceScore} percent. Target top ${save.boardObjective.targetPosition}.`}
                >
                  BOARD MEMO
                </Text>
                <MechanicInfoButton topicId="board-grace" size={32} />
              </View>
              <View
                style={[
                  styles.boardStamp,
                  { borderColor: boardPresentation.color, transform: [{ rotate: '-3deg' }] },
                ]}
              >
                <Text style={[styles.boardStampText, { color: boardPresentation.color }]}>
                  {boardPresentation.label.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.boardMemoDetails}>
              <Text style={styles.boardObjectiveLine}>
                Target: Top {save.boardObjective.targetPosition} · Now:{' '}
                {tablePosition ? ordinal(tablePosition) : '—'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Multi-format competition picker — appears once promoted to State/National */}
        {!save.managerCalendar && otherCompetitionOptions.length > 0 && (
          <>
            <Text style={styles.section}>Multi-Format Schedule</Text>
            <Card>
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

        <Button
          label="Save &amp; Exit"
          variant="ghost"
          style={{ marginTop: spacing.xl }}
          onPress={onSaveExit}
        />
      </Screen>
      <Modal transparent visible={Boolean(calendarSimulation)} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.simulationPanel} accessibilityLiveRegion="polite">
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.simulationTitle}>Simulating competition</Text>
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
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    clubSponsorHeader: { marginTop: spacing.sm, marginBottom: spacing.sm },
    managerMasthead: {
      minHeight: 96,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent + '66',
      paddingVertical: spacing.md,
    },
    clubCrest: {
      width: 72,
      height: 82,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      padding: 5,
    },
    clubCrestInner: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accent + 'AA',
    },
    managerMastheadCopy: { flex: 1, minWidth: 0 },
    managerClubName: {
      color: colors.text,
      fontSize: fontSize.lg,
      lineHeight: 23,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
    },
    managerRole: {
      color: colors.accentLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: 4,
    },
    managerIdentity: {
      color: colors.text,
      fontSize: 10,
      fontWeight: fontWeight.semibold,
      marginTop: 2,
    },
    managerMeta: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },

    // Cricket-white fixture ticket: real saved fixture data only.
    fixtureTicket: {
      position: 'relative',
      overflow: 'hidden',
      minHeight: 218,
      marginTop: spacing.sm,
      borderWidth: 1.5,
      borderColor: MANAGER_HOME_MATERIALS.paperEdge,
      borderRadius: radius.sm,
      backgroundColor: MANAGER_HOME_MATERIALS.paper,
      paddingTop: spacing.md,
      paddingRight: spacing.md,
      paddingBottom: spacing.md,
      paddingLeft: spacing.xl,
    },
    deskTicket: { minHeight: 166 },
    ticketStitchRail: {
      position: 'absolute',
      top: 8,
      bottom: 8,
      left: 9,
      width: 13,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRightWidth: 1,
      borderRightColor: MANAGER_HOME_MATERIALS.leather,
    },
    ticketStitch: {
      width: 12,
      height: 2,
      backgroundColor: MANAGER_HOME_MATERIALS.leather,
      transform: [{ rotate: '34deg' }],
    },
    ticketNotch: {
      position: 'absolute',
      top: '48%',
      zIndex: 4,
      width: 36,
      height: 36,
      borderWidth: 1,
      borderColor: MANAGER_HOME_MATERIALS.paperEdge,
      borderRadius: 18,
      backgroundColor: colors.bgElevated,
    },
    ticketNotchLeft: { left: -22 },
    ticketNotchRight: { right: -22 },
    ticketTopRule: {
      position: 'absolute',
      top: 8,
      right: spacing.md,
      left: spacing.xxl,
      height: 1,
      opacity: 0.52,
      backgroundColor: MANAGER_HOME_MATERIALS.leather,
    },
    ticketBottomRule: {
      position: 'absolute',
      right: spacing.md,
      bottom: 8,
      left: spacing.xxl,
      height: 1,
      opacity: 0.52,
      backgroundColor: MANAGER_HOME_MATERIALS.leather,
    },
    ticketKicker: {
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: fontSize.sm,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      textAlign: 'center',
      letterSpacing: 0.6,
    },
    ticketTeams: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    ticketTeam: { flex: 1, minWidth: 0, alignItems: 'center' },
    ticketTeamBadge: {
      width: 54,
      height: 58,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderRadius: radius.md,
    },
    ticketBadgeShade: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.32)',
    },
    ticketBadgeText: {
      color: '#FFFFFF',
      fontSize: fontSize.sm,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      letterSpacing: 0.4,
    },
    ticketTeamName: {
      minHeight: 28,
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: fontSize.xs,
      lineHeight: 14,
      fontWeight: fontWeight.heavy,
      textAlign: 'center',
      marginTop: 4,
    },
    ticketTeamRole: {
      color: MANAGER_HOME_MATERIALS.leather,
      fontSize: 8,
      fontWeight: fontWeight.black,
      letterSpacing: 0.8,
      marginTop: 2,
    },
    ticketVersus: {
      width: 76,
      flexShrink: 0,
      alignItems: 'center',
      paddingTop: spacing.xs,
    },
    ticketVs: {
      color: MANAGER_HOME_MATERIALS.leather,
      fontSize: fontSize.xl,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
    },
    ticketFormat: {
      maxWidth: 76,
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: 9,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginTop: 2,
    },
    ticketRound: {
      color: MANAGER_HOME_MATERIALS.paperMuted,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
      marginTop: 2,
    },
    ticketDetails: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: MANAGER_HOME_MATERIALS.paperEdge,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
    },
    ticketDetail: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    ticketDetailText: {
      flex: 1,
      minWidth: 0,
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: 9,
      lineHeight: 12,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
    },
    ticketPerforation: {
      height: 1,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderColor: MANAGER_HOME_MATERIALS.paperEdge,
      marginTop: spacing.sm,
    },
    accessStub: {
      minHeight: 49,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    accessStubCopy: { flex: 1, minWidth: 0 },
    accessKicker: {
      color: MANAGER_HOME_MATERIALS.leather,
      fontSize: 9,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      letterSpacing: 0.7,
    },
    accessDetail: {
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: 10,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    accessMeta: {
      color: MANAGER_HOME_MATERIALS.paperMuted,
      fontSize: 8,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    barcode: {
      height: 34,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 2,
      borderLeftWidth: 1,
      borderLeftColor: MANAGER_HOME_MATERIALS.paperEdge,
      paddingLeft: spacing.sm,
    },
    barcodeLine: { backgroundColor: MANAGER_HOME_MATERIALS.paperInk },
    deskTicketBody: {
      flex: 1,
      minHeight: 112,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
    },
    deskTicketCopy: { flex: 1, minWidth: 0, maxWidth: 420 },
    deskTicketKicker: {
      color: MANAGER_HOME_MATERIALS.leather,
      fontSize: 9,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    deskTicketTitle: {
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: fontSize.lg,
      lineHeight: 24,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      marginTop: 4,
    },
    continueAction: { marginTop: spacing.md },
    continueEyebrow: {
      color: MANAGER_HOME_MATERIALS.leather,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    readinessBoard: {
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.accent + '88',
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
    },
    readinessHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    readinessTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    calendarHeaderCopy: { flex: 1, minWidth: 0 },
    calendarTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    readinessTitle: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: fontSize.md,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
    },
    readinessCompetition: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    calendarAccess: { fontSize: 10, fontWeight: fontWeight.black },
    readinessMetrics: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      paddingVertical: spacing.md,
    },
    readinessMetric: {
      flex: 1,
      alignItems: 'center',
      borderRightWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      paddingHorizontal: spacing.xs,
    },
    readinessMetricLast: { borderRightWidth: 0 },
    readinessMetricLabel: {
      color: colors.textFaint,
      fontSize: 8,
      fontWeight: fontWeight.black,
      letterSpacing: 0.5,
    },
    readinessMetricValue: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    competitionLine: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingTop: spacing.sm,
    },
    competitionLineText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    competitionLineDivider: { width: 1, height: 14, backgroundColor: colors.borderStrong },
    competitionLastResult: { flex: 1, minWidth: 0, color: colors.textMuted, fontSize: 10 },

    // Dressing-room action row.
    navGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    navTile: {
      width: '31.5%',
      flexGrow: 1,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.accent + '99',
      backgroundColor: colors.surfaceMuted,
    },
    navTileLabel: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontFamily: fonts.display,
      fontWeight: fontWeight.heavy,
      textTransform: 'uppercase',
    },
    // Compact phones: 2 columns instead of 3 so labels don't clip.
    navTileCompact: { width: '47%' },
    leadershipReview: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.accent + '77',
      backgroundColor: colors.surfaceMuted,
    },
    leadershipReviewCopy: { flex: 1, minWidth: 0 },
    leadershipReviewTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
    },
    leadershipReviewText: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
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
    // Paper memo keeps the board status cricket-club specific rather than KPI-like.
    boardMemo: {
      overflow: 'hidden',
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: MANAGER_HOME_MATERIALS.paperEdge,
      borderRadius: radius.sm,
      backgroundColor: MANAGER_HOME_MATERIALS.paper,
      padding: spacing.md,
    },
    boardMemoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    boardHeaderTitle: {
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: fontSize.sm,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      letterSpacing: 0.5,
    },
    boardTitleRow: {
      flexGrow: 1,
      minWidth: 180,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    boardStamp: {
      maxWidth: 150,
      borderWidth: 2,
      borderRadius: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    boardStampText: {
      fontSize: 10,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      letterSpacing: 0.5,
      textAlign: 'center',
    },
    boardMemoCopy: {
      color: MANAGER_HOME_MATERIALS.paperInk,
      fontSize: fontSize.sm,
      lineHeight: 18,
      marginTop: spacing.sm,
    },
    boardMemoDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: MANAGER_HOME_MATERIALS.paperEdge,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
    },
    boardObjectiveLine: {
      color: MANAGER_HOME_MATERIALS.paperMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    boardConfidenceDetail: {
      color: MANAGER_HOME_MATERIALS.paperMuted,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
    },
    ultimatumText: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      lineHeight: 16,
      marginTop: 6,
    },

    talkHint: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.sm },
    competitionProgress: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginBottom: 4,
    },
    objectivesCard: { gap: spacing.sm },
    objectivesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    objectivesTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    objectivesMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    objectiveCounts: { flexDirection: 'row', gap: spacing.lg },
    objectiveCount: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    objectiveAction: { marginTop: spacing.xs },
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
  });
