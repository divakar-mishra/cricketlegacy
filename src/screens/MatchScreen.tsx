import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  unstable_batchedUpdates,
  View,
} from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOut,
  SlideInDown,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText as Text } from '../components/AppText';
import {
  AchievementToast,
  Button,
  Card,
  CelebrationKind,
  CelebrationOverlay,
  CommentaryArchive,
  CommentaryEntry,
  CommentaryTone,
  CountUp,
  FieldView,
  FirstMatchGuide,
  GlassSurface,
  Icon,
  LastShot,
  LiveTacticPanel,
  ManhattanChart,
  Screen,
  ScreenHeader,
  SponsorBrandRow,
  WagonWheel,
} from '../components';
import { getAchievement } from '../game/achievements';
import { moment, music } from '../audio';
import { ads } from '../services';
import { FORMATS } from '../data/gameConfig';
import {
  BallEvent,
  BatterCard,
  BowlerCard,
  Conditions,
  Dismissal,
  Format,
  Innings,
  Tactics,
} from '../domain/types';
import {
  BOWLER_PLAN_OPTIONS,
  BowlerPlan,
  FIELD_OPTIONS,
  FieldSetting,
  fieldRestriction,
  Intent,
  isFieldSettingLegal,
  TEAM_APPROACH_OPTIONS,
} from '../engine/intent';
import { LiveScore } from '../engine/liveInnings';
import { LiveMatch, MatchBallStep } from '../engine/liveMatch';
import { drsAvailableForMatch, isReviewableDismissal } from '../game/drs';
import { careerSkipAction, continueSkipAfterInningsBreak } from '../game/matchSkip';
import { deliveryDelayMs, MATCH_SPEED_OPTIONS, MatchSpeed } from '../game/matchTiming';
import { shotAngle, shotReach } from '../engine/shots';
import { matchObjective } from '../game/progression';
import { tacticalImpactSummary, tacticChangeImpact, tacticSelectionSummary } from '../game/tactics';
import { describeMatchup } from '../game/careerExperience';
import {
  MANAGER_EMERGENCY_TEAM_TALK_COINS,
  MANAGER_MATCH_ANALYSIS_COINS,
  managerResourceUsed,
} from '../game/managerResources';
import { buildOppositionReport } from '../game/oppositionAnalysis';
import { applyManagerPreparationToLiveMatch } from '../game/season';
import { activeSponsorBranding } from '../game/sponsorship';
import { TossCall, TossChoice } from '../engine/toss';
import { ScreenProps } from '../navigation';
import { PlayResult, useCareer } from '../state/careerStore';
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
import { HeroBackground, VictoryHero } from '../components/HeroBackground';
import { useSettings } from '../state/settingsStore';

type Phase = 'loading' | 'prematch' | 'live' | 'saving' | 'save-error' | 'done' | 'empty';
type Mode = 'WATCH' | 'KEY' | 'INSTANT';
type Tone = CommentaryTone;

/** Persistent batting stance — replaces the per-ball intent picker. */
const BATTING_STANCES = [
  { value: 'BLOCK' as Intent, label: 'Defend', desc: 'Protect your wicket', emoji: '🛡️' },
  { value: 'ROTATE' as Intent, label: 'Balanced', desc: 'Read the situation', emoji: '⚖️' },
  { value: 'ATTACK' as Intent, label: 'Attack', desc: 'Go after boundaries', emoji: '⚡' },
] as const;

interface Dot {
  id: number;
  sym: string;
  tone: Tone;
  legal: boolean;
}
type FeedItem = CommentaryEntry;
interface Crease {
  strikerId: string;
  strikerRuns: number;
  strikerBalls: number;
  nonStrikerId: string;
  nonStrikerRuns: number;
  nonStrikerBalls: number;
  bowlerId: string;
  bowlerRuns: number;
  bowlerWickets: number;
  bowlerBalls: number;
}
interface Banner {
  text: string;
  tone: 'gold' | 'danger' | 'accent';
}
interface Partnership {
  batter1Name: string;
  batter2Name: string;
  runs: number;
  balls: number;
}
interface Display {
  inningsIndex: number;
  battingTeamId: string;
  bowlingTeamId: string;
  score: LiveScore | null;
  crease: Crease | null;
  overNumber: number;
  overDots: Dot[];
  feed: FeedItem[];
  partnership: Partnership | null;
}
/** DRS state for the current innings. */
interface DRSState {
  reviewsLeft: number;
  lastReviewResult: 'UPHELD' | 'OVERTURNED' | null;
}
interface Setup {
  homeTeamId: string;
  awayTeamId: string;
  controlledTeamId?: string;
  venue: string;
  conditions: Conditions;
  format: Format;
  isTest: boolean;
  tossWinnerTeamId: string;
  tossCoinFace: TossCall;
  userCanCallToss: boolean;
  tossChoice: TossChoice;
  battingFirstTeamId: string;
  userMayChooseToss: boolean;
  tossReason: string;
}

const PITCH_LABEL: Record<string, string> = {
  GREEN: 'Green, seam-friendly',
  DRY: 'Dry, true surface',
  DUSTY: 'Dusty, turning',
  FLAT: 'Flat, a belter',
  CRACKED: 'Cracked, variable',
};
const WEATHER_LABEL: Record<string, string> = {
  CLEAR: 'Clear skies',
  OVERCAST: 'Overcast',
  HUMID: 'Humid',
};

function surfaceBriefing(conditions: Conditions, format: Format): string {
  const { pitch, weather } = conditions;
  if (pitch === 'GREEN' && weather === 'OVERCAST') {
    return 'Best seam early; favour patience and accurate pace.';
  }
  if (pitch === 'GREEN') {
    return 'Early pace and carry; batting eases later.';
  }
  if (pitch === 'DUSTY') {
    return format === 'TEST'
      ? 'Spin and uneven bounce increase; first-innings runs matter.'
      : 'Spin and slower balls should grip; rotate strike.';
  }
  if (pitch === 'CRACKED') {
    return 'Variable bounce; favour compact batting and disciplined lengths.';
  }
  if (pitch === 'FLAT') {
    return 'High-scoring surface; protect boundaries and vary pace.';
  }
  return weather === 'HUMID'
    ? 'Balanced pitch; early movement in the humidity.'
    : 'True surface; execution should decide it.';
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const oversFromBalls = (balls: number): string => `${Math.floor(balls / 6)}.${balls % 6}`;

/** Heuristic: infer dismissal type from commentary text for DRS probability. */
function inferDismissalFromFeed(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('lbw')) return 'LBW';
  if (lower.includes('caught') || lower.includes('edged') || lower.includes('nick'))
    return 'CAUGHT';
  if (lower.includes('run out') || lower.includes('run-out')) return 'RUN_OUT';
  if (lower.includes('stumped')) return 'STUMPED';
  if (lower.includes('bowled') || lower.includes('stump') || lower.includes('timber'))
    return 'BOWLED';
  return 'LBW'; // default: treat as marginal
}

function toneFor(ev: BallEvent): Tone {
  if (ev.isWicket) return 'wicket';
  if (ev.outcome === '6') return 'six';
  if (ev.outcome === '4') return 'four';
  if (ev.outcome === 'WD' || ev.outcome === 'NB') return 'extra';
  return 'normal';
}

function symbolFor(ev: BallEvent): string {
  if (ev.isWicket) return 'W';
  switch (ev.outcome) {
    case '4':
      return '4';
    case '6':
      return '6';
    case 'WD':
      return 'wd';
    case 'NB':
      return 'nb';
    case 'BYE':
      return 'b';
    case 'LB':
      return 'lb';
    case 'DOT':
      return '•';
    default:
      return String(ev.runs);
  }
}

function dismissalTypeText(d?: Dismissal): string {
  if (!d) return '';
  return d.type.replace(/_/g, ' ').toLowerCase();
}

function toneColors(colors: ThemeColors): Record<Tone, string> {
  return {
    normal: colors.textMuted,
    four: colors.primaryLight,
    six: colors.accent,
    wicket: colors.danger,
    extra: colors.info,
  };
}

function isKeyMoment(lm: LiveMatch): boolean {
  const fmt = FORMATS[lm.format];
  const total = fmt.overs * fmt.ballsPerOver;
  const s = lm.scoreState;
  const peek = lm.peek();
  const deathPhase = s.legalBalls / total >= 0.8;
  const tightChase =
    s.ballsRemaining != null &&
    s.ballsRemaining <= 18 &&
    s.requiredRunRate != null &&
    s.requiredRunRate >= 8;
  const nearMilestone =
    (peek.strikerRuns >= 45 && peek.strikerRuns < 50) ||
    (peek.strikerRuns >= 95 && peek.strikerRuns < 100);
  const collapse = s.wickets >= 7;
  return deathPhase || tightChase || nearMilestone || collapse;
}

function topBatters(inn: Innings): BatterCard[] {
  return inn.batting
    .filter((b) => b.balls > 0 || b.out)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5);
}
function topBowlers(inn: Innings): BowlerCard[] {
  return inn.bowling
    .filter((b) => b.balls > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, 4);
}

function manhattanData(inn: Innings): { over: number; runs: number; wickets: number }[] {
  const overs = new Map<number, { runs: number; wickets: number }>();
  for (const ev of inn.events) {
    const cur = overs.get(ev.over) ?? { runs: 0, wickets: 0 };
    cur.runs += ev.runs;
    if (ev.isWicket) cur.wickets += 1;
    overs.set(ev.over, cur);
  }
  return [...overs.keys()]
    .sort((a, b) => a - b)
    .map((o) => ({ over: o + 1, runs: overs.get(o)!.runs, wickets: overs.get(o)!.wickets }));
}

const SCORING = new Set<BallEvent['outcome']>(['1', '2', '3', '4', '6']);
function userShots(
  match: { innings: Innings[] },
  userId: string,
): { angleDeg: number; runs: number }[] {
  const shots: { angleDeg: number; runs: number }[] = [];
  for (const inn of match.innings) {
    for (const ev of inn.events) {
      if (ev.strikerId === userId && SCORING.has(ev.outcome) && ev.runs > 0) {
        shots.push({ angleDeg: shotAngle(ev), runs: ev.runs });
      }
    }
  }
  return shots;
}

function dismissalText(card: BatterCard, nameOf: (id: string) => string): string {
  if (!card.out) return card.balls > 0 ? 'not out' : 'did not bat';
  const dismissal = card.dismissal;
  if (!dismissal) return 'out';
  const bowler = dismissal.bowlerId ? nameOf(dismissal.bowlerId) : '';
  const fielder = dismissal.fielderId ? nameOf(dismissal.fielderId) : '';
  if (dismissal.type === 'CAUGHT') return `c ${fielder || 'fielder'} b ${bowler || 'bowler'}`;
  if (dismissal.type === 'BOWLED') return `b ${bowler || 'bowler'}`;
  if (dismissal.type === 'LBW') return `lbw b ${bowler || 'bowler'}`;
  if (dismissal.type === 'RUN_OUT') return `run out${fielder ? ` (${fielder})` : ''}`;
  if (dismissal.type === 'STUMPED') {
    return `st ${fielder || 'keeper'} b ${bowler || 'bowler'}`;
  }
  return `hit wicket${bowler ? ` b ${bowler}` : ''}`;
}

function inningsExtras(innings: Innings): number {
  return innings.events.reduce(
    (sum, event) =>
      ['WD', 'NB', 'BYE', 'LB'].includes(event.outcome) ? sum + Math.max(0, event.runs) : sum,
    0,
  );
}

function FullInningsScorecard({
  innings,
  format,
  teamName,
  nameOf,
}: {
  innings: Innings;
  format: Format;
  teamName: (id: string) => string;
  nameOf: (id: string) => string;
}) {
  const styles = useThemedStyles(makeStyles);
  const ballsPerOver = FORMATS[format].ballsPerOver;
  const oversText = (balls: number) =>
    `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`;
  return (
    <Card style={styles.fullScorecardCard}>
      <View style={styles.innHeader}>
        <Text style={styles.innTeam} numberOfLines={1}>
          {teamName(innings.battingTeamId)}
        </Text>
        <Text style={styles.innScore}>
          {innings.runs}/{innings.wickets}{' '}
          <Text style={styles.innOvers}>({innings.overs.toFixed(1)})</Text>
        </Text>
      </View>

      <View style={styles.scorecardHeaderRow}>
        <Text style={styles.scorecardHeaderName}>Batting</Text>
        {['R', 'B', '4s', '6s', 'SR'].map((label) => (
          <Text key={label} style={styles.scorecardHeaderStat}>
            {label}
          </Text>
        ))}
      </View>
      {[...innings.batting]
        .sort((left, right) => left.battedOrder - right.battedOrder)
        .map((batter) => {
          const strikeRate =
            batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '—';
          return (
            <View key={batter.playerId} style={styles.scorecardPlayerBlock}>
              <View style={styles.scorecardDataRow}>
                <Text style={styles.scorecardPlayerName} numberOfLines={1}>
                  {nameOf(batter.playerId)}
                </Text>
                {[batter.runs, batter.balls, batter.fours, batter.sixes, strikeRate].map(
                  (value, index) => (
                    <Text key={index} style={styles.scorecardStat}>
                      {value}
                    </Text>
                  ),
                )}
              </View>
              <Text style={styles.scorecardDismissal} numberOfLines={1}>
                {dismissalText(batter, nameOf)}
              </Text>
            </View>
          );
        })}
      <View style={styles.scorecardTotalRow}>
        <Text style={styles.scorecardTotalLabel}>Extras</Text>
        <Text style={styles.scorecardTotalValue}>{inningsExtras(innings)}</Text>
      </View>
      <View style={styles.scorecardTotalRow}>
        <Text style={styles.scorecardTotalLabel}>Total</Text>
        <Text style={styles.scorecardTotalValue}>
          {innings.runs}/{innings.wickets}
        </Text>
      </View>

      <View style={[styles.scorecardHeaderRow, styles.scorecardBowlingHeader]}>
        <Text style={styles.scorecardHeaderName}>Bowling</Text>
        {['O', 'M', 'R', 'W', 'Econ'].map((label) => (
          <Text key={label} style={styles.scorecardHeaderStat}>
            {label}
          </Text>
        ))}
      </View>
      {innings.bowling
        .filter((bowler) => bowler.balls > 0)
        .map((bowler) => {
          const overs = bowler.balls / ballsPerOver;
          const economy = overs > 0 ? (bowler.runs / overs).toFixed(1) : '—';
          return (
            <View key={bowler.playerId} style={styles.scorecardDataRow}>
              <Text style={styles.scorecardPlayerName} numberOfLines={1}>
                {nameOf(bowler.playerId)}
              </Text>
              {[oversText(bowler.balls), bowler.maidens, bowler.runs, bowler.wickets, economy].map(
                (value, index) => (
                  <Text key={index} style={styles.scorecardStat}>
                    {value}
                  </Text>
                ),
              )}
            </View>
          );
        })}
    </Card>
  );
}

