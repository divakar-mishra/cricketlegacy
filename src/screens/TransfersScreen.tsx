import { FlashList } from '@shopify/flash-list';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  AppText as Text,
  Button,
  Card,
  Icon,
  MechanicInfoButton,
  PlayerStatusBadges,
  Screen,
  ScreenHeader,
} from '../components';
import { Player } from '../domain/types';
import {
  computeValue,
  formatClubCurrency,
  maxSquadSize,
  MIN_SQUAD,
  WAGE_RATE,
} from '../game/finance';
import { SCOUT_FEE, superstarPrefersClub } from '../game/manager';
import { MANAGER_FAST_TRACK_SCOUT_COINS } from '../game/managerResources';
import {
  isTransferWindowOpen,
  rivalInterestCount,
  transferWindowLabel,
} from '../game/transferMarket';
import { ScreenProps } from '../navigation';
import { SCOUT_FULL_REVEAL_GEMS, useCareer } from '../state/careerStore';
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

const ROLE_ABBR: Record<string, string> = {
  BATTER: 'BAT',
  BOWLER: 'BOWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};
const fmtMoney = formatClubCurrency;

function CountryBadge({ countryId }: { countryId: string }) {
  const styles = useThemedStyles(makeStyles);
  const label = countryId.slice(0, 3).toUpperCase();
  return (
    <View style={styles.countryBadge} accessible accessibilityLabel={`Country ${countryId}`}>
      <Text style={styles.countryBadgeText}>{label}</Text>
    </View>
  );
}

// ─── Bid War Modal ────────────────────────────────────────────────────────────

interface BidWar {
  player: Player;
  rivalClub: string;
  yourOffer: number;
  rivalOffer: number;
  value: number;
  remainingBudget: number;
  timeLeft: number; // seconds
}

function BidWarModal({
  bidWar,
  pending,
  onCounter,
  onWithdraw,
  onExpire,
}: {
  bidWar: BidWar;
  pending: boolean;
  onCounter: (newOffer: number) => void;
  onWithdraw: () => void;
  onExpire: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [timeLeft, setTimeLeft] = useState(bidWar.timeLeft);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (pending) return t;
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onExpire(); // time out = player goes to rival
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onExpire, pending]);

  const urgency = timeLeft <= 10 ? colors.danger : timeLeft <= 20 ? colors.warning : colors.accent;
  const counterOffer = Math.round(bidWar.rivalOffer * 1.12); // 12% above rival
  const canAfford = bidWar.remainingBudget >= counterOffer;
  const counterDisabled = !canAfford || pending;
  const wageRequirement = bidWar.player.contract?.wage ?? Math.round(bidWar.value * WAGE_RATE);
  const remainingAfterCounter = bidWar.remainingBudget - counterOffer;
  const { height: windowHeight } = useWindowDimensions();
  const detailMaxHeight = Math.max(190, Math.min(300, windowHeight * 0.28));

  return (
    <Modal transparent animationType="fade">
      <View style={styles.bidOverlay}>
        <Animated.View entering={FadeInDown.duration(220)} style={[styles.bidCard, shadow.card]}>
          {/* Header */}
          <View style={styles.bidHeader}>
            <Text style={styles.bidTitle}>Bid War</Text>
            <View style={[styles.timerBadge, { backgroundColor: urgency }]}>
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          </View>

          <View style={styles.bidActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Confirm counter: ${fmtMoney(counterOffer)}`}
              accessibilityState={{ disabled: counterDisabled }}
              disabled={counterDisabled}
              style={[styles.bidActionPrimary, counterDisabled && styles.bidActionDisabled]}
              onPress={() => onCounter(counterOffer)}
            >
              <Text style={styles.bidActionPrimaryText}>
                {pending ? 'Confirming...' : `Confirm counter: ${fmtMoney(counterOffer)}`}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Withdraw"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              style={[styles.bidActionSecondary, pending && styles.bidActionDisabled]}
              onPress={onWithdraw}
            >
              <Text style={styles.bidActionSecondaryText}>
                {pending ? 'Working...' : 'Withdraw'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={[styles.bidScroll, { maxHeight: detailMaxHeight }]}
            contentContainerStyle={styles.bidScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Player */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(80)}
              style={styles.bidPlayerCard}
            >
              <Text style={styles.bidPlayerName}>{bidWar.player.name}</Text>
              <Text style={styles.bidPlayerMeta}>
                {ROLE_ABBR[bidWar.player.role]} - Age {bidWar.player.age} - OVR{' '}
                {bidWar.player.overall}
              </Text>
            </Animated.View>

            {/* Offers comparison */}
            <Animated.View entering={FadeInDown.duration(300).delay(160)} style={styles.offersRow}>
              <View style={styles.offerBox}>
                <Text style={styles.offerClub}>Your Offer</Text>
                <Text style={[styles.offerAmount, { color: colors.primary }]}>
                  {fmtMoney(bidWar.yourOffer)}
                </Text>
              </View>
              <Text style={styles.offerVs}>VS</Text>
              <View style={[styles.offerBox, styles.offerBoxRival]}>
                <Text style={styles.offerClub}>{bidWar.rivalClub}</Text>
                <Text style={[styles.offerAmount, { color: colors.danger }]}>
                  {fmtMoney(bidWar.rivalOffer)}
                </Text>
              </View>
            </Animated.View>

            {/* Urgency bar */}
            <View style={styles.urgencyBarBg}>
              <Animated.View
                style={[
                  styles.urgencyBarFill,
                  { width: `${(timeLeft / bidWar.timeLeft) * 100}%`, backgroundColor: urgency },
                ]}
              />
            </View>
            <Text style={styles.urgencyHint}>
              {timeLeft > 20
                ? 'Rival considering.'
                : timeLeft > 10
                  ? 'Rival close to signing.'
                  : 'Decide now or lose the player.'}
            </Text>
            <Text style={styles.bidFooter}>
              Minimum next bid: {fmtMoney(counterOffer)} - Wage requirement:{' '}
              {fmtMoney(wageRequirement)}/season
            </Text>
            <Text style={styles.bidFooter}>
              Remaining budget after counter: {fmtMoney(Math.max(0, remainingAfterCounter))}
            </Text>
            <Text style={styles.bidFooter}>
              Market value: {fmtMoney(bidWar.value)} - Budget: {fmtMoney(bidWar.remainingBudget)}
            </Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Rival clubs list (generated from save) ──────────────────────────────────

const RIVAL_NAMES = [
  'City Lions',
  'North Hawks',
  'River Royals',
  'Blue Bulls',
  'Red Tigers',
  'Capital Kings',
  'Coast Chargers',
  'Valley Vikings',
  'Star Strikers',
  'Iron Eagles',
];

function getRandomRival(exclude: string): string {
  const filtered = RIVAL_NAMES.filter((n) => n !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type FilterRole = 'ALL' | 'BATTER' | 'BOWLER' | 'ALLROUNDER' | 'WK_BATTER';
type SortField = 'OVR' | 'AGE_ASC' | 'AGE_DESC' | 'VALUE';

export function TransfersScreen({ navigation }: ScreenProps<'Transfers'>) {
  const save = useCareer((s) => s.save);
  const signPlayer = useCareer((s) => s.signPlayer);
  const releasePlayer = useCareer((s) => s.releasePlayer);
  const removeFreeAgent = useCareer((s) => s.removeFreeAgent);
  const scout = useCareer((s) => s.scout);
  const runManagerResource = useCareer((s) => s.useManagerResource);
  const revealFullScout = useCareer((s) => s.useFullScoutReveal);
  const loanPlayer = useCareer((s) => s.loanPlayer);
  const recallLoan = useCareer((s) => s.recallLoan);
  const offerFreeAgentContract = useCareer((s) => s.offerFreeAgentContract);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<'market' | 'squad' | 'loan'>('market');
  const [bidWar, setBidWar] = useState<BidWar | null>(null);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<FilterRole>('ALL');
  const [sortField, setSortField] = useState<SortField>('OVR');
  const [searchText, setSearchText] = useState('');
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingTransferAction, setPendingTransferAction] = useState<string | null>(null);
  const actionInFlightRef = useRef<string | null>(null);
  const actionReleaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFlash = useCallback((text: string, ok: boolean) => {
    setFlash({ text, ok });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 3000);
  }, []);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (actionReleaseTimer.current) clearTimeout(actionReleaseTimer.current);
    },
    [],
  );

  const runTransferAction = useCallback(<T,>(key: string, action: () => T): T | null => {
    if (actionInFlightRef.current) return null;
    actionInFlightRef.current = key;
    setPendingTransferAction(key);
    try {
      return action();
    } finally {
      if (actionReleaseTimer.current) clearTimeout(actionReleaseTimer.current);
      actionReleaseTimer.current = setTimeout(() => {
        if (actionInFlightRef.current === key) {
          actionInFlightRef.current = null;
          setPendingTransferAction(null);
        }
      }, 450);
    }
  }, []);

  if (!save || !save.userTeamId) {
    return (
      <Screen>
        <ScreenHeader title="Transfers" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active team.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  if (save.mode === 'manager' && save.managerCareerLevel === 'NATIONAL') {
    return (
      <Screen>
        <ScreenHeader title="Transfers" onBack={() => navigation.goBack()} />
        <Card style={styles.nationalPauseCard}>
          <Icon name="flag-outline" size={24} color={colors.primaryLight} />
          <Text style={styles.nationalPauseTitle}>Club operations paused</Text>
        </Card>
      </Screen>
    );
  }

  const team = save.teams[save.userTeamId];
  const freeAgents = (save.freeAgents ?? [])
    .map((id) => save.players[id])
    .filter(Boolean)
    .sort((a, b) => b.overall - a.overall);
  const squad = team.playerIds
    .map((id) => save.players[id])
    .filter(Boolean)
    .sort((a, b) => b.overall - a.overall);

  const isManager = save.mode === 'manager';
  const squadCap = maxSquadSize(save);
  const transferWindowOpen = isTransferWindowOpen(save);
  const scoutRevealTokens = Math.max(0, save.inventory?.scout_full_reveal_token ?? 0);

  const onSign = (p: Player) => {
    if (bidWar || actionInFlightRef.current) return;
    if (isManager && !transferWindowOpen) {
      showFlash('Transfer window closed.', false);
      return;
    }
    const value = computeValue(p);
    const interest = isManager ? rivalInterestCount(save, p.id) : 0;
    const rep = isManager ? save.scoutReports?.find((r) => r.playerId === p.id) : undefined;
    const scoutLine = isManager
      ? rep
        ? `Scout confidence: ${Math.round((1 - rep.uncertainty) * 100)}%`
        : 'Scout: not scouted yet'
      : null;
    const rivalLine =
      isManager && interest > 0
        ? `Market pressure: ${interest} rival club${interest > 1 ? 's' : ''} interested`
        : null;

    // Trigger bid-war when interest is high (>= 2 rival clubs)
    const prefersYourClub = isManager ? superstarPrefersClub(save, p) : false;
    if (isManager && interest >= 2 && !prefersYourClub && team.budget >= value * 1.1) {
      const rivalOffer = Math.round(value * (0.85 + Math.random() * 0.2));
      setBidWar({
        player: p,
        rivalClub: getRandomRival(team.name),
        yourOffer: value,
        rivalOffer,
        value,
        remainingBudget: team.budget,
        timeLeft: 30,
      });
      setSigningId(p.id);
      return;
    }

    const wage = p.contract?.wage ?? Math.round(value * WAGE_RATE);
    Alert.alert(
      'Negotiate transfer',
      [
        p.name,
        `Fee: ${fmtMoney(value)}`,
        `Expected wage: ${fmtMoney(wage)}`,
        `Budget after fee: ${fmtMoney(team.budget - value)}`,
        scoutLine,
        rivalLine,
      ]
        .filter(Boolean)
        .join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign',
          onPress: () => {
            const r = runTransferAction(`sign:${p.id}`, () => signPlayer(p.id));
            if (!r) return;
            showFlash(
              r.ok ? `Signed ${p.name} for ${fmtMoney(r.cost)}` : (r.reason ?? 'Cannot sign.'),
              r.ok,
            );
          },
        },
      ],
    );
  };

  const onBidWarCounter = (newOffer: number) => {
    if (!signingId || actionInFlightRef.current) return;
    const targetId = signingId;
    const r = runTransferAction(`counter:${targetId}`, () => signPlayer(targetId, newOffer));
    if (!r) return;
    setBidWar(null);
    setSigningId(null);
    showFlash(
      r.ok
        ? `Bid accepted: signed for ${fmtMoney(newOffer)}`
        : `Offer rejected: ${r.reason ?? 'Signing failed.'}`,
      r.ok,
    );
  };

  const resolveLostBidWar = (reason: 'withdraw' | 'expired') => {
    const lostId = signingId;
    if (!lostId || actionInFlightRef.current) return;
    const rivalClub = bidWar?.rivalClub ?? 'the rival club';
    const removed = runTransferAction(`walk:${lostId}`, () => {
      removeFreeAgent(lostId);
      return true;
    });
    if (!removed) return;
    setBidWar(null);
    setSigningId(null);
    showFlash(
      reason === 'expired'
        ? `Outbid: deadline expired; the player joined ${rivalClub}.`
        : `Withdrawn: the player joined ${rivalClub}.`,
      false,
    );
  };

  const onBidWarWithdraw = () => resolveLostBidWar('withdraw');

  const onBidWarExpire = () => resolveLostBidWar('expired');

  const onRelease = (id: string) => {
    const r = runTransferAction(`release:${id}`, () => releasePlayer(id));
    if (!r) return;
    const p = save.players[id];
    showFlash(
      r.ok
        ? `Released ${p?.name ?? ''} · recouped ${fmtMoney(r.recouped)}`
        : (r.reason ?? 'Cannot release.'),
      r.ok,
    );
  };

  const onScout = (id: string) => {
    const r = runTransferAction(`scout:${id}`, () => scout(id));
    if (!r) return;
    const p = save.players[id];
    showFlash(
      r.ok
        ? `🔍 Scout dispatched for ${p?.name ?? ''} (−${fmtMoney(SCOUT_FEE)})`
        : (r.reason ?? 'Cannot scout.'),
      r.ok,
    );
  };

  const onScoutChoice = (p: Player) => {
    const report = save.scoutReports?.find((entry) => entry.playerId === p.id);
    if (!report && scoutRevealTokens <= 0) {
      onScout(p.id);
      return;
    }
    if (report) {
      const fastTrack = () => {
        const result = runTransferAction(`fast-track-scout:${p.id}`, () =>
          runManagerResource('FAST_TRACK_SCOUT', p.id),
        );
        if (!result) return;
        showFlash(
          result.ok
            ? (result.detail ?? `${p.name}'s report was fast-tracked.`)
            : (result.reason ?? 'Fast-track scouting is unavailable.'),
          result.ok,
        );
      };
      const fullReveal = () => {
        const result = runTransferAction(`full-scout:${p.id}`, () =>
          revealFullScout(p.id, 'token'),
        );
        if (!result) return;
        showFlash(
          result.ok
            ? `Full report: ${p.name} · ${result.report?.knownOverall ?? p.overall} OVR. Fitness, form, injury and value confirmed.`
            : (result.reason ?? 'Full report unavailable.'),
          result.ok,
        );
      };
      Alert.alert(
        'Scouting options',
        `${p.name} · ${Math.round((1 - report.uncertainty) * 100)}% scout confidence. Fast-track: +25 points, once per season.`,
        [
          { text: 'Cancel', style: 'cancel' },
          scoutRevealTokens > 0
            ? { text: 'Use full-reveal token', onPress: fullReveal }
            : { text: 'Scout normally', onPress: () => onScout(p.id) },
          {
            text: `Fast-track · ${MANAGER_FAST_TRACK_SCOUT_COINS.toLocaleString()}`,
            onPress: fastTrack,
          },
        ],
      );
      return;
    }
    Alert.alert(
      'Full Scout Intelligence',
      `Reveal ${p.name}'s exact overall, fitness, form, injury status and valuation?\n\n${scoutRevealTokens} token${scoutRevealTokens === 1 ? '' : 's'} · Normal report: ${fmtMoney(SCOUT_FEE)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Scout normally', onPress: () => onScout(p.id) },
        {
          text: 'Use token',
          onPress: () => {
            const result = runTransferAction(`full-scout:${p.id}`, () =>
              revealFullScout(p.id, 'token'),
            );
            if (!result) return;
            showFlash(
              result.ok
                ? `Full report: ${p.name} · ${result.report?.knownOverall ?? p.overall} OVR. Fitness, form, injury and value confirmed.`
                : (result.reason ?? 'Full report unavailable.'),
              result.ok,
            );
          },
        },
      ],
    );
  };

  // Players available to loan: free agents + rival squad players (not already loaned out)
  const loanCandidates = [
    ...freeAgents.filter((p) => !p.loanedFrom),
    ...Object.values(save.teams)
      .filter((t) => t.id !== save.userTeamId)
      .flatMap((t) =>
        t.playerIds
          .map((id) => save.players[id])
          .filter((p): p is NonNullable<typeof p> => Boolean(p) && !p.loanedFrom),
      )
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 15),
  ];

  const rawData = tab === 'market' ? freeAgents : tab === 'loan' ? loanCandidates : squad;
  const data = rawData
    .filter((p) => filterRole === 'ALL' || p.role === filterRole)
    .filter((p) => !searchText || p.name.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => {
      switch (sortField) {
        case 'OVR':
          return b.overall - a.overall;
        case 'AGE_ASC':
          return a.age - b.age;
        case 'AGE_DESC':
          return b.age - a.age;
        case 'VALUE':
          return computeValue(b) - computeValue(a);
        default:
          return 0;
      }
    });

  const renderRow = ({ item: p }: { item: Player }) => {
    if (tab === 'market') {
      const value = computeValue(p);
      const canAfford =
        transferWindowOpen && team.budget >= value && team.playerIds.length < squadCap;
      const rep = isManager ? save.scoutReports?.find((r) => r.playerId === p.id) : undefined;
      const fullReport = !isManager || Boolean(rep && rep.uncertainty <= 0);
      const shownOvr = !isManager
        ? p.overall
        : fullReport
          ? p.overall
          : rep
            ? `~${rep.knownOverall}`
            : '?';
      const interest = isManager ? rivalInterestCount(save, p.id) : 0;
      const hotProperty = interest >= 2;
      const actionPending = Boolean(pendingTransferAction);
      const squadFull = team.playerIds.length >= squadCap;
      const signLabel = !transferWindowOpen
        ? 'Closed'
        : squadFull
          ? 'Squad full'
          : team.budget < value
            ? 'No funds'
            : 'Sign';
      const signVariant =
        !transferWindowOpen || squadFull || team.budget < value ? 'ghost' : 'primary';

      return (
        <Animated.View entering={FadeIn.duration(250)} style={styles.row}>
          <View style={styles.playerMainRow}>
            <CountryBadge countryId={p.nationality} />
            <Pressable
              style={styles.playerIdentity}
              onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}
            >
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {p.name}
                </Text>
                {rep?.recommended ? <Icon name="star" size={13} color={colors.accent} /> : null}
                {hotProperty ? (
                  <View style={styles.hotBadge}>
                    <Text style={styles.hotText}>Hot</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.meta}>
                {ROLE_ABBR[p.role]} · Age {p.age}
              </Text>
            </Pressable>
            {fullReport ? (
              <PlayerStatusBadges
                injured={Boolean(p.injury)}
                fitness={p.meta.fitness}
                mood={p.morale}
              />
            ) : null}
            <View style={styles.ovrBlock}>
              <Text style={styles.ovr}>{shownOvr}</Text>
              <Text style={styles.ovrLabel}>OVR</Text>
            </View>
          </View>
          <View style={styles.marketActionRow}>
            <Text style={styles.marketStatus} numberOfLines={1}>
              {rep
                ? fullReport
                  ? 'Full report available'
                  : `${Math.round((1 - rep.uncertainty) * 100)}% scout confidence`
                : isManager
                  ? 'Not scouted'
                  : fmtMoney(value)}
            </Text>
            <View style={styles.rowActions}>
              {isManager && !fullReport ? (
                <Button
                  label={scoutRevealTokens > 0 ? `Reveal (${scoutRevealTokens})` : 'Scout'}
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  style={styles.rowAction}
                  disabled={actionPending}
                  onPress={() => onScoutChoice(p)}
                />
              ) : null}
              <Button
                label={signLabel}
                size="sm"
                variant={signVariant}
                fullWidth={false}
                style={styles.rowAction}
                disabled={!canAfford || actionPending}
                onPress={() => onSign(p)}
              />
            </View>
          </View>
        </Animated.View>
      );
    }

    if (tab === 'loan') {
      const loanFee1 = Math.round(computeValue(p) * 0.2);
      const canLoan =
        transferWindowOpen &&
        team.budget >= loanFee1 &&
        team.playerIds.length < squadCap &&
        !p.loanedFrom;
      const isFreeAgent = (save.freeAgents ?? []).includes(p.id);
      const report = isManager
        ? save.scoutReports?.find((entry) => entry.playerId === p.id)
        : undefined;
      const fullReport = !isManager || Boolean(report && report.uncertainty <= 0);
      const shownOverall = fullReport ? p.overall : report ? `~${report.knownOverall}` : '?';
      const actionPending = Boolean(pendingTransferAction);
      const loanLabel = !transferWindowOpen
        ? 'Closed'
        : team.playerIds.length >= squadCap
          ? 'Squad full'
          : team.budget < loanFee1
            ? 'No funds'
            : 'Loan';
      const contractLabel = !transferWindowOpen
        ? 'Closed'
        : team.playerIds.length >= squadCap
          ? 'Squad full'
          : 'Contract';
      return (
        <Animated.View entering={FadeIn.duration(250)} style={styles.row}>
          <View style={styles.playerMainRow}>
            <CountryBadge countryId={p.nationality} />
            <Pressable
              style={styles.playerIdentity}
              onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}
            >
              <Text style={styles.name} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={styles.meta}>
                {ROLE_ABBR[p.role]} · Age {p.age}
                {isFreeAgent
                  ? ' · Free Agent'
                  : ` · ${Object.values(save.teams).find((t) => t.playerIds.includes(p.id))?.shortName ?? '?'}`}
              </Text>
            </Pressable>
            {fullReport ? (
              <PlayerStatusBadges
                injured={Boolean(p.injury)}
                fitness={p.meta.fitness}
                mood={p.morale}
              />
            ) : null}
            <View style={styles.ovrBlock}>
              <Text style={styles.ovr}>{shownOverall}</Text>
              <Text style={styles.ovrLabel}>OVR</Text>
            </View>
          </View>
          <View style={styles.marketActionRow}>
            <Text style={styles.marketStatus} numberOfLines={1}>
              {report
                ? `${Math.round((1 - report.uncertainty) * 100)}% scout confidence`
                : `Loan fee ${fmtMoney(loanFee1)}`}
            </Text>
            <View style={styles.rowActions}>
              {isManager && !fullReport ? (
                <Button
                  label="Scout"
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  style={styles.rowAction}
                  disabled={actionPending}
                  onPress={() => onScoutChoice(p)}
                />
              ) : null}
              <Button
                label={loanLabel}
                size="sm"
                variant="secondary"
                fullWidth={false}
                style={styles.rowAction}
                disabled={!canLoan || actionPending}
                onPress={() => {
                  const res = runTransferAction(`loan:${p.id}`, () => loanPlayer(p.id, 1));
                  if (!res) return;
                  showFlash(
                    res.ok
                      ? `${p.name} loaned for 1 season (-${fmtMoney(res.cost)})`
                      : (res.reason ?? 'Cannot loan.'),
                    res.ok,
                  );
                }}
              />
              {isFreeAgent ? (
                <Button
                  label={contractLabel}
                  size="sm"
                  variant="ghost"
                  fullWidth={false}
                  style={styles.rowAction}
                  disabled={
                    !transferWindowOpen || team.playerIds.length >= squadCap || actionPending
                  }
                  onPress={() => {
                    const res = runTransferAction(`contract:${p.id}`, () =>
                      offerFreeAgentContract(p.id, 2),
                    );
                    if (!res) return;
                    showFlash(
                      res.ok
                        ? `${p.name} signed on a free transfer`
                        : (res.reason ?? 'Cannot sign.'),
                      res.ok,
                    );
                  }}
                />
              ) : null}
            </View>
          </View>
        </Animated.View>
      );
    }

    const recoup = Math.round(computeValue(p) * 0.5);
    const canRelease = p.id !== save.userPlayerId && team.playerIds.length > MIN_SQUAD;
    const isOnLoan = Boolean(p.loanedFrom);
    const actionPending = Boolean(pendingTransferAction);
    return (
      <View style={styles.row}>
        <CountryBadge countryId={p.nationality} />
        <Pressable
          style={{ flex: 1 }}
          onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}
        >
          <Text style={styles.name} numberOfLines={1}>
            {p.name}
            {isOnLoan ? ' (Loan)' : ''}
          </Text>
          <Text style={styles.meta}>
            {ROLE_ABBR[p.role]} · Age {p.age} · {p.overall} OVR
            {isOnLoan ? ` · Loan ends ${p.loanEnd}` : ` · Release recoup: ${fmtMoney(recoup)}`}
          </Text>
          {/* Attribute bars */}
          <View style={styles.miniAttrRow}>
            {[
              { label: 'Bat', val: p.batting?.technique ?? 50 },
              { label: 'Bowl', val: p.bowling?.paceOrSpin ?? 50 },
              { label: 'Field', val: p.fielding?.catching ?? 50 },
            ].map((a) => (
              <View key={a.label} style={styles.miniAttr}>
                <Text style={styles.miniAttrLabel}>{a.label}</Text>
                <View style={styles.miniBarBg}>
                  <View style={[styles.miniBarFill, { width: `${a.val}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </Pressable>
        <PlayerStatusBadges
          captain={p.id === save.userPlayerId && Boolean(save.captainClub)}
          injured={Boolean(p.injury)}
          fitness={p.meta.fitness}
          mood={p.morale}
        />
        <Text style={styles.ovr}>{p.overall}</Text>
        {isOnLoan ? (
          <Button
            label="Recall"
            size="sm"
            variant="ghost"
            fullWidth={false}
            disabled={actionPending}
            onPress={() => {
              const ok = runTransferAction(`recall:${p.id}`, () => recallLoan(p.id));
              if (ok == null) return;
              showFlash(ok ? `${p.name} recalled from loan` : 'Cannot recall.', ok);
            }}
          />
        ) : (
          <Button
            label="Release"
            size="sm"
            variant="secondary"
            fullWidth={false}
            disabled={!canRelease || actionPending}
            onPress={() => onRelease(p.id)}
          />
        )}
      </View>
    );
  };

  const ListHeader = (
    <>
      <ScreenHeader
        title="Transfer Market"
        subtitle={team.name}
        onBack={() => navigation.goBack()}
      />

      {/* Finance strip */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.finance}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Budget</Text>
            <Text style={styles.financeValue}>{fmtMoney(team.budget)}</Text>
          </View>
          <View style={styles.financeDivider} />
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Squad</Text>
            <Text style={styles.squadSize}>
              {team.playerIds.length} / {squadCap}
            </Text>
          </View>
          <View style={styles.financeDivider} />
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Free Agents</Text>
            <Text style={styles.financeValue}>{freeAgents.length}</Text>
          </View>
        </Card>
      </Animated.View>

      {flash ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[styles.flash, { borderColor: flash.ok ? colors.success : colors.danger }]}
        >
          <Text style={[styles.flashText, { color: flash.ok ? colors.success : colors.danger }]}>
            {flash.text}
          </Text>
        </Animated.View>
      ) : null}

      {isManager && !transferWindowOpen ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Transfer window closed</Text>
          <Text style={styles.emptyText}>{transferWindowLabel(save)}</Text>
        </Card>
      ) : null}

      <View style={styles.tabs}>
        {(['market', 'squad', 'loan'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'market'
                ? `🏪 Market (${freeAgents.length})`
                : t === 'squad'
                  ? `👕 Squad (${squad.length})`
                  : '🤝 Loan'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'market' && isManager && (
        <View style={styles.marketHintRow}>
          <Text style={[styles.marketHint, { flex: 1 }]}>
            {scoutRevealTokens > 0
              ? `${scoutRevealTokens} full-reveal token${scoutRevealTokens === 1 ? '' : 's'} available.`
              : `Full reveal: ${SCOUT_FULL_REVEAL_GEMS} gems or a Store token. Rival interest may trigger bid wars.`}
          </Text>
          <MechanicInfoButton topicId="scout-confidence" size={40} />
        </View>
      )}

      {/* ── Search & Filter Bar ──────────────────────────────────────── */}
      <TextInput
        style={[
          styles.searchInput,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
        placeholder="Search player name…"
        placeholderTextColor={colors.textFaint}
        value={searchText}
        onChangeText={setSearchText}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {(['ALL', 'BATTER', 'BOWLER', 'ALLROUNDER', 'WK_BATTER'] as FilterRole[]).map((r) => (
          <Pressable
            key={r}
            onPress={() => setFilterRole(r)}
            style={[styles.filterChip, filterRole === r && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filterRole === r && styles.filterChipTextActive]}>
              {r === 'ALL'
                ? 'All'
                : r === 'WK_BATTER'
                  ? 'WK'
                  : r === 'ALLROUNDER'
                    ? 'AR'
                    : r === 'BATTER'
                      ? 'BAT'
                      : 'BWL'}
            </Text>
          </Pressable>
        ))}
        <View style={styles.filterDivider} />
        {(['OVR', 'AGE_ASC', 'AGE_DESC', 'VALUE'] as SortField[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSortField(s)}
            style={[styles.filterChip, sortField === s && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, sortField === s && styles.filterChipTextActive]}>
              {s === 'OVR'
                ? '↓ OVR'
                : s === 'AGE_ASC'
                  ? '↑ Age'
                  : s === 'AGE_DESC'
                    ? '↓ Age'
                    : '↓ Value'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.resultsCount}>
        {data.length} player{data.length !== 1 ? 's' : ''}
      </Text>
    </>
  );

  return (
    <Screen>
      <View style={styles.listWrap}>
        <FlashList
          data={data}
          extraData={[tab, flash, pendingTransferAction]}
          keyExtractor={(p) => p.id}
          renderItem={renderRow}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={<Text style={styles.emptyList}>No players found.</Text>}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Bid war modal */}
      {bidWar ? (
        <BidWarModal
          bidWar={bidWar}
          pending={Boolean(pendingTransferAction)}
          onCounter={onBidWarCounter}
          onWithdraw={onBidWarWithdraw}
          onExpire={onBidWarExpire}
        />
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    nationalPauseCard: { marginTop: spacing.md, gap: spacing.sm },
    nationalPauseTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
    },
    nationalPauseCopy: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },

    // Finance strip
    finance: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      padding: spacing.md,
    },
    financeItem: { flex: 1, alignItems: 'center' },
    financeDivider: { width: 1, height: 36, backgroundColor: colors.border },
    financeLabel: {
      color: colors.textFaint,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    financeValue: {
      color: colors.accent,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    squadSize: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      textAlign: 'center',
    },

    flash: {
      marginTop: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      padding: spacing.md,
      marginBottom: spacing.xs,
    },
    flashText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    marketHint: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },

    // Tabs
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    tabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    tabTextActive: { color: colors.white },

    // Search + filter
    searchInput: {
      borderRadius: radius.md,
      borderWidth: 1.5,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      fontSize: fontSize.sm,
      marginBottom: spacing.sm,
    },
    filterRow: { marginBottom: spacing.xs },
    filterContent: { gap: spacing.xs, paddingRight: spacing.md },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    filterChipText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    filterChipTextActive: { color: colors.white },
    filterDivider: {
      width: 1,
      backgroundColor: colors.border,
      alignSelf: 'stretch',
      marginHorizontal: 4,
    },
    resultsCount: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.xs },
    emptyCard: { marginTop: spacing.lg, marginBottom: spacing.md },
    emptyTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
      marginBottom: spacing.xs,
    },
    emptyText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },

    // Rows
    row: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.xs,
    },
    playerMainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    playerIdentity: { flex: 1, minWidth: 0 },
    countryBadge: {
      width: 29,
      height: 20,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      flexShrink: 0,
    },
    countryBadgeText: {
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: fontWeight.black,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    name: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium, flex: 1 },
    hotBadge: {
      backgroundColor: colors.danger,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    hotText: { color: colors.white, fontSize: 9, fontWeight: fontWeight.black },
    meta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },
    ovr: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    ovrBlock: { width: 38, alignItems: 'center' },
    ovrLabel: { color: colors.textFaint, fontSize: 8, fontWeight: fontWeight.bold },
    marketActionRow: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingLeft: 28,
    },
    marketStatus: { flex: 1, minWidth: 0, color: colors.textFaint, fontSize: 10 },
    rowActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: spacing.xs,
      flexShrink: 0,
    },
    rowAction: { minWidth: 72, maxWidth: 112 },
    emptyList: {
      color: colors.textFaint,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    listWrap: { flex: 1 },

    // Scout confidence bar
    marketHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    scoutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 },
    scoutBarBg: {
      flex: 1,
      height: 3,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 2,
      overflow: 'hidden',
    },
    scoutBarFill: { height: '100%', backgroundColor: colors.info, borderRadius: 2 },
    scoutConf: { color: colors.info, fontSize: 9, fontWeight: fontWeight.bold },

    // Mini attribute bars in squad view
    miniAttrRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
    miniAttr: { flex: 1 },
    miniAttrLabel: {
      color: colors.textFaint,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    miniBarBg: {
      height: 3,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 2,
      overflow: 'hidden',
    },
    miniBarFill: { height: '100%', backgroundColor: colors.primaryLight, borderRadius: 2 },

    // Bid war modal
    bidOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    bidCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.xl,
      borderWidth: 2,
      borderColor: colors.accent,
      padding: spacing.lg,
      maxHeight: '76%',
    },
    bidHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    bidTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    bidScroll: { flexGrow: 0, flexShrink: 1 },
    bidScrollContent: { paddingBottom: spacing.sm },
    timerBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      minWidth: 56,
      alignItems: 'center',
    },
    timerText: {
      color: colors.white,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    bidPlayerCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bidPlayerName: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    bidPlayerMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    offersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    offerBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    offerBoxRival: { borderColor: colors.dangerDark },
    offerClub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    offerAmount: { fontSize: fontSize.xl, fontWeight: fontWeight.black, fontFamily: fonts.display },
    offerVs: { color: colors.textFaint, fontSize: fontSize.md, fontWeight: fontWeight.black },
    urgencyBarBg: {
      height: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    urgencyBarFill: { height: '100%', borderRadius: radius.pill },
    urgencyHint: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    bidActions: { gap: spacing.sm, marginBottom: spacing.md },
    bidActionPrimary: {
      height: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    bidActionDisabled: { opacity: 0.45 },
    bidActionPrimaryText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    bidActionSecondary: {
      height: 48,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    bidActionSecondaryText: {
      color: colors.primaryLight,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    bidFooter: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.md,
    },
  });