export function MatchScreen({ navigation, route }: ScreenProps<'Match'>) {
  const intl = route.params?.intl ?? false;
  const daily = route.params?.daily ?? false;
  const save = useCareer((s) => s.save);
  const mode = useCareer((s) => s.ref?.mode);
  const beginLiveMatch = useCareer((s) => s.beginLiveMatch);
  const commitLiveMatch = useCareer((s) => s.commitLiveMatch);
  const beginInternational = useCareer((s) => s.beginInternational);
  const commitInternational = useCareer((s) => s.commitInternational);
  const beginDailyChallengeMatch = useCareer((s) => s.beginDailyChallengeMatch);
  const commitDailyChallengeMatch = useCareer((s) => s.commitDailyChallengeMatch);
  const persistCritical = useCareer((s) => s.persistCritical);
  const grantAdReward = useCareer((s) => s.grantAdReward);
  const setSaveTactics = useCareer((s) => s.setTactics);
  const runManagerResource = useCareer((s) => s.useManagerResource);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const TONE_COLOR = toneColors(colors);
  const sponsorBranding = save
    ? activeSponsorBranding(save)
    : { earned: undefined, premium: undefined };

  const [phase, setPhase] = useState<Phase>('loading');
  const [adBusy, setAdBusy] = useState(false);
  const [adClaimed, setAdClaimed] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);
  const adRewardPendingRef = useRef(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  // Wicket cinematic — screen flash + shake
  const wicketFlashOpacity = useSharedValue(0);
  const wicketShakeX = useSharedValue(0);
  const wicketFlashStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E5484D',
    opacity: wicketFlashOpacity.value,
    zIndex: 98,
  }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: wicketShakeX.value }] }));
  // Persistent batting stance (replaces per-ball intent picker).
  const [battingStance, setBattingStance] = useState<Intent>('ROTATE');
  const [showStancePicker, setShowStancePicker] = useState(false);
  const stanceRef = useRef<Intent>('ROTATE');
  const stanceEvidenceRef = useRef<
    Record<Intent, { runs: number; balls: number; wickets: number }>
  >({
    BLOCK: { runs: 0, balls: 0, wickets: 0 },
    ROTATE: { runs: 0, balls: 0, wickets: 0 },
    ATTACK: { runs: 0, balls: 0, wickets: 0 },
    BIG: { runs: 0, balls: 0, wickets: 0 },
  });
  const activeBowlingPlanRef = useRef<BowlerPlan>('CONTAIN');
  const bowlingEvidenceRef = useRef<
    Record<BowlerPlan, { runs: number; balls: number; wickets: number; selections: number }>
  >({
    ATTACK: { runs: 0, balls: 0, wickets: 0, selections: 0 },
    CONTAIN: { runs: 0, balls: 0, wickets: 0, selections: 0 },
    VARY: { runs: 0, balls: 0, wickets: 0, selections: 0 },
  });
  const stancePauseRef = useRef(false);
  // Skip-to-bat: fast-forward until user player arrives at the crease.
  const skipToBatRef = useRef(false);
  const skipRestOfInningsRef = useRef(false);
  const [skipBusyLabel, setSkipBusyLabel] = useState<string | null>(null);
  const skipBusyRef = useRef(false);
  const userDismissedRef = useRef(false);
  const [userDismissed, setUserDismissed] = useState(false);
  const [awaitingPlan, setAwaitingPlan] = useState(false);
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const tacticsPauseRef = useRef(false);
  const [managerTactics, setManagerTactics] = useState<Tactics>(
    save?.tactics ?? { batting: 'BALANCED', bowling: 'CONTAIN', field: 'BALANCED' },
  );
  const [managerPreparationConfirmed, setManagerPreparationConfirmed] = useState(false);
  const [managerPreparationOpen, setManagerPreparationOpen] = useState(false);
  const [managerAnalysisFlash, setManagerAnalysisFlash] = useState<string | null>(null);
  const [speedMult, setSpeedMult] = useState<MatchSpeed>(1);
  const [commentaryOpen, setCommentaryOpen] = useState(false);
  const [fullScorecardOpen, setFullScorecardOpen] = useState(false);
  const commentaryPauseRef = useRef(false);
  const [manualPaused, setManualPaused] = useState(false);
  const manualPauseRef = useRef(false);
  // The live-match loop runs as a long-lived async closure, so it must read the
  // current speed from a ref — otherwise button/auto-slow changes never reach it.
  const speedMultRef = useRef<MatchSpeed>(1);
  const fastRenderCountRef = useRef(0);
  const renderCurrentStepRef = useRef(true);
  const changeSpeed = useCallback((next: MatchSpeed) => {
    speedMultRef.current = next;
    setSpeedMult(next);
  }, []);
  // Auto-slow the final over so the climax is readable (roadmap §2 last-over tension).
  const autoSlowedRef = useRef(false);
  const [overSummary, setOverSummary] = useState<{
    over: number;
    runs: number;
    wickets: number;
    economy: number;
  } | null>(null);
  const [achToastIdx, setAchToastIdx] = useState(0);
  const pendingAchievementIds = useCareer((s) => s.pendingAchievementIds);
  const clearPendingAchievements = useCareer((s) => s.clearPendingAchievements);
  const currentAchToastId = pendingAchievementIds[achToastIdx] ?? null;
  const currentAchToast = currentAchToastId ? (getAchievement(currentAchToastId) ?? null) : null;
  const overSummaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [matchRole, setMatchRole] = useState<'BATTING' | 'BOWLING' | 'NONE'>('NONE');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [selectedTossCall, setSelectedTossCall] = useState<TossCall | null>(null);
  const [tossRevealed, setTossRevealed] = useState(false);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const coinFlipRotation = useSharedValue(0);
  const tossRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coinFlipStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${coinFlipRotation.value}deg` }],
  }));
  const [result, setResult] = useState<PlayResult | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [lastShot, setLastShot] = useState<LastShot | null>(null);
  const [celebration, setCelebration] = useState<{ trigger: number; kind: CelebrationKind }>({
    trigger: 0,
    kind: null,
  });
  const [drs, setDrs] = useState<DRSState>({ reviewsLeft: 2, lastReviewResult: null });
  const [showDRSResult, setShowDRSResult] = useState(false);
  const [reviewableWicket, setReviewableWicket] = useState<{ feedId: number } | null>(null);
  // The live loop pauses on a reviewable user dismissal until the player decides.
  const [awaitingReview, setAwaitingReview] = useState(false);
  const pendingReviewRef = useRef(false);
  const reviewResolver = useRef<(() => void) | null>(null);
  // Which viewing mode the live loop is running in (KEY = non-interactive highlights).
  const [driveMode, setDriveMode] = useState<Mode | null>(null);

  // FTUE coach tips
  const playedMatchesAllModes = useSettings((s) => s.playedMatchesAllModes);
  // First-match-only guided prompts (career mode, before any match ever played).
  const [firstGuideDone, setFirstGuideDone] = useState(false);
  const firstGuideDoneRef = useRef(false);
  const guidePauseRef = useRef(false);
  // Increments each over so the LiveTacticPanel pulses when the AI re-plans.
  const [tacticPulse, setTacticPulse] = useState(0);
  const [partnershipRuns, setPartnershipRuns] = useState(0);
  const [partnershipBalls, setPartnershipBalls] = useState(0);
  const partnershipRunsRef = useRef(0);
  const partnershipBallsRef = useRef(0);
  const drsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [display, setDisplay] = useState<Display>({
    inningsIndex: 0,
    battingTeamId: '',
    bowlingTeamId: '',
    score: null,
    crease: null,
    overNumber: -1,
    overDots: [],
    feed: [],
    partnership: null,
  });
  const commentaryArchiveRef = useRef<FeedItem[]>([]);
  const [commentaryEntries, setCommentaryEntries] = useState<FeedItem[]>([]);

  const lmRef = useRef<LiveMatch | null>(null);
  const planResolver = useRef<((p: BowlerPlan) => void) | null>(null);
  const cancelled = useRef(false);
  const appPausedRef = useRef(AppState.currentState !== 'active');
  const instant = useRef(false);
  const liveOverRef = useRef<{ overNumber: number; dots: Dot[] }>({
    overNumber: -1,
    dots: [],
  });
  const feedId = useRef(0);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveDialogOpen = useRef(false);
  const finalizedFixtureRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      music.setMusicScene('MENU');
    },
    [],
  );

  useEffect(() => {
    if (phase === 'prematch' || phase === 'live') music.setMusicScene('MATCH_CALM');
    else if (phase === 'done') music.setMusicScene(result?.userWon ? 'VICTORY' : 'DEFEAT');
  }, [phase, result?.userWon]);

  // Grade A/U19 careers control the pathway XI rather than save.userTeamId
  // (their future senior club). Manager phases can also control another team.
  // The live match is therefore the canonical team for role and skip logic.
  const userTeamId = setup?.controlledTeamId ?? lmRef.current?.controlledTeamId ?? save?.userTeamId;
  const userPlayerId = save?.userPlayerId;
  const nameOf = useCallback((id: string) => save?.players[id]?.name ?? '—', [save]);
  const teamName = useCallback((id: string) => save?.teams[id]?.name ?? 'Opposition', [save]);
  const teamShort = useCallback(
    (id: string) => save?.teams[id]?.shortName ?? save?.teams[id]?.name ?? 'OPP',
    [save],
  );
  const settlementPending = phase === 'saving' || phase === 'save-error';
  const activeMatch = phase === 'prematch' || phase === 'live' || settlementPending;
  const leaveMatch = useCallback(() => {
    leaveDialogOpen.current = false;
    navigation.goBack();
  }, [navigation]);
  const guardedGoBack = useCallback(() => {
    if (settlementPending) {
      Alert.alert(
        'Result not saved yet',
        phase === 'saving'
          ? 'The match result is being saved. Please wait.'
          : 'Retry the save before leaving so this fixture cannot reopen.',
      );
      return;
    }
    if (!activeMatch) {
      navigation.goBack();
      return;
    }
    if (leaveDialogOpen.current) return;
    leaveDialogOpen.current = true;
    const wasPaused = manualPauseRef.current;
    manualPauseRef.current = true;
    setManualPaused(true);
    const resumeAfterDialog = () => {
      leaveDialogOpen.current = false;
      if (!wasPaused) {
        manualPauseRef.current = false;
        setManualPaused(false);
      }
    };
    Alert.alert(
      'Leave match?',
      'Leaving restarts or forfeits this match.',
      [
        {
          text: 'Stay in match',
          style: 'cancel',
          onPress: resumeAfterDialog,
        },
        {
          text: 'Leave match',
          style: 'destructive',
          onPress: leaveMatch,
        },
      ],
      {
        cancelable: true,
        onDismiss: resumeAfterDialog,
      },
    );
  }, [activeMatch, leaveMatch, navigation, phase, settlementPending]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || !activeMatch) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        guardedGoBack();
        return true;
      });
      return () => sub.remove();
    }, [activeMatch, guardedGoBack]),
  );
  useEffect(() => {
    appPausedRef.current = AppState.currentState !== 'active';
    const sub = AppState.addEventListener('change', (nextState) => {
      appPausedRef.current = nextState !== 'active';
    });
    return () => sub.remove();
  }, []);
  // DRS is a domestic/international feature only — Grade A/U19 cricket has no reviews.
  const drsEligible = drsAvailableForMatch({
    mode: mode === 'career' ? 'career' : mode === 'manager' ? 'manager' : undefined,
    careerPathLevel: save?.careerPathLevel,
    intl,
  });

  const flashBanner = useCallback((b: Banner) => {
    setBanner(b);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1600);
  }, []);

  const updateCrease = useCallback((lm: LiveMatch) => {
    if (lm.matchDone) return;
    setMatchRole(lm.userRole);
    const p = lm.peek();
    setDisplay((prev) => ({
      ...prev,
      inningsIndex: lm.inningsIndex,
      battingTeamId: lm.battingTeamId,
      bowlingTeamId: lm.bowlingTeamId,
      score: lm.scoreState,
      crease: {
        strikerId: p.strikerId,
        strikerRuns: p.strikerRuns,
        strikerBalls: p.strikerBalls,
        nonStrikerId: p.nonStrikerId,
        nonStrikerRuns: p.nonStrikerRuns,
        nonStrikerBalls: p.nonStrikerBalls,
        bowlerId: p.bowlerId,
        bowlerRuns: p.bowlerRuns,
        bowlerWickets: p.bowlerWickets,
        bowlerBalls: p.bowlerBalls,
      },
    }));
  }, []);

  const openStancePicker = useCallback(() => {
    stancePauseRef.current = true;
    setShowStancePicker(true);
  }, []);

  const closeStancePicker = useCallback(() => {
    stancePauseRef.current = false;
    setShowStancePicker(false);
  }, []);

  const toggleStancePicker = useCallback(() => {
    setShowStancePicker((open) => {
      const next = !open;
      stancePauseRef.current = next;
      return next;
    });
  }, []);

  const waitForStanceChoice = useCallback(async () => {
    while (stancePauseRef.current && !cancelled.current) {
      await sleep(120);
    }
  }, []);

  const waitForTacticsClose = useCallback(async () => {
    while (tacticsPauseRef.current && !cancelled.current) {
      await sleep(120);
    }
  }, []);

  const waitForCommentaryClose = useCallback(async () => {
    while (commentaryPauseRef.current && !cancelled.current) {
      await sleep(120);
    }
  }, []);

  const waitForManualResume = useCallback(async () => {
    while (manualPauseRef.current && !cancelled.current) {
      await sleep(120);
    }
  }, []);

  const waitForGuideClose = useCallback(async () => {
    while (guidePauseRef.current && !cancelled.current) {
      await sleep(120);
    }
  }, []);

  const toggleManualPause = useCallback(() => {
    manualPauseRef.current = !manualPauseRef.current;
    setManualPaused(manualPauseRef.current);
  }, []);

  const openCommentary = useCallback(() => {
    commentaryPauseRef.current = true;
    setCommentaryEntries([...commentaryArchiveRef.current].reverse());
    setCommentaryOpen(true);
  }, []);

  const closeCommentary = useCallback(() => {
    commentaryPauseRef.current = false;
    setCommentaryOpen(false);
  }, []);

  const waitForAppActive = useCallback(async () => {
    while (appPausedRef.current && !cancelled.current) {
      await sleep(120);
    }
  }, []);

  const onDRSReview = useCallback(() => {
    if (drs.reviewsLeft <= 0 || !reviewableWicket) return;
    // DRS outcome is deterministic: based on last dismissal type and the
    // match's current seed + ball count (not Math.random — fully reproducible).
    const lm = lmRef.current;
    const archive = commentaryArchiveRef.current;
    let lastWicketFeed: FeedItem | undefined;
    for (let index = archive.length - 1; index >= 0; index -= 1) {
      if (archive[index].tone === 'wicket') {
        lastWicketFeed = archive[index];
        break;
      }
    }
    // Infer dismissal type from the feed label (over.ball prefix like "5.3").
    const dismissalType = lastWicketFeed ? inferDismissalFromFeed(lastWicketFeed.text) : undefined;
    // Probability of overturning by dismissal type (grounded in real DRS stats):
    //   LBW: ~35% overturned (marginal calls)
    //   CAUGHT: ~20% (edge/bump-ball)
    //   BOWLED/HIT_WICKET/STUMPED: very rare (<5%) — clear decisions
    //   RUN_OUT: ~25%
    const overturnChances: Record<string, number> = {
      LBW: 0.35,
      CAUGHT: 0.2,
      RUN_OUT: 0.25,
      BOWLED: 0.04,
      HIT_WICKET: 0.02,
      STUMPED: 0.08,
    };
    const pOverturn = dismissalType ? (overturnChances[dismissalType] ?? 0.15) : 0.15;
    // Deterministic hash from (seed + feedCount + reviewsUsed) to get a stable outcome
    const seed = lm ? ((lm as any).seed ?? Date.now()) : Date.now();
    const feedCount = archive.length;
    const reviewsUsed = 2 - drs.reviewsLeft;
    const deterministicVal =
      ((seed * 1103515245 + feedCount * 12345 + reviewsUsed * 6789) & 0x7fffffff) / 0x7fffffff;
    const overturned = deterministicVal < pOverturn;
    const reviewResult = overturned ? 'OVERTURNED' : 'UPHELD';
    if (overturned) {
      // Actually reverse the dismissal in the engine so the batter resumes.
      const reversed = lm?.overturnLastWicket() ?? false;
      if (reversed) {
        userDismissedRef.current = false;
        setUserDismissed(false);
        if (lm) updateCrease(lm);
      }
    }
    setDrs((prev) => ({
      reviewsLeft: overturned ? prev.reviewsLeft : prev.reviewsLeft - 1,
      lastReviewResult: reviewResult,
    }));
    setShowDRSResult(true);
    setReviewableWicket(null);
    if (drsTimer.current) clearTimeout(drsTimer.current);
    drsTimer.current = setTimeout(async () => {
      await waitForAppActive();
      if (cancelled.current) return;
      setShowDRSResult(false);
      // Resume the paused match loop now the verdict has been shown.
      reviewResolver.current?.();
      reviewResolver.current = null;
    }, 2500);
  }, [drs.reviewsLeft, reviewableWicket, updateCrease, waitForAppActive]);

  /** Accept the on-field decision without reviewing — resume play immediately. */
  const onAcceptDecision = useCallback(() => {
    setReviewableWicket(null);
    reviewResolver.current?.();
    reviewResolver.current = null;
  }, []);

  const fireCelebration = useCallback((kind: CelebrationKind) => {
    setCelebration((prev) => ({ trigger: prev.trigger + 1, kind }));
  }, []);

  const applyStep = useCallback(
    (step: MatchBallStep) => {
      const ev = step.event;
      const tone = toneFor(ev);
      const stepId = (feedId.current += 1);
      fastRenderCountRef.current += 1;
      const speed = speedMultRef.current;
      const mustRender =
        speed === 1 ||
        step.overComplete ||
        step.inningsBreak ||
        step.matchComplete ||
        step.event.isWicket ||
        Boolean(step.milestone) ||
        step.event.outcome === '4' ||
        step.event.outcome === '6';
      renderCurrentStepRef.current =
        mustRender || fastRenderCountRef.current % Math.max(1, speed) === 0;

      // Track partnership runs/balls — reset on wicket
      if (ev.isWicket) {
        partnershipRunsRef.current = 0;
        partnershipBallsRef.current = 0;
      } else if (ev.outcome !== 'WD') {
        partnershipRunsRef.current += ev.runs;
        partnershipBallsRef.current += 1;
      }
      const pRuns = partnershipRunsRef.current;
      const pBalls = partnershipBallsRef.current;
      if (speedMultRef.current === 1 || step.overComplete) {
        setPartnershipRuns(pRuns);
        setPartnershipBalls(pBalls);
      }

      const item: FeedItem = {
        id: stepId,
        inningsIndex: lmRef.current?.inningsIndex ?? 0,
        over: ev.over,
        ballInOver: ev.ballInOver,
        label: step.score.oversText,
        text: ev.commentary,
        tone,
        outcome: ev.outcome,
        strikerName: nameOf(ev.strikerId),
        bowlerName: nameOf(ev.bowlerId),
      };
      commentaryArchiveRef.current.push(item);
      if (commentaryArchiveRef.current.length > 2400) {
        commentaryArchiveRef.current.splice(0, commentaryArchiveRef.current.length - 2400);
      }

      // The tracker follows the event's actual over instead of clearing one
      // render late. Keeping it in a ref also means 2x/4x batching cannot drop
      // quiet deliveries from the visible over.
      const previousOver = liveOverRef.current;
      const dots = previousOver.overNumber === ev.over ? previousOver.dots : [];
      const overSnapshot = {
        overNumber: ev.over,
        dots: [
          ...dots,
          {
            id: stepId,
            sym: symbolFor(ev),
            tone,
            legal: ev.outcome !== 'WD' && ev.outcome !== 'NB',
          },
        ],
      };
      liveOverRef.current = overSnapshot;

      if (renderCurrentStepRef.current) {
        setDisplay((prev) => ({
          ...prev,
          overNumber: overSnapshot.overNumber,
          overDots: [...overSnapshot.dots],
          feed: [item, ...prev.feed].slice(0, 12),
        }));
      }
      if (step.inningsBreak || step.matchComplete) {
        liveOverRef.current = { overNumber: -1, dots: [] };
      }

      if (mode === 'career' && userPlayerId && step.wicketOf === userPlayerId) {
        userDismissedRef.current = true;
        setUserDismissed(true);
        // Only a dismissal that did NOT end the innings/match can be rewound by
        // an overturn (the engine has already advanced past a completed innings).
        const reviewable =
          drsEligible &&
          !step.inningsBreak &&
          !step.matchComplete &&
          isReviewableDismissal(ev.dismissal?.type);
        setReviewableWicket(reviewable ? { feedId: stepId } : null);
        // Arm the loop to pause for the review decision.
        if (reviewable) pendingReviewRef.current = true;
      } else if (!ev.isWicket) {
        setReviewableWicket(null);
      }

      // Keep the 2D field alive at every speed. Fast modes update only on their
      // batched render step, so they remain readable without flooding the UI.
      if (renderCurrentStepRef.current && ev.outcome !== 'WD' && ev.outcome !== 'NB') {
        setLastShot({
          key: stepId,
          angleDeg: shotAngle(ev),
          reach: shotReach(ev.runs, ev.outcome === '6'),
          tone,
          runs: ev.runs,
          delivery: ev.delivery,
          shot: ev.shot,
          dismissalType: ev.dismissal?.type,
        });
      }
      // Sound + haptic + celebration juice (milestone takes priority).
      const showCinematic = speedMultRef.current === 1;
      if (step.milestone) {
        moment(step.milestone.kind === 'HUNDRED' ? 'hundred' : 'fifty');
        if (showCinematic) {
          fireCelebration(step.milestone.kind === 'HUNDRED' ? 'hundred' : 'fifty');
        }
        flashBanner({
          text: `${step.milestone.kind === 'HUNDRED' ? 'HUNDRED! 💯' : 'FIFTY! 🎉'} ${nameOf(step.milestone.playerId)}`,
          tone: 'gold',
        });
      } else if (ev.isWicket) {
        moment('wicket');
        if (showCinematic) {
          fireCelebration('wicket');
          // Wicket cinematic: screen flash + camera shake
          wicketFlashOpacity.value = withSequence(
            withTiming(0.35, { duration: 60 }),
            withTiming(0.18, { duration: 80 }),
            withTiming(0, { duration: 300 }),
          );
          wicketShakeX.value = withSequence(
            withTiming(-8, { duration: 50 }),
            withTiming(8, { duration: 50 }),
            withTiming(-5, { duration: 50 }),
            withTiming(5, { duration: 50 }),
            withTiming(0, { duration: 80 }),
          );
        }
      } else if (ev.outcome === '6') {
        if (showCinematic) {
          moment('six');
          fireCelebration('six');
        }
        if (showCinematic && ev.strikerId === userPlayerId) {
          flashBanner({ text: `SIX! ${nameOf(ev.strikerId)} launches it! 🚀`, tone: 'gold' });
        }
      } else if (ev.outcome === '4') {
        if (showCinematic) {
          moment('four');
          fireCelebration('four');
        }
        if (showCinematic && ev.strikerId === userPlayerId) {
          flashBanner({ text: `FOUR! ${nameOf(ev.strikerId)} finds the gap 🏏`, tone: 'accent' });
        }
      }

      if (!step.milestone && step.wicketOf) {
        flashBanner({
          text: `WICKET! ${nameOf(step.wicketOf)} ${dismissalTypeText(ev.dismissal)}`,
          tone: 'danger',
        });
      } else if (step.inningsBreak) {
        userDismissedRef.current = false;
        setUserDismissed(false);
        setReviewableWicket(null);
        stancePauseRef.current = false;
        setShowStancePicker(false);
        moment('crowd');
        if (showCinematic) fireCelebration('innings');
        const isTest = lmRef.current?.format === 'TEST';
        flashBanner({
          text: isTest ? 'Innings break' : `Innings break — Target ${step.score.runs + 1}`,
          tone: 'accent',
        });
      }
    },
    [
      drsEligible,
      fireCelebration,
      flashBanner,
      mode,
      nameOf,
      userPlayerId,
      wicketFlashOpacity,
      wicketShakeX,
    ],
  );

  const finish = useCallback(
    async (lm: LiveMatch) => {
      if (finalizedFixtureRef.current === lm.id) return;
      finalizedFixtureRef.current = lm.id;
      const match = lm.finalizeMatch();
      const attack = stanceEvidenceRef.current.ATTACK;
      const big = stanceEvidenceRef.current.BIG;
      const attackingRuns = attack.runs + big.runs;
      const attackingBalls = attack.balls + big.balls;
      const attackingWickets = attack.wickets + big.wickets;
      if (attackingBalls > 0) {
        const estimatedLift = Math.max(0, Math.round(attack.runs * 0.1 + big.runs * 0.18));
        match.decisionImpacts ??= [];
        match.decisionImpacts.push({
          id: 'interactive-batting-intent',
          decision: 'Attacking batting intent',
          outcome: `Estimated +${estimatedLift} expected runs; ${attackingWickets} dismissal${attackingWickets === 1 ? '' : 's'} occurred across ${attackingBalls} attacking balls.`,
          evidence: `${attackingRuns} actual runs were scored with Attack or Go Big selected. The run lift is estimated against neutral intent.`,
          confidence: 'ESTIMATED',
          tone: attackingWickets > 1 ? 'MIXED' : 'POSITIVE',
        });
      }
      for (const plan of ['ATTACK', 'CONTAIN', 'VARY'] as const) {
        const evidence = bowlingEvidenceRef.current[plan];
        if (evidence.balls === 0) continue;
        match.decisionImpacts ??= [];
        match.decisionImpacts.push({
          id: `interactive-bowling-${plan.toLowerCase()}`,
          decision: `${plan === 'VARY' ? 'Variation' : plan === 'ATTACK' ? 'Attack' : 'Contain'} bowling plan`,
          outcome: `${evidence.wickets} wickets and ${evidence.runs} runs from ${evidence.balls} balls.`,
          evidence: `Observed after this plan was selected for ${evidence.selections} over${evidence.selections === 1 ? '' : 's'}; it does not claim a counterfactual result.`,
          confidence: 'OBSERVED',
          tone:
            evidence.wickets > 0
              ? 'POSITIVE'
              : evidence.runs > evidence.balls * 1.5
                ? 'NEGATIVE'
                : 'NEUTRAL',
        });
      }
      const res = daily
        ? commitDailyChallengeMatch(match)
        : intl
          ? commitInternational(match)
          : commitLiveMatch(match);
      if (!res) {
        // A second completion callback or a repaired legacy ledger must never
        // reopen/reward the fixture. Return to the hub instead of presenting a
        // result that was not committed.
        setPhase('empty');
        return;
      }
      setResult(res);
      setSettlementError(null);
      setPhase('saving');
      if (res?.userWon) {
        moment('win');
        setCelebration((prev) => ({ trigger: prev.trigger + 1, kind: 'win' }));
      } else if (res) {
        moment('defeat');
      }
      try {
        // Do not expose Continue until the completed fixture and its result
        // ledger have reached the serialized save queue.
        await persistCritical(true);
        setPhase('done');
      } catch (error) {
        setSettlementError(
          error instanceof Error && error.message
            ? error.message
            : 'The device did not confirm the match-result save.',
        );
        setPhase('save-error');
      }
    },
    [commitInternational, commitLiveMatch, commitDailyChallengeMatch, intl, daily, persistCritical],
  );

  const waitForPlan = useCallback(
    () => new Promise<BowlerPlan>((resolve) => (planResolver.current = resolve)),
    [],
  );

  const drive = useCallback(
    async (chosen: Mode) => {
      const lm = lmRef.current;
      if (!lm) return;
      if (chosen === 'INSTANT') {
        while (!lm.matchDone) lm.nextBall();
        await finish(lm);
        return;
      }
      setPhase('live');
      setDriveMode(chosen);
      manualPauseRef.current = false;
      setManualPaused(false);
      skipToBatRef.current = false;
      skipRestOfInningsRef.current = false;
      skipBusyRef.current = false;
      setSkipBusyLabel(null);
      guidePauseRef.current = false;
      userDismissedRef.current = false;
      setUserDismissed(false);
      setReviewableWicket(null);
      updateCrease(lm);

      while (!lm.matchDone && !cancelled.current) {
        await waitForAppActive();
        if (cancelled.current) return;
        await waitForManualResume();
        if (cancelled.current) return;
        if (
          mode === 'career' &&
          playedMatchesAllModes === 0 &&
          !firstGuideDoneRef.current &&
          userPlayerId
        ) {
          const next = lm.peek();
          if (next.strikerId === userPlayerId || next.nonStrikerId === userPlayerId) {
            guidePauseRef.current = true;
            updateCrease(lm);
          }
        }
        await waitForGuideClose();
        if (cancelled.current) return;
        if (instant.current) {
          while (!lm.matchDone) lm.nextBall();
          break;
        }
        const userBatting = lm.battingTeamId === userTeamId;

        // Once per over when bowling, ask the user for a bowling plan — but only
        // in the fully-interactive WATCH mode. KEY (highlights) auto-plays.
        if (lm.needsBowlingPlan() && !skipToBatRef.current && chosen === 'WATCH') {
          updateCrease(lm);
          setAwaitingPlan(true);
          const plan = await waitForPlan();
          if (cancelled.current) return;
          setAwaitingPlan(false);
          activeBowlingPlanRef.current = plan;
          bowlingEvidenceRef.current[plan].selections += 1;
          lm.setBowlingPlan(plan);
        } else if (lm.needsBowlingPlan()) {
          // KEY highlights / skip-to-bat: auto-set a bowling plan silently.
          activeBowlingPlanRef.current = 'CONTAIN';
          bowlingEvidenceRef.current.CONTAIN.selections += 1;
          lm.setBowlingPlan('CONTAIN');
        }

        // ── Skip-to-bat: fast-forward balls without sleep until user arrives ──
        // No UI updates during the skip — one batched update at the end avoids
        // hundreds of intermediate renders flooding the JS thread.
        if (skipRestOfInningsRef.current) {
          const skipStep = lm.nextBall();
          if (skipStep.inningsBreak || skipStep.matchComplete || lm.matchDone) {
            skipRestOfInningsRef.current = false;
            unstable_batchedUpdates(() => {
              applyStep(skipStep);
              updateCrease(lm);
              skipBusyRef.current = false;
              setSkipBusyLabel(null);
            });
          }
          continue;
        }

        if (skipToBatRef.current) {
          const peek = lm.peek();
          const userAtCrease =
            !!userPlayerId &&
            (peek.strikerId === userPlayerId || peek.nonStrikerId === userPlayerId);
          if (!userAtCrease && !lm.matchDone) {
            const skipStep = lm.nextBall(); // advance silently — NO setState here
            if (skipStep.inningsBreak) {
              const userHasFutureInnings = continueSkipAfterInningsBreak(
                lm.isTest,
                lm.battingTeamId,
                userTeamId,
              );
              if (!userHasFutureInnings) {
                skipToBatRef.current = false;
                unstable_batchedUpdates(() => {
                  applyStep(skipStep);
                  updateCrease(lm);
                  skipBusyRef.current = false;
                  setSkipBusyLabel(null);
                });
              }
            }
            continue; // no sleep, no render — pure JS fast-forward
          }
          // User arrived — do one final batched UI update.
          skipToBatRef.current = false;
          unstable_batchedUpdates(() => {
            updateCrease(lm);
            skipBusyRef.current = false;
            setSkipBusyLabel(null);
          });
        }

        // ── Auto-resolve batting intent from persistent stance ──
        // No per-ball popup — the stance button lets the user change approach at any time.
        // KEY (highlights) mode is non-interactive, so it never pauses for stance.
        if (stancePauseRef.current && chosen === 'WATCH') {
          if (!lm.needsIntent()) {
            closeStancePicker();
          } else {
            await waitForStanceChoice();
            if (cancelled.current) return;
          }
        }
        if (tacticsPauseRef.current && chosen === 'WATCH') {
          await waitForTacticsClose();
          if (cancelled.current) return;
        }
        if (commentaryPauseRef.current) {
          await waitForCommentaryClose();
          if (cancelled.current) return;
        }
        const intent = lm.needsIntent() ? stanceRef.current : undefined;
        const step = lm.nextBall(intent);
        if (intent) {
          const evidence = stanceEvidenceRef.current[intent];
          evidence.runs += step.event.runs;
          evidence.balls += step.event.outcome === 'WD' || step.event.outcome === 'NB' ? 0 : 1;
          if (step.wicketOf === userPlayerId) evidence.wickets += 1;
        }
        if (!userBatting) {
          const evidence = bowlingEvidenceRef.current[activeBowlingPlanRef.current];
          evidence.runs += step.event.runs;
          evidence.balls += step.event.outcome === 'WD' || step.event.outcome === 'NB' ? 0 : 1;
          if (step.event.isWicket) evidence.wickets += 1;
        }

        // Batch all per-ball state updates into ONE React render cycle.
        // Without this, applyStep + updateCrease each cause a separate render.
        unstable_batchedUpdates(() => {
          applyStep(step);
          if (renderCurrentStepRef.current) updateCrease(lm);
        });

        // Last-over tension: auto-drop 4× to 2× once so the climax is readable.
        const ballsLeft = lm.scoreState.ballsRemaining;
        if (
          ballsLeft != null &&
          ballsLeft <= 6 &&
          ballsLeft > 0 &&
          speedMultRef.current === 4 &&
          !autoSlowedRef.current
        ) {
          autoSlowedRef.current = true;
          changeSpeed(2);
        }
        if (ballsLeft != null && ballsLeft <= 12 && ballsLeft > 0) {
          music.setMusicScene('MATCH_TENSE');
        }
        if (step.inningsBreak) music.setMusicScene('MATCH_CALM');

        // A "key moment" worth lingering on: a boundary, wicket, milestone,
        // innings break, or a genuinely tense game state (death overs / tight
        // chase / collapse / near-milestone).
        const isKeyBall =
          step.event.isWicket ||
          !!step.milestone ||
          step.event.outcome === '4' ||
          step.event.outcome === '6' ||
          step.inningsBreak ||
          isKeyMoment(lm);

        if (!instant.current) {
          if (chosen === 'KEY' && !isKeyBall) {
            // Highlights mode: fast-forward the quiet deliveries.
            await sleep(
              deliveryDelayMs({
                speed: speedMultRef.current,
                userBatting,
                keyHighlightsMode: true,
                keyBall: false,
              }),
            );
          } else {
            await sleep(
              deliveryDelayMs({
                speed: speedMultRef.current,
                userBatting,
                keyBall: isKeyBall,
                inningsBreak: step.inningsBreak,
                wicketOrMilestone: step.event.isWicket || Boolean(step.milestone),
              }),
            );
          }
        }

        // Over-end summary card
        if (step.overComplete && !instant.current && speedMultRef.current === 1) {
          const scoreBefore = display.score?.runs ?? 0;
          setOverSummary({
            over: Math.floor(lm.scoreState.legalBalls / 6),
            runs: step.score.runs - scoreBefore,
            wickets: step.event.isWicket ? 1 : 0,
            economy: step.score.crr,
          });
          if (overSummaryTimer.current) clearTimeout(overSummaryTimer.current);
          overSummaryTimer.current = setTimeout(() => setOverSummary(null), 2000);
          // Manager mode: nudge the LiveTacticPanel to pulse (AI re-plans each over).
          if (mode === 'manager') setTacticPulse((p) => p + 1);
        }

        // At innings break: if user's team is about to bat, prompt stance change
        // (interactive WATCH mode only — KEY just fast-forwards).
        if (step.inningsBreak && mode === 'career' && chosen === 'WATCH' && !lm.matchDone) {
          const nextBatting = lm.battingTeamId === userTeamId;
          if (nextBatting && lm.needsIntent()) openStancePicker();
        }

        // Pause for the DRS decision on a reviewable user dismissal. Only the
        // interactive WATCH mode offers a review; KEY/skip let the decision stand.
        if (pendingReviewRef.current) {
          if (chosen === 'WATCH' && !instant.current && !skipToBatRef.current) {
            setAwaitingReview(true);
            await new Promise<void>((resolve) => {
              reviewResolver.current = resolve;
            });
            reviewResolver.current = null;
            setAwaitingReview(false);
            pendingReviewRef.current = false;
            if (cancelled.current) return;
            updateCrease(lm);
          } else {
            pendingReviewRef.current = false;
          }
        }
      }
      if (!cancelled.current) {
        skipBusyRef.current = false;
        setSkipBusyLabel(null);
        await finish(lm);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      applyStep,
      finish,
      updateCrease,
      userTeamId,
      userPlayerId,
      waitForPlan,
      waitForStanceChoice,
      waitForTacticsClose,
      waitForCommentaryClose,
      waitForAppActive,
      waitForManualResume,
      waitForGuideClose,
      speedMult,
      mode,
      playedMatchesAllModes,
      closeStancePicker,
      openStancePicker,
    ],
  );

  useEffect(() => {
    cancelled.current = false;
    const started = daily
      ? beginDailyChallengeMatch()
      : intl
        ? beginInternational()
        : beginLiveMatch();
    if (!started) {
      setPhase('empty');
      return;
    }
    finalizedFixtureRef.current = null;
    lmRef.current = started.live;
    const activeSave = useCareer.getState().save;
    const activeFixture = activeSave?.fixtures[started.live.id];
    const initialToss = started.live.tossDecision;
    setSetup({
      homeTeamId: started.live.homeTeamId,
      awayTeamId: started.live.awayTeamId,
      controlledTeamId: started.live.controlledTeamId,
      venue: activeFixture?.venue ?? (daily ? 'Daily Challenge Ground' : 'Neutral Cricket Ground'),
      conditions: started.live.conditions,
      format: started.live.format,
      isTest: started.live.isTest,
      tossWinnerTeamId: initialToss.winnerTeamId,
      tossCoinFace: initialToss.coinFace,
      userCanCallToss: initialToss.userCanCall,
      tossChoice: initialToss.choice,
      battingFirstTeamId: initialToss.battingFirstTeamId,
      userMayChooseToss: initialToss.userMayChoose,
      tossReason: initialToss.reason,
    });
    setSelectedTossCall(null);
    setCoinFlipping(false);
    setTossRevealed(!initialToss.userCanCall);
    coinFlipRotation.value = 0;
    updateCrease(started.live);
    setPhase('prematch');
    return () => {
      cancelled.current = true;
      skipToBatRef.current = false;
      skipRestOfInningsRef.current = false;
      skipBusyRef.current = false;
      setSkipBusyLabel(null);
      stancePauseRef.current = false;
      tacticsPauseRef.current = false;
      commentaryPauseRef.current = false;
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
      if (overSummaryTimer.current) clearTimeout(overSummaryTimer.current);
      if (drsTimer.current) clearTimeout(drsTimer.current);
      if (tossRevealTimer.current) clearTimeout(tossRevealTimer.current);
      // Unblock any pending bowling plan wait so the loop can exit.
      planResolver.current?.('CONTAIN');
      planResolver.current = null;
      // Unblock any pending DRS review wait so the loop can exit.
      reviewResolver.current?.();
      reviewResolver.current = null;
    };
  }, [
    beginLiveMatch,
    beginInternational,
    beginDailyChallengeMatch,
    coinFlipRotation,
    intl,
    daily,
    updateCrease,
  ]);

  const onPlan = (p: BowlerPlan) => {
    const resolve = planResolver.current;
    planResolver.current = null;
    setAwaitingPlan(false);
    resolve?.(p);
  };

  const onSimToEnd = () => {
    instant.current = true;
    // "Simulate Match" is also available while the user has manually paused.
    // Release every local presentation pause before asking the drive loop to
    // finish; otherwise `waitForManualResume()` can keep the instant sim
    // blocked behind a button that the user has already pressed.
    manualPauseRef.current = false;
    setManualPaused(false);
    stancePauseRef.current = false;
    setShowStancePicker(false);
    commentaryPauseRef.current = false;
    setCommentaryOpen(false);
    guidePauseRef.current = false;
    firstGuideDoneRef.current = true;
    setFirstGuideDone(true);
    skipToBatRef.current = false;
    skipRestOfInningsRef.current = false;
    skipBusyRef.current = false;
    setSkipBusyLabel(null);
    tacticsPauseRef.current = false;
    setTacticsOpen(false);
    if (planResolver.current) {
      const resolve = planResolver.current;
      planResolver.current = null;
      setAwaitingPlan(false);
      resolve('CONTAIN');
    }
    // Also unblock a pending DRS review so the sim can run to the end (avoids a hang).
    if (reviewResolver.current) {
      const resolve = reviewResolver.current;
      reviewResolver.current = null;
      pendingReviewRef.current = false;
      setAwaitingReview(false);
      resolve();
    }
  };

  const retrySettlementSave = async () => {
    if (!result) return;
    setSettlementError(null);
    setPhase('saving');
    try {
      await persistCritical(true);
      setPhase('done');
    } catch (error) {
      setSettlementError(
        error instanceof Error && error.message
          ? error.message
          : 'The device did not confirm the match-result save.',
      );
      setPhase('save-error');
    }
  };

  // ---------- RESULT SETTLEMENT ----------
  if ((phase === 'saving' || phase === 'save-error') && result) {
    return (
      <Screen>
        <ScreenHeader title="Saving result" onBack={guardedGoBack} />
        <Card>
          <Text style={styles.msg}>
            {phase === 'saving'
              ? 'Finalising this fixture…'
              : 'This result is still on this screen but has not been confirmed on the device.'}
          </Text>
          {phase === 'save-error' ? (
            <>
              {settlementError ? <Text style={styles.msg}>{settlementError}</Text> : null}
              <Button
                label="Retry save"
                variant="gold"
                onPress={() => void retrySettlementSave()}
              />
            </>
          ) : null}
        </Card>
      </Screen>
    );
  }

  // ---------- EMPTY ----------
  if (phase === 'empty' || !save) {
    return (
      <Screen>
        <ScreenHeader title="Match" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No match available to play right now.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  // ---------- PRE-MATCH ----------
  const applyManagerTactics = (next: Tactics) => {
    setManagerTactics(next);
    setSaveTactics(next, lmRef.current?.id);
    lmRef.current?.setTactics({
      battingBias: TEAM_APPROACH_OPTIONS.find((o) => o.value === next.batting)?.bias ?? 0,
      bowlerPlan: next.bowling,
      field: next.field,
    });
  };

  const confirmManagerPreparation = () => {
    const live = lmRef.current;
    if (!live) return;

    // Persist and scope the plan to the exact fixture already loaded on this
    // Matchday, then refresh its controlled side from the updated save.
    applyManagerTactics(managerTactics);
    const activeSave = useCareer.getState().save;
    if (!activeSave || !applyManagerPreparationToLiveMatch(activeSave, live.id, live)) {
      setManagerAnalysisFlash(
        'Preparation could not be applied to this fixture. Please try again.',
      );
      return;
    }

    updateCrease(live);
    setManagerPreparationConfirmed(true);
  };

  const callToss = (call: TossCall) => {
    const live = lmRef.current;
    if (!live || coinFlipping || !live.setTossCall(call)) return;
    if (tossRevealTimer.current) clearTimeout(tossRevealTimer.current);
    setSelectedTossCall(call);
    setCoinFlipping(true);
    coinFlipRotation.value = 0;
    coinFlipRotation.value = withTiming(1080, { duration: 720 });
    tossRevealTimer.current = setTimeout(() => {
      const toss = live.tossDecision;
      setSetup((current) =>
        current
          ? {
              ...current,
              tossWinnerTeamId: toss.winnerTeamId,
              tossCoinFace: toss.coinFace,
              tossChoice: toss.choice,
              battingFirstTeamId: toss.battingFirstTeamId,
              userMayChooseToss: toss.userMayChoose,
              tossReason: toss.reason,
            }
          : current,
      );
      setCoinFlipping(false);
      setTossRevealed(true);
      moment('coin');
      updateCrease(live);
    }, 740);
  };

  const chooseToss = (choice: TossChoice) => {
    const live = lmRef.current;
    if (!tossRevealed || !live || !live.setTossChoice(choice)) return;
    const toss = live.tossDecision;
    setSetup((current) =>
      current
        ? {
            ...current,
            tossChoice: toss.choice,
            battingFirstTeamId: toss.battingFirstTeamId,
            tossReason: toss.reason,
          }
        : current,
    );
    updateCrease(live);
  };

  if (phase === 'prematch' && setup) {
    const user = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
    const homeName = teamName(setup.homeTeamId);
    const awayName = teamName(setup.awayTeamId);
    const homeShort = teamShort(setup.homeTeamId);
    const awayShort = teamShort(setup.awayTeamId);
    const isHome = setup.homeTeamId === setup.controlledTeamId;
    const userObj = user ? matchObjective(user.role) : null;
    const userSelected = Boolean(
      user &&
      setup.controlledTeamId &&
      (save.teams[setup.controlledTeamId]?.xi?.includes(user.id) ??
        save.teams[setup.controlledTeamId]?.playerIds.includes(user.id)),
    );
    const headToHead = Object.values(save.fixtures).filter(
      (fixture) =>
        fixture.played &&
        ((fixture.homeTeamId === setup.homeTeamId && fixture.awayTeamId === setup.awayTeamId) ||
          (fixture.homeTeamId === setup.awayTeamId && fixture.awayTeamId === setup.homeTeamId)),
    );
    const homeHeadToHeadWins = headToHead.filter(
      (fixture) => fixture.winnerTeamId === setup.homeTeamId,
    ).length;
    const awayHeadToHeadWins = headToHead.filter(
      (fixture) => fixture.winnerTeamId === setup.awayTeamId,
    ).length;
    const bestPlayer = (teamId: string) =>
      save.teams[teamId]?.playerIds
        .map((playerId) => save.players[playerId])
        .filter(Boolean)
        .sort((a, b) => b.overall - a.overall)[0];
    const homeKeyPlayer = bestPlayer(setup.homeTeamId);
    const awayKeyPlayer = bestPlayer(setup.awayTeamId);
    const managerReport =
      mode === 'manager' ? buildOppositionReport(save, lmRef.current?.id) : undefined;
    const managerAnalysisUsed =
      mode === 'manager' && managerResourceUsed(save, 'MATCH_ANALYSIS', lmRef.current?.id);
    const managerTeamTalkUsed =
      mode === 'manager' && managerResourceUsed(save, 'EMERGENCY_TEAM_TALK', lmRef.current?.id);
    const refreshAfterManagerResource = () => {
      const live = lmRef.current;
      const activeSave = useCareer.getState().save;
      if (!live || !activeSave || !applyManagerPreparationToLiveMatch(activeSave, live.id, live)) {
        return false;
      }
      updateCrease(live);
      return true;
    };
    const applyRecommendedPlan = () => {
      if (!managerReport) return;
      applyManagerTactics(managerReport.recommendedTactics);
      setManagerAnalysisFlash(
        `Plan applied: ${tacticSelectionSummary(managerReport.recommendedTactics)}.`,
      );
    };
    const buyManagerAnalysis = () => {
      const outcome = runManagerResource('MATCH_ANALYSIS', lmRef.current?.id);
      const refreshed = !outcome.ok || refreshAfterManagerResource();
      setManagerAnalysisFlash(
        outcome.ok
          ? refreshed
            ? 'Analysis unlocked · XI +2 form · +1 morale'
            : 'Analysis saved · confirm preparation to refresh this match'
          : (outcome.reason ?? 'Analysis unavailable.'),
      );
    };
    const buyManagerTeamTalk = () => {
      const outcome = runManagerResource('EMERGENCY_TEAM_TALK', lmRef.current?.id);
      const refreshed = !outcome.ok || refreshAfterManagerResource();
      setManagerAnalysisFlash(
        outcome.ok
          ? refreshed
            ? 'Team talk complete · 3 players +5 morale'
            : 'Team talk saved · confirm preparation to refresh this match'
          : (outcome.reason ?? 'Team talk unavailable.'),
      );
    };

    return (
      <Screen
        scroll
        gradient={gradients.pitch}
        footer={
          !tossRevealed ? (
            <View style={styles.requirementFooter}>
              <Text style={styles.requirementText}>
                {coinFlipping ? 'Toss in progress…' : 'Choose Heads or Tails above to continue'}
              </Text>
              <Button label="Continue to Match" variant="secondary" disabled />
            </View>
          ) : mode === 'manager' && !managerPreparationConfirmed ? (
            <View style={styles.requirementFooter}>
              <Text style={styles.requirementText}>Confirm the match plan above to continue</Text>
              <Button label="Continue to Match" variant="secondary" disabled />
            </View>
          ) : undefined
        }
      >
        <ScreenHeader title="Matchday" onBack={guardedGoBack} />

        {/* Cinematic team clash header */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.prematchHeroWrap}>
          <HeroBackground variant="match" style={{ height: '100%', borderRadius: 0 }} />
          {/* Team entries */}
          <Animated.View
            entering={SlideInUp.duration(400).delay(200)}
            style={styles.prematchTeamOverlay}
          >
            <View style={styles.prematchTeamEntry}>
              <Animated.View
                entering={FadeInRight.duration(350).delay(300)}
                style={styles.prematchTeamBox}
              >
                <Text style={styles.prematchTeamAbbr}>{homeShort}</Text>
                <Text style={styles.prematchTeamFull} numberOfLines={1}>
                  {homeName}
                </Text>
                {isHome && <Text style={styles.prematchHomeTag}>HOME</Text>}
              </Animated.View>
              <Text style={styles.prematchVs}>VS</Text>
              <Animated.View
                entering={FadeIn.duration(350).delay(500)}
                style={[styles.prematchTeamBox, { alignItems: 'flex-end' }]}
              >
                <Text style={styles.prematchTeamAbbr}>{awayShort}</Text>
                <Text style={styles.prematchTeamFull} numberOfLines={1}>
                  {awayName}
                </Text>
                {!isHome && <Text style={styles.prematchHomeTag}>HOME</Text>}
              </Animated.View>
            </View>
          </Animated.View>
        </Animated.View>
        <SponsorBrandRow
          earned={sponsorBranding.earned}
          premium={sponsorBranding.premium}
          compact
          style={styles.matchSponsorRow}
        />

        {/* Conditions card */}
        <Animated.View entering={FadeInDown.duration(350).delay(400)}>
          <Card style={styles.vsCard}>
            <Text style={styles.vsSub}>{FORMATS[setup.format].label}</Text>
            <View style={styles.venueRow}>
              <Icon name="location-outline" size={15} color={colors.textMuted} />
              <Text style={styles.venueText} numberOfLines={1}>
                {setup.venue}
              </Text>
            </View>
            <View style={styles.condRow}>
              <View style={styles.condPill}>
                <Text style={styles.condEmoji}>🏟️</Text>
                <Text style={styles.condText}>{PITCH_LABEL[setup.conditions.pitch]}</Text>
              </View>
              <View style={styles.condPill}>
                <Text style={styles.condEmoji}>☁️</Text>
                <Text style={styles.condText}>{WEATHER_LABEL[setup.conditions.weather]}</Text>
              </View>
            </View>
            <Text style={styles.surfaceBrief}>
              {surfaceBriefing(setup.conditions, setup.format)}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(350).delay(460)}>
          <Card style={styles.tossCard}>
            <View style={styles.tossHeader}>
              <Text style={styles.tossTitle}>Toss</Text>
              <Text style={styles.tossWinner}>
                {tossRevealed
                  ? `${teamName(setup.tossWinnerTeamId)} won`
                  : coinFlipping
                    ? 'Coin in the air'
                    : 'Make the call'}
              </Text>
            </View>
            {!tossRevealed && setup.userCanCallToss ? (
              <>
                <Animated.View style={[styles.coin, coinFlipStyle]}>
                  <Text style={styles.coinText}>{coinFlipping ? '' : '?'}</Text>
                </Animated.View>
                <Text style={styles.tossPrompt}>
                  {coinFlipping
                    ? `You called ${selectedTossCall?.toLowerCase()}.`
                    : 'Call the coin'}
                </Text>
                <View style={styles.tossChoices}>
                  {(['HEADS', 'TAILS'] as TossCall[]).map((call) => {
                    const selected = selectedTossCall === call;
                    return (
                      <Pressable
                        key={call}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        disabled={coinFlipping}
                        onPress={() => callToss(call)}
                        style={[styles.tossChoice, selected && styles.tossChoiceActive]}
                      >
                        <Text
                          style={[styles.tossChoiceText, selected && styles.tossChoiceTextActive]}
                        >
                          {call === 'HEADS' ? 'Heads' : 'Tails'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : tossRevealed ? (
              <>
                <View style={styles.coinResultRow}>
                  <View style={styles.coinSmall}>
                    <Text style={styles.coinSmallText}>
                      {setup.tossCoinFace === 'HEADS' ? 'H' : 'T'}
                    </Text>
                  </View>
                  <Text style={styles.tossPrompt}>
                    {setup.userCanCallToss && selectedTossCall
                      ? `Called ${selectedTossCall.toLowerCase()} · Landed ${setup.tossCoinFace.toLowerCase()}`
                      : `Landed ${setup.tossCoinFace.toLowerCase()}`}
                  </Text>
                </View>
                {setup.userMayChooseToss ? (
                  <>
                    <Text style={styles.tossPrompt}>Choose to bat or bowl.</Text>
                    <View style={styles.tossChoices}>
                      {(['BAT', 'BOWL'] as TossChoice[]).map((choice) => {
                        const selected = setup.tossChoice === choice;
                        return (
                          <Pressable
                            key={choice}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => chooseToss(choice)}
                            style={[styles.tossChoice, selected && styles.tossChoiceActive]}
                          >
                            <Text
                              style={[
                                styles.tossChoiceText,
                                selected && styles.tossChoiceTextActive,
                              ]}
                            >
                              {choice === 'BAT' ? 'Bat first' : 'Bowl first'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <Text style={styles.tossPrompt}>
                    {teamName(setup.tossWinnerTeamId)} chose to {setup.tossChoice.toLowerCase()}{' '}
                    first.
                  </Text>
                )}
                <Text style={styles.tossOutcome}>{setup.tossReason}</Text>
              </>
            ) : null}
          </Card>
        </Animated.View>

        {/* One pre-match briefing; no objective is shown to benched players. */}
        {mode === 'career' ? (
          <Animated.View entering={FadeInDown.duration(350).delay(520)}>
            <Card style={styles.missionPreCard}>
              <Text style={styles.missionPreTitle}>Match briefing</Text>
              <Text style={styles.missionPreName}>
                {userSelected && user ? `Selected: ${user.name}` : 'Bench / rest assignment'}
              </Text>
              {userSelected && userObj ? (
                <>
                  <Text style={styles.missionPreGoal}>Personal objective: {userObj.text}</Text>
                  <View style={styles.missionPreReward}>
                    <Text style={styles.missionPreRewardText}>
                      Objective reward: +{userObj.reward} coins
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.missionPreGoal}>Not selected · no personal objective.</Text>
              )}
            </Card>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(350).delay(520)}>
            <Card style={styles.missionPreCard}>
              <Text style={styles.missionPreTitle}>Match Preparation</Text>
              <Text style={styles.fieldRestrictionText}>
                Head-to-head: {homeShort} {homeHeadToHeadWins}-{awayHeadToHeadWins} {awayShort}
              </Text>
              {managerReport ? (
                <>
                  <View style={styles.preparationRatings}>
                    <PreparationRating label="Batting" value={managerReport.battingRating} />
                    <PreparationRating label="Bowling" value={managerReport.bowlingRating} />
                    <PreparationRating label="Fielding" value={managerReport.fieldingRating} />
                  </View>
                  <Button
                    label={
                      managerPreparationOpen ? 'Hide preparation details' : 'Review preparation'
                    }
                    variant="secondary"
                    size="sm"
                    onPress={() => setManagerPreparationOpen((open) => !open)}
                  />
                  {managerPreparationOpen ? (
                    managerAnalysisUsed ? (
                      <View style={styles.analysisReport}>
                        <Text style={styles.analysisReportTitle}>Full opposition report</Text>
                        <Text style={styles.preparationLine}>
                          Batting · {managerReport.topBatter.name} ({managerReport.topBatter.rating}
                          )
                        </Text>
                        <Text style={styles.preparationLine}>
                          Bowling · {managerReport.topBowler.name} ({managerReport.topBowler.rating}
                          )
                        </Text>
                        <Text style={styles.preparationLine}>{managerReport.recommendation}</Text>
                        <Button
                          label="Apply Recommended Plan"
                          variant="secondary"
                          size="sm"
                          onPress={applyRecommendedPlan}
                        />
                      </View>
                    ) : (
                      <View style={styles.analysisLocked}>
                        <Button
                          label={`Unlock Full Analysis · ${MANAGER_MATCH_ANALYSIS_COINS} coins`}
                          variant="secondary"
                          size="sm"
                          disabled={save.wallet.coins < MANAGER_MATCH_ANALYSIS_COINS}
                          onPress={buyManagerAnalysis}
                        />
                      </View>
                    )
                  ) : null}
                </>
              ) : (
                <Text style={styles.fieldRestrictionText}>
                  Pitch: {PITCH_LABEL[setup.conditions.pitch]} · Key matchup:{' '}
                  {homeKeyPlayer?.name ?? homeShort} ({homeKeyPlayer?.overall ?? '-'}) v{' '}
                  {awayKeyPlayer?.name ?? awayShort} ({awayKeyPlayer?.overall ?? '-'})
                </Text>
              )}
              {managerPreparationOpen ? (
                <>
                  <View style={styles.analysisLocked}>
                    <Text style={styles.analysisReportTitle}>Emergency Team Talk</Text>
                    <Button
                      label={
                        managerTeamTalkUsed
                          ? 'Team Talk Applied'
                          : `Run Team Talk · ${MANAGER_EMERGENCY_TEAM_TALK_COINS.toLocaleString()} coins`
                      }
                      variant="secondary"
                      size="sm"
                      disabled={
                        managerTeamTalkUsed || save.wallet.coins < MANAGER_EMERGENCY_TEAM_TALK_COINS
                      }
                      onPress={buyManagerTeamTalk}
                    />
                  </View>
                  {managerAnalysisFlash ? (
                    <Text style={styles.analysisFlash}>{managerAnalysisFlash}</Text>
                  ) : null}
                  <Text style={styles.tacticPreLabel}>Batting approach</Text>
                  <View style={styles.tacticPreRow}>
                    {TEAM_APPROACH_OPTIONS.map((o) => {
                      const sel = managerTactics.batting === o.value;
                      return (
                        <Pressable
                          key={o.value}
                          style={[styles.tacticPreChip, sel && styles.tacticPreChipActive]}
                          onPress={() =>
                            applyManagerTactics({ ...managerTactics, batting: o.value })
                          }
                        >
                          <Text
                            style={[
                              styles.tacticPreChipText,
                              sel && styles.tacticPreChipTextActive,
                            ]}
                          >
                            {o.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.tacticPreLabel}>Bowling plan</Text>
                  <View style={styles.tacticPreRow}>
                    {BOWLER_PLAN_OPTIONS.map((o) => {
                      const sel = managerTactics.bowling === o.value;
                      return (
                        <Pressable
                          key={o.value}
                          style={[styles.tacticPreChip, sel && styles.tacticPreChipActive]}
                          onPress={() =>
                            applyManagerTactics({ ...managerTactics, bowling: o.value })
                          }
                        >
                          <Text
                            style={[
                              styles.tacticPreChipText,
                              sel && styles.tacticPreChipTextActive,
                            ]}
                          >
                            {o.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.tacticPreLabel}>Field setting</Text>
                  <View style={styles.fieldRestrictionCallout}>
                    <Text style={styles.fieldRestrictionCalloutText}>
                      {fieldRestriction(setup.format, 0).label}
                    </Text>
                  </View>
                  <View style={styles.tacticPreRow}>
                    {FIELD_OPTIONS.map((o) => {
                      const sel = managerTactics.field === o.value;
                      const legal = isFieldSettingLegal(o.value, setup.format, 0);
                      return (
                        <Pressable
                          key={o.value}
                          disabled={!legal}
                          style={[
                            styles.tacticPreChip,
                            sel && styles.tacticPreChipActive,
                            !legal && styles.tacticChipDisabled,
                          ]}
                          onPress={() => applyManagerTactics({ ...managerTactics, field: o.value })}
                        >
                          <Text
                            style={[
                              styles.tacticPreChipText,
                              sel && styles.tacticPreChipTextActive,
                            ]}
                          >
                            {o.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <Text style={styles.managerPlanSummary}>
                  Current plan · {tacticSelectionSummary(managerTactics)}
                </Text>
              )}
              <Button
                label={
                  managerPreparationConfirmed ? 'Preparation Confirmed' : 'Confirm Preparation'
                }
                variant={managerPreparationConfirmed ? 'secondary' : 'primary'}
                disabled={managerPreparationConfirmed}
                onPress={confirmManagerPreparation}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          </Animated.View>
        )}

        {tossRevealed && (mode !== 'manager' || managerPreparationConfirmed) ? (
          <>
            <Animated.View entering={FadeInDown.duration(300).delay(560)}>
              <Text style={styles.pickLabel}>Match mode</Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(300).delay(600)}>
              <ModeButton emoji="🎙️" title="Watch ball-by-ball" onPress={() => drive('WATCH')} />
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(300).delay(640)}>
              <ModeButton emoji="⏱️" title="Key moments" onPress={() => drive('KEY')} />
            </Animated.View>
            <Animated.View entering={FadeInDown.duration(300).delay(720)}>
              <ModeButton emoji="⏭️" title="Instant sim" onPress={() => drive('INSTANT')} />
            </Animated.View>
          </>
        ) : null}
      </Screen>
    );
  }

  // ---------- DONE (summary) ----------
  if (phase === 'done' && result) {
    const { match, userWon, coinsAwarded } = result;
    const marginText = match.result?.margin?.toLowerCase() ?? '';
    const neutralOutcome = !match.result?.winnerTeamId;
    const drawn = neutralOutcome && (match.format === 'TEST' || marginText.includes('draw'));
    const tied = neutralOutcome && Boolean(match.result?.tie);
    const headline = userWon
      ? 'Victory!'
      : drawn
        ? 'Draw'
        : tied
          ? 'Tied!'
          : neutralOutcome
            ? 'No Result'
            : 'Defeat';
    const headlineColor = userWon ? colors.success : neutralOutcome ? colors.accent : colors.danger;
    const rewardedAdsAvailable = ads.isAdsReady() || ads.isReady('rewarded');
    return (
      <>
        <Screen
          scroll
          scrollResetKey={`match-result:${result.fixtureId}`}
          gradient={gradients.pitch}
          footer={
            <View style={styles.resultFooter}>
              <Button
                label={result.injury ? 'View Injury Report' : 'Continue'}
                variant="gold"
                onPress={() => {
                  // A fresh injury this match → present the Injury Report (replacing
                  // this screen so its back button returns to the hub, not here).
                  if (result.injury) {
                    navigation.replace('InjuryReport', {
                      playerName: result.injury.playerName,
                      weeksOut: result.injury.matchesOut,
                      matchesMissed: result.injury.matchesOut,
                      playerId: result.injury.playerId,
                    });
                  } else {
                    navigation.goBack();
                  }
                }}
              />
              {mode === 'career' && !result.injury ? (
                <View style={styles.resultFooterChoices}>
                  <Button
                    label="Training"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    style={styles.resultFooterChoice}
                    onPress={() => navigation.replace('Training')}
                  />
                  <Button
                    label="Life & Ventures"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    style={styles.resultFooterChoice}
                    onPress={() => navigation.replace('PlayerLife')}
                  />
                </View>
              ) : null}
            </View>
          }
        >
          <ScreenHeader
            title="Result"
            subtitle={`${teamName(match.homeTeamId)} v ${teamName(match.awayTeamId)}`}
            onBack={() => navigation.goBack()}
          />
          <Card style={styles.resultCard}>
            <VictoryHero won={userWon} neutral={neutralOutcome} style={styles.victoryImg} />
            <Text style={[styles.resultBig, { color: headlineColor }]}>{headline}</Text>
            <Text style={styles.margin}>{match.result?.margin}</Text>
            {match.result?.playerOfMatchId ? (
              <Text style={styles.potm}>
                Player of the Match · {nameOf(match.result.playerOfMatchId)}
              </Text>
            ) : null}
            {result.rating != null ? (
              <Animated.View
                entering={FadeInDown.duration(350).delay(200)}
                style={styles.ratingBlock}
              >
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <Text
                      key={n}
                      style={[
                        styles.ratingStar,
                        {
                          color:
                            n <= Math.round(result.rating ?? 0) ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      ★
                    </Text>
                  ))}
                </View>
                <Text style={styles.ratingNum}>{result.rating.toFixed(1)}</Text>
                <Text style={styles.ratingLabel}>MATCH RATING</Text>
                <Text style={styles.ratingImpact}>
                  {result.rating >= 8
                    ? '⬆ Selection boost'
                    : result.rating >= 6
                      ? '➡ Reputation steady'
                      : '⬇ Form down'}
                </Text>
              </Animated.View>
            ) : null}
            {result.objectiveText ? (
              <Animated.View
                entering={FadeInDown.duration(300).delay(300)}
                style={[
                  styles.objCard,
                  {
                    borderColor: result.objectiveMet ? colors.success : colors.border,
                    backgroundColor: result.objectiveMet
                      ? colors.success + '11'
                      : colors.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.objCheck,
                    { color: result.objectiveMet ? colors.success : colors.danger },
                  ]}
                >
                  {result.objectiveMet ? '✓' : '✗'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.objLine,
                      { color: result.objectiveMet ? colors.success : colors.textFaint },
                    ]}
                  >
                    {result.objectiveText}
                  </Text>
                  {result.objectiveMet && result.bonus ? (
                    <Text style={styles.objBonus}>+{result.bonus} coins bonus</Text>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}
            {result.selected === false ? (
              <Text style={styles.callup}>Not selected; train to regain form.</Text>
            ) : null}
            {mode === 'manager' ? (
              <Animated.View
                entering={FadeInDown.duration(300).delay(360)}
                style={styles.tacticProofCard}
              >
                <Text style={styles.tacticProofTitle}>Tactical readout</Text>
                <Text style={styles.tacticProofText}>
                  {tacticalImpactSummary(managerTactics, match, userTeamId)}
                </Text>
              </Animated.View>
            ) : null}
            {result.calledUp ? <Text style={styles.callup}>🧢 National call-up</Text> : null}
            {result.international ? (
              <Text style={styles.callup}>
                🧢 International cap earned{result.bonus ? ' · Player of the Match' : ''}
              </Text>
            ) : null}
            <View style={styles.rewardPill}>
              <Text style={styles.rewardText}>+{coinsAwarded + (result.bonus ?? 0)} coins</Text>
            </View>
            {coinsAwarded > 0 ? (
              adClaimed ? (
                <Text style={styles.adDone}>Coins doubled ✓</Text>
              ) : !rewardedAdsAvailable ? (
                <Button
                  label="Rewarded ads unavailable"
                  variant="secondary"
                  disabled
                  style={{ marginTop: spacing.md }}
                />
              ) : (
                <>
                  <Button
                    label={adBusy ? 'Loading ad…' : `📺 Watch to double (+${coinsAwarded})`}
                    variant="secondary"
                    loading={adBusy}
                    style={{ marginTop: spacing.md }}
                    onPress={async () => {
                      if (adRewardPendingRef.current || adClaimed) return;
                      adRewardPendingRef.current = true;
                      setAdError(null);
                      setAdBusy(true);
                      try {
                        const { completed } = await ads.showRewarded();
                        if (completed) {
                          const granted = grantAdReward(
                            coinsAwarded,
                            `match-double:${result.fixtureId}`,
                          );
                          if (granted.ok) {
                            setAdClaimed(true);
                          } else {
                            setAdError(granted.reason ?? 'Reward already applied.');
                          }
                        } else {
                          setAdError('Reward not granted. Watch the full ad to claim the bonus.');
                        }
                      } finally {
                        adRewardPendingRef.current = false;
                        setAdBusy(false);
                      }
                    }}
                  />
                  {adError ? <Text style={styles.adError}>{adError}</Text> : null}
                </>
              )
            ) : null}
          </Card>

          {result.impact?.changes.length ? (
            <Animated.View entering={FadeInDown.duration(350).delay(400)}>
              <Card style={styles.whyCard}>
                <Text style={styles.whyEyebrow}>PROGRESS</Text>
                <View style={styles.progressionGrid}>
                  {result.impact.changes.map((change) => (
                    <View key={change.label} style={styles.progressionItem}>
                      <Text style={styles.progressionLabel}>{change.label}</Text>
                      <Text
                        style={[
                          styles.progressionValue,
                          { color: change.delta >= 0 ? colors.success : colors.warning },
                        ]}
                      >
                        {change.before} → {change.after} ({change.delta >= 0 ? '+' : ''}
                        {change.delta})
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>
          ) : null}

          {match.innings.map((inn, idx) => (
            <Card key={idx} style={{ marginTop: spacing.lg }}>
              <View style={styles.innHeader}>
                <Text style={styles.innTeam} numberOfLines={1}>
                  {teamName(inn.battingTeamId)}
                </Text>
                <Text style={styles.innScore}>
                  {inn.runs}/{inn.wickets}{' '}
                  <Text style={styles.innOvers}>({inn.overs.toFixed(1)})</Text>
                </Text>
              </View>
              {topBatters(inn).map((b) => (
                <View key={b.playerId} style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {nameOf(b.playerId)}
                    {b.out ? '' : ' *'}
                  </Text>
                  <Text style={styles.rowStat}>
                    {b.runs} <Text style={styles.rowFaint}>({b.balls})</Text>
                  </Text>
                </View>
              ))}
              <View style={styles.divider} />
              {topBowlers(inn).map((bw) => (
                <View key={bw.playerId} style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {nameOf(bw.playerId)}
                  </Text>
                  <Text style={styles.rowStat}>
                    {bw.wickets}/{bw.runs}{' '}
                    <Text style={styles.rowFaint}>({oversFromBalls(bw.balls)})</Text>
                  </Text>
                </View>
              ))}
            </Card>
          ))}

          <Button
            label={fullScorecardOpen ? 'Hide Full Scorecard' : 'View Full Scorecard'}
            variant="secondary"
            style={styles.fullScorecardButton}
            onPress={() => setFullScorecardOpen((open) => !open)}
          />
          {fullScorecardOpen ? (
            <Animated.View entering={FadeInDown.duration(240)}>
              <Text style={styles.fullScorecardTitle}>Full Scorecard</Text>
              {match.innings.map((innings, index) => (
                <FullInningsScorecard
                  key={`${innings.battingTeamId}-${index}`}
                  innings={innings}
                  format={match.format}
                  teamName={teamName}
                  nameOf={nameOf}
                />
              ))}
            </Animated.View>
          ) : null}

          <Text style={styles.analysisHeader}>Match Analysis</Text>
          <Card style={styles.analysisCard}>
            <Text style={styles.analysisTitle}>
              Runs per over · {teamShort(match.innings[0].battingTeamId)}
            </Text>
            <ManhattanChart overs={manhattanData(match.innings[0])} width={300} />
          </Card>
          {save.userPlayerId && userShots(match, save.userPlayerId).length >= 3 ? (
            <Card style={styles.analysisCard}>
              <Text style={styles.analysisTitle}>Your wagon wheel</Text>
              <WagonWheel shots={userShots(match, save.userPlayerId)} size={240} />
            </Card>
          ) : null}
        </Screen>
        <CelebrationOverlay
          trigger={celebration.trigger}
          kind={celebration.kind}
          theme={
            save.cosmetics?.celebration === 'pass_celebration_lights' ? 'floodlights' : 'classic'
          }
        />
      </>
    );
  }

  // ---------- LIVE ----------
  const s = display.score;
  const c = display.crease;
  const liveConditions = lmRef.current?.conditions;
  const matchup =
    c && liveConditions
      ? describeMatchup(
          save.players[c.strikerId],
          save.players[c.bowlerId],
          liveConditions,
          s?.requiredRunRate ?? undefined,
        )
      : null;
  const chasing = s?.target != null;
  const controlledPlayerAtCrease =
    !!userPlayerId &&
    (display.crease?.strikerId === userPlayerId || display.crease?.nonStrikerId === userPlayerId);
  const userBatterPosition: 'striker' | 'nonStriker' | null =
    mode !== 'career' || !userPlayerId || !c
      ? null
      : c.strikerId === userPlayerId
        ? 'striker'
        : c.nonStrikerId === userPlayerId
          ? 'nonStriker'
          : null;
  const battingTeam = save.teams[display.battingTeamId];
  const bowlingTeam = save.teams[display.bowlingTeamId];
  const visibleFieldSetting: FieldSetting =
    mode === 'manager' && display.bowlingTeamId === userTeamId
      ? (managerTactics.field ?? 'BALANCED')
      : 'BALANCED';
  const liveFormat = setup?.format ?? lmRef.current?.format ?? 'T20';
  const ballsPerOver = FORMATS[liveFormat].ballsPerOver;
  const currentOver = Math.floor((s?.legalBalls ?? 0) / ballsPerOver);
  const legalOverDots = display.overDots.filter((dot) => dot.legal).slice(0, ballsPerOver);
  const extraOverDots = display.overDots.filter((dot) => !dot.legal);
  const overSlots = Array.from(
    { length: ballsPerOver },
    (_, index) => legalOverDots[index] ?? null,
  );
  let footer: React.ReactNode;
  if (awaitingPlan) {
    // Bowling plan — shown once per over when user is bowling.
    footer = (
      <View>
        <Text style={styles.intentPrompt}>Your over — set your plan</Text>
        <View style={styles.intentGrid}>
          {BOWLER_PLAN_OPTIONS.map((o) => (
            <Pressable key={o.value} style={styles.intentBtn} onPress={() => onPlan(o.value)}>
              <Text style={styles.intentEmoji}>{o.emoji}</Text>
              <Text style={styles.intentLabel}>{o.label}</Text>
              <Text style={styles.intentDesc}>{o.desc}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  } else {
    const role = matchRole;
    // Career mode uses personal batting/bowling prompts. Team tactics are manager-only.
    // KEY (highlights) mode is non-interactive, so batting controls are hidden.
    const isCareerBatting =
      mode === 'career' && role === 'BATTING' && controlledPlayerAtCrease && driveMode !== 'KEY';
    // KEY (highlights) is non-interactive for both modes, so hide manager tactics too.
    const showTactics = mode === 'manager' && role !== 'NONE' && driveMode !== 'KEY';

    const setTactic = (
      t: { battingBias?: number; bowlerPlan?: BowlerPlan; field?: FieldSetting },
      label: string,
    ) => {
      lmRef.current?.setTactics(t);
      const next: Tactics = { ...managerTactics };
      if (typeof t.battingBias === 'number') {
        next.batting =
          TEAM_APPROACH_OPTIONS.find((o) => o.bias === t.battingBias)?.value ?? next.batting;
      }
      if (t.bowlerPlan) next.bowling = t.bowlerPlan;
      if (t.field) next.field = t.field;
      const impact = tacticChangeImpact(managerTactics, next);
      setManagerTactics(next);
      setSaveTactics(next);
      tacticsPauseRef.current = false;
      setTacticsOpen(false);
      // 2s impact toast describing what the change actually does (roadmap §4).
      flashBanner({ text: impact ?? label, tone: 'accent' });
    };

    const skipAction = careerSkipAction({
      mode: mode === 'career' ? 'career' : mode === 'manager' ? 'manager' : undefined,
      driveMode,
      hasCrease: Boolean(display.crease),
      userAtCrease: controlledPlayerAtCrease,
      userDismissed: userDismissed || userDismissedRef.current,
      userTeamBatting: display.battingTeamId === userTeamId,
      skipToBatActive: skipToBatRef.current,
      skipRestActive: skipRestOfInningsRef.current,
      userSelected: Boolean(
        userPlayerId && (save.teams[userTeamId ?? '']?.xi ?? []).includes(userPlayerId),
      ),
      userCanStillBat:
        Boolean(setup?.isTest) ||
        display.battingTeamId === userTeamId ||
        display.inningsIndex === 0,
    });

    footer = (
      <View>
        {/* Stance picker — career batting only */}
        {showStancePicker && isCareerBatting ? (
          <View style={styles.stancePanel}>
            <Text style={styles.stancePanelTitle}>Change batting approach</Text>
            <View style={styles.intentGrid}>
              {BATTING_STANCES.map((o) => {
                const sel = battingStance === o.value;
                return (
                  <Pressable
                    key={o.value}
                    style={[styles.intentBtn, sel && styles.intentBtnActive]}
                    onPress={() => {
                      stanceRef.current = o.value;
                      setBattingStance(o.value);
                      closeStancePicker();
                    }}
                  >
                    <Text style={styles.intentEmoji}>{o.emoji}</Text>
                    <Text style={styles.intentLabel}>{o.label}</Text>
                    <Text style={styles.intentDesc}>{o.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Tactics panel — manager mode or career bowling */}
        {tacticsOpen && showTactics ? (
          <View style={styles.tacticsPanel}>
            {role === 'BATTING' ? (
              <View style={styles.tacticsRow}>
                {TEAM_APPROACH_OPTIONS.map((o) => (
                  <Pressable
                    key={o.value}
                    style={styles.tacticChip}
                    onPress={() => setTactic({ battingBias: o.bias }, `Batting: ${o.label}`)}
                  >
                    <Text style={styles.tacticChipText}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <>
                <View style={styles.tacticsRow}>
                  {BOWLER_PLAN_OPTIONS.map((o) => (
                    <Pressable
                      key={o.value}
                      style={styles.tacticChip}
                      onPress={() => setTactic({ bowlerPlan: o.value }, `Bowling: ${o.label}`)}
                    >
                      <Text style={styles.tacticChipText}>
                        {o.emoji} {o.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.tacticsRow}>
                  {FIELD_OPTIONS.map((o) => {
                    const legal = isFieldSettingLegal(o.value, liveFormat, currentOver);
                    return (
                      <Pressable
                        key={o.value}
                        disabled={!legal}
                        style={[styles.tacticChip, !legal && styles.tacticChipDisabled]}
                        onPress={() => setTactic({ field: o.value }, `Field: ${o.label}`)}
                      >
                        <Text style={styles.tacticChipText}>
                          {o.emoji} {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.fieldRestrictionText}>
                  {fieldRestriction(liveFormat, currentOver).label}
                </Text>
              </>
            )}
          </View>
        ) : null}

        <View style={styles.footerRow}>
          {/* Career batting: stance button (replaces Tactics) */}
          {isCareerBatting ? (
            <Pressable style={styles.stanceIndicatorBtn} onPress={toggleStancePicker}>
              <Text style={styles.stanceIndicatorEmoji}>
                {BATTING_STANCES.find((s) => s.value === battingStance)?.emoji}
              </Text>
              <Text style={styles.stanceIndicatorLabel}>
                {BATTING_STANCES.find((s) => s.value === battingStance)?.label}
              </Text>
            </Pressable>
          ) : null}

          {/* Manager / career bowling: Tactics */}
          {showTactics ? (
            <Button
              label={tacticsOpen ? 'Close' : '⚙︎ Tactics'}
              variant="secondary"
              fullWidth={false}
              style={styles.footerBtn}
              onPress={() =>
                setTacticsOpen((v) => {
                  const next = !v;
                  tacticsPauseRef.current = next;
                  return next;
                })
              }
            />
          ) : null}

          {/* This control intentionally avoids the animated shared Button. The
              match body re-lays out when speed changes, and on Android the
              recycled animated layer could turn transparent while its native
              hit target remained mounted. */}
          <Pressable
            key="live-match-pause"
            accessibilityRole="button"
            accessibilityLabel={manualPaused ? 'Resume match' : 'Pause match'}
            accessibilityState={{ selected: manualPaused }}
            android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: false }}
            style={({ pressed }) => [
              styles.pauseControl,
              manualPaused && styles.pauseActive,
              pressed && styles.pausePressed,
            ]}
            onPress={toggleManualPause}
          >
            <Text style={styles.pauseControlText}>{manualPaused ? 'Resume' : 'Pause'}</Text>
          </Pressable>

          {/* Skip to my bat — shown when user player hasn't come to bat yet */}
          {skipBusyLabel ? (
            <Button
              label={skipBusyLabel}
              variant="ghost"
              fullWidth={false}
              style={styles.footerBtn}
              loading
              disabled
            />
          ) : skipAction ? (
            <Button
              label={skipAction.label}
              variant="ghost"
              fullWidth={false}
              style={styles.footerBtn}
              onPress={() => {
                if (skipBusyRef.current) return;
                skipBusyRef.current = true;
                setSkipBusyLabel(skipAction.label);
                manualPauseRef.current = false;
                setManualPaused(false);
                stancePauseRef.current = false;
                setShowStancePicker(false);
                tacticsPauseRef.current = false;
                setTacticsOpen(false);
                commentaryPauseRef.current = false;
                guidePauseRef.current = false;
                if (
                  skipAction.kind === 'SKIP_REST_OF_INNINGS' ||
                  skipAction.kind === 'SKIP_BOWLING_INNINGS'
                ) {
                  skipRestOfInningsRef.current = true;
                } else {
                  skipToBatRef.current = true;
                }
                // Unblock any bowling plan wait.
                if (planResolver.current) {
                  const r = planResolver.current;
                  planResolver.current = null;
                  setAwaitingPlan(false);
                  r('CONTAIN');
                }
                if (reviewResolver.current) {
                  const resolve = reviewResolver.current;
                  reviewResolver.current = null;
                  pendingReviewRef.current = false;
                  setAwaitingReview(false);
                  resolve();
                }
              }}
            />
          ) : null}

          {/* DRS reviews are decided via the pause prompt (see awaitingReview overlay). */}

          {/* Speed controls */}
          <View style={styles.speedRow}>
            {MATCH_SPEED_OPTIONS.map(({ speed, label }) => (
              <Pressable
                key={speed}
                style={[styles.speedBtn, speedMult === speed && styles.speedBtnActive]}
                onPress={() => changeSpeed(speed)}
              >
                <Text
                  style={[styles.speedText, speedMult === speed && styles.speedTextActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label="Simulate Match"
            variant="ghost"
            fullWidth={false}
            style={styles.footerBtn}
            onPress={onSimToEnd}
          />
        </View>
      </View>
    );
  }

  const fastMatchUi = speedMult > 1;
  const recentFeed = [...display.feed.slice(0, fastMatchUi ? 3 : 4)].reverse();

  return (
    <>
      {/* Wicket flash overlay — appears on top of everything */}
      <Animated.View style={wicketFlashStyle} pointerEvents="none" collapsable={false} />
      <Animated.View style={[{ flex: 1 }, shakeStyle]}>
        <Screen scroll gradient={gradients.pitch} footer={footer}>
          <ScreenHeader
            title={`${teamShort(display.battingTeamId)} batting`}
            subtitle={
              setup?.isTest
                ? `Innings ${display.inningsIndex + 1} of 4`
                : `${display.inningsIndex === 0 ? '1st' : '2nd'} innings`
            }
          />

          {/* Over-end summary card */}
          {!fastMatchUi && overSummary && (
            <Animated.View
              entering={SlideInUp.duration(250)}
              exiting={FadeOut.duration(300)}
              style={styles.overSummaryCard}
            >
              <Text style={styles.overSummaryTitle}>End of Over {overSummary.over}</Text>
              <Text style={styles.overSummaryStats}>
                {overSummary.runs} runs ·{' '}
                {overSummary.wickets > 0 ? `${overSummary.wickets} wkt · ` : ''}CRR{' '}
                {overSummary.economy.toFixed(2)}
              </Text>
            </Animated.View>
          )}

          {banner ? (
            <View
              style={[
                styles.banner,
                {
                  borderColor:
                    banner.tone === 'danger'
                      ? colors.danger
                      : banner.tone === 'gold'
                        ? colors.accent
                        : colors.info,
                },
              ]}
            >
              <Text style={styles.bannerText}>{banner.text}</Text>
            </View>
          ) : null}

          {s && s.ballsRemaining != null && s.ballsRemaining <= 6 && s.ballsRemaining > 0 && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.finalOverBadge}>
              <Text style={styles.finalOverText}>⚡ FINAL OVER</Text>
            </Animated.View>
          )}

          <GlassSurface
            intensity={0.62}
            style={[
              styles.scoreCard,
              fastMatchUi && styles.scoreCardFast,
              s &&
                s.ballsRemaining != null &&
                s.ballsRemaining <= 6 &&
                s.ballsRemaining > 0 && { borderColor: colors.warning, borderWidth: 2 },
            ]}
          >
            <View style={styles.scoreTop}>
              {s ? (
                <View style={styles.scoreLine}>
                  {fastMatchUi ? (
                    <Text style={[styles.scoreBig, styles.scoreBigFast]}>{s.runs}</Text>
                  ) : (
                    <CountUp style={styles.scoreBig} value={s.runs} />
                  )}
                  <Text style={[styles.scoreBig, fastMatchUi && styles.scoreBigFast]}>
                    /{s.wickets}
                  </Text>
                </View>
              ) : (
                <Text style={styles.scoreBig}>0/0</Text>
              )}
              <View style={styles.scoreMeta}>
                <Text style={styles.scoreOvers}>{s ? `${s.oversText} ov` : ''}</Text>
                <Text style={styles.scoreRate}>CRR {s ? s.crr.toFixed(2) : '0.00'}</Text>
              </View>
            </View>
            {chasing && s ? (
              <>
                <View style={styles.chaseRow}>
                  <Text style={styles.chaseLine}>
                    Need <Text style={styles.chaseStrong}>{s.runsToWin}</Text> off{' '}
                    <Text style={styles.chaseStrong}>{s.ballsRemaining}</Text>
                  </Text>
                  {s.requiredRunRate != null ? (
                    <Text
                      style={[
                        styles.rrrBadge,
                        {
                          backgroundColor:
                            s.requiredRunRate > 12
                              ? colors.danger
                              : s.requiredRunRate > 9
                                ? colors.warning
                                : colors.success,
                        },
                      ]}
                    >
                      RRR {s.requiredRunRate.toFixed(2)}
                    </Text>
                  ) : null}
                </View>
                {/* RRR Pressure Bar */}
                {s.requiredRunRate != null && <RRRBar rrr={s.requiredRunRate} colors={colors} />}
              </>
            ) : null}
          </GlassSurface>

          {matchup && c ? (
            <View
              style={styles.matchupBand}
              accessible
              accessibilityLabel={`${matchup.label}. ${matchup.detail}`}
            >
              <View style={styles.matchupNames}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchupRole}>BATTER</Text>
                  <Text style={styles.matchupName} numberOfLines={1}>
                    {nameOf(c.strikerId)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.matchupEdge,
                    {
                      color:
                        matchup.edge === 'BATTER'
                          ? colors.success
                          : matchup.edge === 'BOWLER'
                            ? colors.warning
                            : colors.info,
                    },
                  ]}
                >
                  {matchup.label}
                </Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.matchupRole}>BOWLER</Text>
                  <Text style={styles.matchupName} numberOfLines={1}>
                    {nameOf(c.bowlerId)}
                  </Text>
                </View>
              </View>
              <Text style={styles.matchupDetail}>{matchup.detail}</Text>
            </View>
          ) : null}

          {/* Manager: live tactical readout + AI response (pulses each over) */}
          {!fastMatchUi && mode === 'manager' && matchRole !== 'NONE' ? (
            <LiveTacticPanel
              tactics={managerTactics}
              pulseSignal={tacticPulse}
              aiResponse={
                s && s.requiredRunRate != null && s.requiredRunRate > 10
                  ? 'Opposition attacking your plan — the required rate is climbing.'
                  : s && s.wickets >= 6
                    ? 'Batting side on the back foot — press for the tail.'
                    : 'Opposition settling into the contest.'
              }
            />
          ) : null}

          <View
            style={[styles.feed, fastMatchUi && styles.feedFast]}
            accessibilityLabel="Recent commentary"
          >
            <View style={styles.recentFeedHeader}>
              <Text style={styles.recentFeedTitle}>Recent commentary</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open ball-by-ball commentary"
                onPress={openCommentary}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>View innings</Text>
                <Icon name="chevron-forward" size={14} color={colors.primaryLight} />
              </Pressable>
            </View>
            {recentFeed.map((f) => (
              <View key={f.id} style={styles.feedRow}>
                <Text style={styles.feedLabel}>{f.label}</Text>
                <Text
                  style={[styles.feedText, { color: TONE_COLOR[f.tone] }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {f.text}
                </Text>
              </View>
            ))}
          </View>

          <>
            {/* Partnership Tracker */}
            {c && partnershipRuns > 0 ? (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={[
                  styles.partnershipBar,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text style={styles.partnershipLabel}>Partnership</Text>
                <Text style={styles.partnershipRuns}>
                  {partnershipRuns}{' '}
                  <Text style={styles.partnershipBalls}>({partnershipBalls})</Text>
                </Text>
                <Text style={styles.partnershipNames} numberOfLines={1}>
                  {nameOf(c.strikerId)} & {nameOf(c.nonStrikerId)}
                </Text>
              </Animated.View>
            ) : null}

            {c ? (
              <Card style={styles.creaseCard}>
                <CreaseRow
                  name={nameOf(c.strikerId)}
                  onStrike
                  runs={c.strikerRuns}
                  balls={c.strikerBalls}
                  isUser={c.strikerId === save.userPlayerId}
                />
                <CreaseRow
                  name={nameOf(c.nonStrikerId)}
                  runs={c.nonStrikerRuns}
                  balls={c.nonStrikerBalls}
                  isUser={c.nonStrikerId === save.userPlayerId}
                />
                <View style={styles.divider} />
                <View style={styles.bowlerRow}>
                  <Text style={styles.bowlerName} numberOfLines={1}>
                    🎯 {nameOf(c.bowlerId)}
                  </Text>
                  <Text style={styles.bowlerFig}>
                    {c.bowlerWickets}/{c.bowlerRuns} ({oversFromBalls(c.bowlerBalls)})
                  </Text>
                </View>
              </Card>
            ) : null}

            <View style={[styles.midRow, fastMatchUi && styles.midRowFast]}>
              <View style={styles.fieldWrap}>
                <FieldView
                  size={fastMatchUi ? 220 : 280}
                  lastShot={lastShot}
                  stadiumTheme={save?.seasonPassExperience?.selectedStadiumTheme}
                  animate={!fastMatchUi}
                  userBatterPosition={userBatterPosition}
                  battingPrimaryColor={battingTeam?.primaryColor}
                  battingSecondaryColor={battingTeam?.secondaryColor}
                  fieldingPrimaryColor={bowlingTeam?.primaryColor}
                  fieldingSecondaryColor={bowlingTeam?.secondaryColor}
                  fieldSetting={visibleFieldSetting}
                  conditions={liveConditions}
                />
              </View>
              <View style={styles.overCol}>
                <View style={styles.overHeader}>
                  <View>
                    <Text style={styles.overLabel}>This over</Text>
                    <Text style={styles.overNumber}>
                      Over {Math.max(1, display.overNumber + 1)}
                    </Text>
                  </View>
                  <Text style={styles.overProgress}>
                    {legalOverDots.length >= ballsPerOver
                      ? 'Over complete'
                      : `Ball ${legalOverDots.length + 1} of ${ballsPerOver}`}
                  </Text>
                </View>
                <View style={styles.dots} accessibilityLabel="Live deliveries in this over">
                  {overSlots.map((dot, index) => {
                    const next = !dot && index === legalOverDots.length;
                    return (
                      <Animated.View
                        key={dot?.id ?? `empty-${display.overNumber}-${index}`}
                        entering={dot ? FadeInDown.duration(180) : undefined}
                        style={[
                          styles.dot,
                          !dot && styles.dotEmpty,
                          next && styles.dotNext,
                          dot ? { borderColor: TONE_COLOR[dot.tone] } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dotText,
                            dot ? { color: TONE_COLOR[dot.tone] } : styles.dotTextEmpty,
                          ]}
                        >
                          {dot?.sym ?? (next ? '●' : '·')}
                        </Text>
                      </Animated.View>
                    );
                  })}
                </View>
                {extraOverDots.length > 0 ? (
                  <View style={styles.extraRow}>
                    <Text style={styles.extraLabel}>Extras</Text>
                    {extraOverDots.map((dot) => (
                      <Text
                        key={dot.id}
                        style={[styles.extraBall, { color: TONE_COLOR[dot.tone] }]}
                      >
                        {dot.sym}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </>

          {/* DRS Review decision prompt — the match loop is paused here */}
          {awaitingReview && !showDRSResult ? (
            <Animated.View
              entering={SlideInDown.duration(200)}
              style={[styles.drsPrompt, { borderColor: colors.danger }]}
            >
              <Text style={styles.drsPromptTitle}>🔴 You&apos;ve been given OUT</Text>
              <Text style={styles.drsPromptSub}>
                {drs.reviewsLeft > 0
                  ? `Review the decision? (${drs.reviewsLeft} review${drs.reviewsLeft === 1 ? '' : 's'} left)`
                  : 'No reviews remaining.'}
              </Text>
              <View style={styles.drsPromptBtns}>
                {drs.reviewsLeft > 0 ? (
                  <Pressable
                    style={[styles.drsPromptBtn, { backgroundColor: colors.info }]}
                    onPress={onDRSReview}
                  >
                    <Text style={styles.drsPromptBtnText}>🔍 Review</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.drsPromptBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={onAcceptDecision}
                >
                  <Text style={[styles.drsPromptBtnText, { color: colors.text }]}>Accept</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null}

          {/* DRS Review Result Overlay */}
          {showDRSResult && drs.lastReviewResult ? (
            <Animated.View
              entering={SlideInDown.duration(200)}
              exiting={FadeOut.duration(300)}
              style={[
                styles.drsResult,
                {
                  backgroundColor:
                    drs.lastReviewResult === 'OVERTURNED' ? colors.success : colors.danger,
                },
              ]}
            >
              <Text style={styles.drsResultIcon}>
                {drs.lastReviewResult === 'OVERTURNED' ? '✅' : '❌'}
              </Text>
              <View>
                <Text style={styles.drsResultTitle}>
                  Review{' '}
                  {drs.lastReviewResult === 'OVERTURNED' ? 'Overturned!' : 'Upheld — OUT stands'}
                </Text>
                <Text style={styles.drsResultSub}>
                  {drs.lastReviewResult === 'OVERTURNED'
                    ? 'Decision reversed — review retained'
                    : `Review lost · ${drs.reviewsLeft} remaining`}
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </Screen>
        <CelebrationOverlay
          trigger={celebration.trigger}
          kind={celebration.kind}
          theme={
            save.cosmetics?.celebration === 'pass_celebration_lights' ? 'floodlights' : 'classic'
          }
        />
        <CommentaryArchive
          visible={commentaryOpen}
          entries={commentaryEntries}
          currentInningsIndex={display.inningsIndex}
          toneColors={TONE_COLOR}
          onClose={closeCommentary}
        />
        <AchievementToast
          achievement={currentAchToast}
          onDismiss={() => {
            if (achToastIdx + 1 < pendingAchievementIds.length) {
              setAchToastIdx((i) => i + 1);
            } else {
              setAchToastIdx(0);
              clearPendingAchievements();
            }
          }}
        />
        <FirstMatchGuide
          active={
            mode === 'career' &&
            playedMatchesAllModes === 0 &&
            controlledPlayerAtCrease &&
            !firstGuideDone
          }
          onDone={() => {
            firstGuideDoneRef.current = true;
            guidePauseRef.current = false;
            setFirstGuideDone(true);
          }}
        />
      </Animated.View>
    </>
  );
}

/** Colour-coded required-run-rate pressure bar. */
function RRRBar({ rrr, colors }: { rrr: number; colors: ThemeColors }) {
  const ratio = Math.min(rrr / 20, 1); // normalise to 0-1 over 0-20 RRR
  const fillColor = rrr > 12 ? colors.danger : rrr > 9 ? colors.warning : colors.success;
  return (
    <View
      style={{
        marginTop: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: `${ratio * 100}%`,
          height: 6,
          borderRadius: 3,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

function PreparationRating({ label, value }: { label: string; value: number }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const color = value >= 72 ? colors.danger : value >= 62 ? colors.warning : colors.success;
  return (
    <View style={styles.preparationRating}>
      <Text style={[styles.preparationRatingValue, { color }]}>{value}</Text>
      <Text style={styles.preparationRatingLabel}>{label}</Text>
    </View>
  );
}

function ModeButton({
  emoji,
  title,
  onPress,
}: {
  emoji: string;
  title: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card onPress={onPress} style={styles.modeCard}>
      <Text style={styles.modeEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.modeTitle}>{title}</Text>
      </View>
    </Card>
  );
}

function CreaseRow({
  name,
  runs,
  balls,
  onStrike,
  isUser,
}: {
  name: string;
  runs: number;
  balls: number;
  onStrike?: boolean;
  isUser?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.creaseRow}>
      <Text style={[styles.creaseName, isUser && { color: colors.accent }]} numberOfLines={1}>
        {onStrike ? '🏏 ' : '   '}
        {name}
        {isUser ? ' ★' : ''}
      </Text>
      <Text style={styles.creaseStat}>
        {runs} <Text style={styles.rowFaint}>({balls})</Text>
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    requirementFooter: { gap: spacing.sm },
    requirementText: {
      color: colors.warning,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },

    // pre-match cinematic
    prematchHeroWrap: {
      position: 'relative',
      height: 180,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      borderRadius: radius.xl,
      overflow: 'hidden',
    },
    prematchHero: { width: '100%', height: '100%' },
    prematchTeamOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      padding: spacing.md,
    },
    prematchTeamEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    prematchTeamBox: { flex: 1 },
    prematchTeamAbbr: {
      color: colors.white,
      fontSize: fontSize.xxxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    prematchTeamFull: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.xs },
    prematchHomeTag: {
      color: colors.primaryLight,
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      marginTop: 2,
    },
    prematchVs: {
      color: colors.accent,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      paddingHorizontal: spacing.sm,
    },
    victoryImg: { width: '100%', height: 160, borderRadius: radius.md, marginBottom: spacing.md },
    matchSponsorRow: { marginBottom: spacing.sm },
    vsCard: { alignItems: 'center', marginTop: spacing.md },
    vsTeams: {
      color: colors.text,
      fontSize: fontSize.xxxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    vsSub: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.xs,
    },
    venueRow: {
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    venueText: {
      minWidth: 0,
      flexShrink: 1,
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    condRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    condPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    condEmoji: { fontSize: 14 },
    condText: { color: colors.textMuted, fontSize: fontSize.xs },
    surfaceBrief: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      textAlign: 'center',
      marginTop: spacing.sm,
      maxWidth: 560,
    },
    tossCard: {
      marginTop: spacing.sm,
      borderColor: colors.primary + '66',
      borderWidth: 1,
    },
    tossHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    tossTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
    },
    tossWinner: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    tossPrompt: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    coin: {
      width: 72,
      height: 72,
      alignSelf: 'center',
      marginTop: spacing.md,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: colors.accentLight,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coinText: {
      color: colors.bg,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    coinResultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    coinSmall: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.accentLight,
      backgroundColor: colors.accentDark,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    coinSmallText: {
      color: colors.bg,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
    },
    tossChoices: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    tossChoice: {
      flex: 1,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    tossChoiceActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryDark,
    },
    tossChoiceText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      textAlign: 'center',
    },
    tossChoiceTextActive: { color: colors.white },
    tossOutcome: {
      color: colors.text,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
      lineHeight: 18,
    },
    objective: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    objectiveGoal: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 4,
      textAlign: 'center',
    },
    missionPreCard: { borderColor: colors.accent + '44', borderWidth: 1.5 },
    missionPreTitle: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    missionPreName: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    missionPreGoal: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4 },
    preparationRatings: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    preparationScale: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.md,
    },
    preparationRating: {
      flexGrow: 1,
      flexBasis: 82,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    preparationRatingValue: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    preparationRatingLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 1,
    },
    preparationRatingAssessment: {
      fontSize: 10,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    preparationLine: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginTop: spacing.sm,
    },
    analysisReport: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: `${colors.accent}10`,
      gap: spacing.xs,
    },
    analysisLocked: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      gap: spacing.sm,
    },
    analysisReportTitle: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
    },
    analysisFlash: {
      color: colors.primaryLight,
      fontSize: fontSize.sm,
      lineHeight: 18,
      marginTop: spacing.sm,
    },
    managerPlanSummary: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      lineHeight: 20,
      marginTop: spacing.md,
      padding: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    missionPreReward: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      marginTop: spacing.sm,
    },
    missionPreRewardText: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    pickLabel: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    modeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    modeEmoji: { fontSize: 26 },
    modeTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    modeDesc: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },

    // ── mission card ──
    // banner
    banner: {
      borderWidth: 1.5,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    bannerText: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      textAlign: 'center',
    },

    // scoreboard
    scoreCard: { marginTop: spacing.xs },
    scoreCardFast: { paddingVertical: spacing.sm },
    scoreTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    scoreLine: { flexDirection: 'row', alignItems: 'flex-end' },
    scoreBig: {
      color: colors.text,
      fontSize: fontSize.display,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    scoreBigFast: {
      fontSize: fontSize.xxl,
      lineHeight: 32,
    },
    scoreMeta: { alignItems: 'flex-end' },
    scoreOvers: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
    scoreRate: { color: colors.textFaint, fontSize: fontSize.sm },
    chaseLine: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
    chaseStrong: { color: colors.accent, fontWeight: fontWeight.bold },
    matchupBand: {
      backgroundColor: colors.surfaceAlt,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    matchupNames: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
    matchupRole: { color: colors.textFaint, fontSize: 9, fontWeight: fontWeight.bold },
    matchupName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    matchupEdge: {
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      maxWidth: '38%',
      textAlign: 'center',
    },
    matchupDetail: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.xs,
      textAlign: 'center',
    },

    // crease
    creaseCard: { marginTop: spacing.md },
    creaseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 3,
    },
    creaseName: {
      color: colors.text,
      fontSize: fontSize.sm,
      flex: 1,
      fontWeight: fontWeight.medium,
    },
    creaseStat: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    bowlerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 2,
    },
    bowlerName: { color: colors.textMuted, fontSize: fontSize.sm, flex: 1 },
    bowlerFig: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

    // field + over dots
    midRow: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.md,
      minHeight: 280,
    },
    midRowFast: { minHeight: 220, marginTop: spacing.sm },
    stadiumScene: {
      marginTop: spacing.md,
      marginHorizontal: -spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      overflow: 'hidden',
    },
    stadiumOverRail: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceMuted,
    },
    fieldWrap: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    overCol: {
      alignSelf: 'stretch',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
    },
    overHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    overLabel: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    overNumber: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    overProgress: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    dots: { flexDirection: 'row', gap: 6 },
    dot: {
      flex: 1,
      maxWidth: 46,
      height: 34,
      borderRadius: 17,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      backgroundColor: colors.surface,
    },
    dotEmpty: {
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    dotNext: {
      borderStyle: 'solid',
      borderColor: colors.primary,
      backgroundColor: colors.primary + '1F',
    },
    dotText: { fontSize: fontSize.xs, fontWeight: fontWeight.black },
    dotTextEmpty: { color: colors.textFaint },
    extraRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    extraLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    extraBall: { fontSize: fontSize.xs, fontWeight: fontWeight.black },
    // feed
    feed: { marginTop: spacing.md, paddingBottom: spacing.md },
    feedFast: { marginTop: spacing.sm, paddingBottom: spacing.xs },
    recentFeedHeader: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.borderStrong,
    },
    recentFeedTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
    },
    viewAllButton: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingLeft: spacing.sm,
    },
    viewAllText: { color: colors.primaryLight, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    feedRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 48,
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      overflow: 'hidden',
    },
    feedLabel: { color: colors.textFaint, fontSize: fontSize.xs, width: 34, paddingTop: 2 },
    feedText: { fontSize: fontSize.sm, flex: 1, lineHeight: 18, minHeight: 36 },

    // RRR / chase
    chaseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    rrrBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    rrrBadgeText: { color: colors.white, fontSize: fontSize.xs, fontWeight: fontWeight.black },
    rrrBar: {
      marginTop: spacing.sm,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    rrrFill: { height: 6, borderRadius: 3 },

    // Partnership
    partnershipBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginTop: spacing.sm,
    },
    partnershipLabel: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    partnershipRuns: {
      color: colors.primaryLight,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
    },
    partnershipBalls: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.regular,
    },
    partnershipNames: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      flex: 1,
      textAlign: 'right',
    },

    // DRS
    drsBtn: {
      borderWidth: 1.5,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      alignItems: 'center',
    },
    drsBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.black, letterSpacing: 1 },
    drsBtnSub: { fontSize: 9, letterSpacing: 0.5 },
    drsResult: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    drsResultIcon: { fontSize: 28 },
    drsResultTitle: { color: colors.white, fontSize: fontSize.md, fontWeight: fontWeight.black },
    drsResultSub: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.xs, marginTop: 2 },
    drsPrompt: {
      borderWidth: 1.5,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    drsPromptTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.black },
    drsPromptSub: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      marginBottom: spacing.sm,
    },
    drsPromptBtns: { flexDirection: 'row', gap: spacing.sm },
    drsPromptBtn: {
      flex: 1,
      alignItems: 'center',
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
    },
    drsPromptBtnText: { color: colors.white, fontSize: fontSize.sm, fontWeight: fontWeight.black },

    // intent
    intentPrompt: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    intentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    intentBtn: {
      width: '48%',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    intentEmoji: { fontSize: 22 },
    intentLabel: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    intentDesc: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
    tacticPreLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    tacticPreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    tacticPreChip: {
      minWidth: '31%',
      flexGrow: 1,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      alignItems: 'center',
    },
    tacticPreChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    tacticPreChipText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    tacticPreChipTextActive: { color: colors.white },
    fieldRestrictionText: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    fieldRestrictionCallout: {
      alignSelf: 'stretch',
      minHeight: 36,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldRestrictionCalloutText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      fontWeight: fontWeight.semibold,
      textAlign: 'center',
    },
    tacticChipDisabled: { opacity: 0.35 },

    // in-match tactics
    tacticsPanel: { marginBottom: spacing.sm, gap: spacing.sm },
    tacticsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      justifyContent: 'center',
    },
    tacticChip: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    tacticChipText: { color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    footerBtn: { flexGrow: 1, flexShrink: 1, minWidth: 104, maxWidth: 190 },
    pauseControl: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 104,
      maxWidth: 190,
      minHeight: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    pauseControlText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      fontFamily: fonts.bold,
      letterSpacing: 0.3,
    },
    pausePressed: { opacity: 0.82 },
    pauseActive: {
      borderWidth: 1.5,
      borderColor: colors.warning,
      backgroundColor: colors.surfaceAlt,
    },

    // Batting stance (pre-match + in-match)
    stancePreLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    stancePreDesc: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
      fontStyle: 'italic',
    },
    stanceChips: { flexDirection: 'row', gap: spacing.sm },
    stanceChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    stanceChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    stanceChipEmoji: { fontSize: 18 },
    stanceChipLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      marginTop: 3,
    },
    stanceChipLabelActive: { color: colors.white },

    // In-match stance panel (change during play)
    stancePanel: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.primary + '55',
    },
    stancePanelTitle: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },

    // Stance indicator button (footer — replaces Tactics for career batting)
    stanceIndicatorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    stanceIndicatorEmoji: { fontSize: 16 },
    stanceIndicatorLabel: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },

    // Active intent button (selected stance)
    intentBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryDark + '33' },
    speedRow: {
      flexDirection: 'row',
      gap: 4,
      flexGrow: 1,
      flexShrink: 1,
      justifyContent: 'center',
      minWidth: 176,
    },
    speedBtn: {
      flex: 1,
      minWidth: 54,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    speedBtnActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    speedText: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textAlign: 'center',
    },
    speedTextActive: { color: colors.white },
    overSummaryCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: spacing.sm,
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    overSummaryTitle: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    overSummaryStats: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginTop: 2,
    },

    // summary (shared)
    resultCard: { alignItems: 'center' },
    resultBig: { fontSize: fontSize.xxxl, fontWeight: fontWeight.black, fontFamily: fonts.display },
    margin: { color: colors.text, fontSize: fontSize.md, marginTop: spacing.xs },
    potm: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.sm,
    },
    rating: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.sm,
    },
    ratingBlock: {
      alignItems: 'center',
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    ratingStars: { flexDirection: 'row', gap: 3, marginBottom: spacing.xs },
    ratingStar: { fontSize: 18 },
    ratingNum: {
      color: colors.accent,
      fontSize: 36,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      lineHeight: 40,
    },
    ratingLabel: {
      color: colors.textFaint,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginTop: 2,
    },
    ratingImpact: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    tacticProofCard: {
      width: '100%',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    tacticProofTitle: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    tacticProofText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
    objCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    objCheck: { fontSize: 22, fontWeight: fontWeight.black },
    objBonus: {
      color: colors.success,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    objLine: { fontSize: fontSize.sm, marginTop: spacing.xs, fontWeight: fontWeight.semibold },
    callup: {
      color: colors.accent,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
      fontWeight: fontWeight.semibold,
      textAlign: 'center',
    },
    rewardPill: {
      marginTop: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
    },
    rewardText: { color: colors.accent, fontWeight: fontWeight.bold },
    resultFooter: { gap: spacing.sm },
    resultFooterChoices: { flexDirection: 'row', gap: spacing.sm },
    resultFooterChoice: { flex: 1 },
    adDone: {
      color: colors.success,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.md,
    },
    adError: {
      color: colors.warning,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    whyCard: { borderColor: colors.info, borderWidth: 1, marginTop: spacing.lg },
    whyEyebrow: {
      color: colors.info,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
    },
    whyNarrative: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      marginVertical: spacing.sm,
    },
    decisionEvidence: {
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
      gap: spacing.sm,
    },
    decisionRow: { gap: 2 },
    decisionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    decisionTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      flex: 1,
    },
    decisionConfidence: { color: colors.info, fontSize: 10, fontWeight: fontWeight.bold },
    decisionEvidenceText: { color: colors.textFaint, fontSize: 10, lineHeight: 15 },
    potmReason: {
      backgroundColor: colors.accent + '14',
      borderRadius: radius.sm,
      marginTop: spacing.md,
      padding: spacing.sm,
    },
    potmReasonLabel: { color: colors.accent, fontSize: 10, fontWeight: fontWeight.black },
    potmReasonText: { color: colors.text, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    progressionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    progressionItem: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      minWidth: '47%',
      padding: spacing.sm,
    },
    progressionLabel: { color: colors.textFaint, fontSize: 10, fontWeight: fontWeight.bold },
    progressionValue: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 2 },
    innHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    innTeam: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy, flex: 1 },
    innScore: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
    innOvers: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.regular },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    rowName: { color: colors.textMuted, fontSize: fontSize.sm, flex: 1 },
    rowStat: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    rowFaint: { color: colors.textFaint, fontWeight: fontWeight.regular },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
    },
    fullScorecardButton: { marginTop: spacing.lg },
    fullScorecardTitle: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    fullScorecardCard: { marginBottom: spacing.md },
    scorecardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 30,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderStrong,
    },
    scorecardBowlingHeader: { marginTop: spacing.md },
    scorecardHeaderName: {
      flex: 1,
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
    },
    scorecardHeaderStat: {
      width: 35,
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textAlign: 'right',
    },
    scorecardPlayerBlock: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: 5,
    },
    scorecardDataRow: { flexDirection: 'row', alignItems: 'center', minHeight: 25 },
    scorecardPlayerName: {
      flex: 1,
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      paddingRight: spacing.xs,
    },
    scorecardStat: {
      width: 35,
      color: colors.text,
      fontSize: 10,
      textAlign: 'right',
    },
    scorecardDismissal: { color: colors.textFaint, fontSize: 9, marginTop: 1 },
    scorecardTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.xs,
    },
    scorecardTotalLabel: { color: colors.textMuted, fontSize: fontSize.xs },
    scorecardTotalValue: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    analysisHeader: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    analysisCard: { alignItems: 'center', marginTop: spacing.md },
    analysisTitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginBottom: spacing.sm,
    },

    // Post-match insight card
    insightCard: { marginTop: spacing.lg },
    insightTitle: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
      marginBottom: spacing.sm,
    },
    insightLine: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: 4 },

    // Last-over tension badge
    finalOverBadge: {
      alignSelf: 'center',
      backgroundColor: colors.warning + '22',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
    finalOverText: {
      color: colors.warning,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      letterSpacing: 2,
      textTransform: 'uppercase' as const,
    },
  });
