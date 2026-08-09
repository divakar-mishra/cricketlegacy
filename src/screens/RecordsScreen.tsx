import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Card, LeagueTable, ProgressBar, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import {
  AchievementDef,
  achievementGemReward,
  achievementProgress,
  achievementsForMode,
  earnedAchievements,
  getTierPoints,
  maxGamerscore,
  pendingAchievements,
  totalGamerscore,
} from '../game/achievements';
import {
  MANAGER_HOF_MIN_SCORE,
  managerLegacyScore,
  qualifiesForManagerHall,
  summarizeManager,
} from '../game/hallOfFame';
import {
  activeManagerRecords,
  ManagerLeaderboardKind,
  ManagerLeaderboardRow,
  rankManagerRows,
} from '../game/managerRecords';
import { standings } from '../game/season';
import { emptyStats } from '../game/stats';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import { useHallOfFame } from '../state/hofStore';
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

type HofTab = 'players' | 'managers';
type MainTab = 'records' | 'achievements' | 'hof';
type StatView = 'all' | 'domestic' | 'international' | 'T20' | 'ODI' | 'TEST';

const TIER_COLOR: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#B8BEC5',
  gold: '#E9B23B',
  platinum: '#B4E4FF',
};

export function RecordsScreen({ navigation }: ScreenProps<'Records'>) {
  const save = useCareer((s) => s.save);
  const hof = useHallOfFame((s) => s.board);
  const loadHof = useHallOfFame((s) => s.load);
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [statView, setStatView] = useState<StatView>('all');
  const [hofTab, setHofTab] = useState<HofTab>(save?.mode === 'manager' ? 'managers' : 'players');
  const [mainTab, setMainTab] = useState<MainTab>('records');
  const [achFilter, setAchFilter] = useState<'all' | 'earned' | 'locked'>('all');
  const [managerStatKind, setManagerStatKind] = useState<ManagerLeaderboardKind>('runs');

  useEffect(() => {
    void loadHof();
  }, [loadHof]);

  useEffect(() => {
    setHofTab(save?.mode === 'manager' ? 'managers' : 'players');
  }, [save?.mode]);

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="Records" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active save.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const rec = save.records;
  const earned = earnedAchievements(save);
  const pending = pendingAchievements(save);
  const achievementCatalog = achievementsForMode(save);
  const totalAch = achievementCatalog.length;
  const earnedCount = earned.length;
  const gamerscore = totalGamerscore(save);
  const gamerscoreMax = maxGamerscore(save);
  const leagueRows = save.mode === 'manager' ? standings(save) : [];
  const managerRecords = save.mode === 'manager' ? activeManagerRecords(save) : null;
  const managerRankedRows = managerRecords
    ? rankManagerRows(managerRecords.rows, managerStatKind)
    : [];
  const activeManagerEntry = summarizeManager(save);
  const activeManagerScore = activeManagerEntry ? managerLegacyScore(activeManagerEntry) : 0;
  const managerHofEntries =
    activeManagerEntry &&
    qualifiesForManagerHall(activeManagerEntry) &&
    !hof.managers.some((entry) => entry.saveId === save.id)
      ? [activeManagerEntry, ...hof.managers]
      : hof.managers;

  const achList: AchievementDef[] =
    achFilter === 'earned' ? earned : achFilter === 'locked' ? pending : achievementCatalog;

  const tabCfg: { key: MainTab; label: string }[] = [
    { key: 'records', label: 'Records' },
    { key: 'achievements', label: `Achievements (${earnedCount})` },
    { key: 'hof', label: 'Hall of Fame' },
  ];

  return (
    <Screen scroll>
      <ScreenHeader title="Records & Glory" onBack={() => navigation.goBack()} />

      {/* Main tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.mainTabRow}
        contentContainerStyle={styles.mainTabContent}
      >
        {tabCfg.map((t) => {
          const sel = mainTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setMainTab(t.key)}
              style={[styles.mainTab, sel && styles.mainTabActive]}
            >
              <Text style={[styles.mainTabText, sel && styles.mainTabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── RECORDS TAB ─────────────────────────────────────────────── */}
      {mainTab === 'records' && (
        <>
          {/* Verified player numbers, split by career scope and format. */}
          {(() => {
            if (save.mode !== 'career' || !save.userPlayerId) return null;
            const me = save.players[save.userPlayerId];
            if (!me) return null;
            const statOptions: { key: StatView; label: string }[] = [
              { key: 'all', label: 'Overall' },
              { key: 'domestic', label: 'Domestic' },
              { key: 'international', label: 'International' },
              { key: 'T20', label: 'T20' },
              { key: 'ODI', label: 'One-Day' },
              { key: 'TEST', label: 'First-Class' },
            ];
            const cs =
              statView === 'all'
                ? me.careerStats
                : statView === 'domestic'
                  ? me.domesticStats
                  : statView === 'international'
                    ? me.internationalStats
                    : me.formatStats?.[statView];
            const verified = cs ?? emptyStats();
            const dismissals = Math.max(0, verified.matches - verified.notOuts);
            const avg =
              dismissals > 0
                ? (verified.runs / dismissals).toFixed(1)
                : verified.runs > 0
                  ? verified.runs.toFixed(1)
                  : '—';
            const sr =
              verified.balls > 0 ? ((verified.runs / verified.balls) * 100).toFixed(1) : '—';
            const items: { label: string; value: string; accent?: string }[] = [
              { label: 'Matches', value: String(verified.matches) },
              { label: 'Runs', value: String(verified.runs), accent: colors.primaryLight },
              { label: 'High Score', value: String(verified.highScore), accent: colors.accent },
              { label: 'Average', value: avg },
              { label: 'Strike Rate', value: sr },
              { label: '100s / 50s', value: `${verified.hundreds} / ${verified.fifties}` },
              { label: 'Wickets', value: String(verified.wickets), accent: colors.info },
              {
                label: 'Best Bowling',
                value: verified.bestBowling || '—',
                accent: colors.info,
              },
              { label: 'Catches', value: String(verified.catches) },
            ];
            return (
              <Animated.View entering={FadeInDown.duration(260)}>
                <Text style={styles.section}>Your Career</Text>
                <View style={styles.statViewGrid}>
                  {statOptions.map((option) => {
                    const selected = statView === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setStatView(option.key)}
                        style={[styles.statViewButton, selected && styles.statViewButtonActive]}
                      >
                        <Text
                          style={[
                            styles.statViewButtonText,
                            selected && styles.statViewButtonTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Card>
                  <View style={styles.careerBestHeader}>
                    <Text style={styles.careerBestName} numberOfLines={1}>
                      {me.name}
                    </Text>
                    <Text style={styles.careerBestScope}>
                      {statOptions.find((option) => option.key === statView)?.label}
                    </Text>
                  </View>
                  <View style={styles.careerBestGrid}>
                    {items.map((it) => (
                      <View key={it.label} style={styles.careerBestItem}>
                        <Text
                          style={[styles.careerBestVal, it.accent ? { color: it.accent } : null]}
                          numberOfLines={1}
                        >
                          {it.value}
                        </Text>
                        <Text style={styles.careerBestLabel} numberOfLines={1}>
                          {it.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {(statView === 'domestic' || statView === 'international') &&
                  save.statsScopeTrackingStartedAt ? (
                    <Text style={styles.scopeTrackingNote}>
                      Scoped totals are exact from the records upgrade onward; Overall preserves the
                      complete career total.
                    </Text>
                  ) : null}
                </Card>
              </Animated.View>
            );
          })()}

          {save.mode === 'manager' && managerRecords ? (
            <Animated.View entering={FadeInDown.duration(270).delay(20)}>
              <Text style={styles.section}>{managerRecords.competitionLabel} Season Leaders</Text>
              <Card style={styles.managerRecordsPanel}>
                <Text style={styles.tableHint}>
                  Only {managerRecords.competitionLabel} performances from the current season are
                  included. Players from your managed team are highlighted in gold.
                </Text>
                <View style={styles.managerStatTabs}>
                  {(
                    [
                      ['runs', 'Most Runs'],
                      ['wickets', 'Most Wickets'],
                      ['highScore', 'High Scores'],
                      ['bestBowling', 'Best Bowling'],
                    ] as [ManagerLeaderboardKind, string][]
                  ).map(([kind, label]) => {
                    const selected = managerStatKind === kind;
                    return (
                      <Pressable
                        key={kind}
                        onPress={() => setManagerStatKind(kind)}
                        style={[styles.managerStatTab, selected && styles.managerStatTabSelected]}
                      >
                        <Text
                          style={[
                            styles.managerStatTabText,
                            selected && styles.managerStatTabTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {managerRankedRows.length ? (
                  <View style={styles.managerLeaderboard}>
                    {managerRankedRows.map((row, index) => (
                      <ManagerRecordRow
                        key={row.playerId}
                        row={row}
                        rank={index + 1}
                        kind={managerStatKind}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.empty}>
                    No exact {managerRecords.competitionLabel} performances have been recorded in
                    this season yet. This table updates after the next completed match.
                  </Text>
                )}
              </Card>
            </Animated.View>
          ) : null}

          {save.mode === 'manager' && leagueRows.length > 0 && (
            <Animated.View entering={FadeInDown.duration(270).delay(20)}>
              <Text style={styles.section}>League Table</Text>
              <Card>
                <Text style={styles.tableHint}>
                  P W L T NR Pts NRR are rebuilt from the canonical standings.
                </Text>
                <LeagueTable
                  rows={leagueRows}
                  teams={save.teams}
                  highlightTeamId={save.userTeamId}
                />
              </Card>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(300).delay(40)}>
            <Text style={styles.section}>🏆 Trophy Cabinet</Text>
            {save.mode === 'manager' ? (
              (save.leagueTitles ?? 0) + (save.cupWins ?? 0) + (save.continentalTitles ?? 0) > 0 ? (
                <View style={styles.trophyGrid}>
                  {(save.leagueTitles ?? 0) > 0 ? (
                    <View style={styles.trophyCard}>
                      <Text style={styles.trophyIcon}>🏆</Text>
                      <Text style={styles.trophyName}>League titles</Text>
                      <Text style={styles.trophyYear}>{save.leagueTitles}</Text>
                    </View>
                  ) : null}
                  {(save.cupWins ?? 0) > 0 ? (
                    <View style={styles.trophyCard}>
                      <Text style={styles.trophyIcon}>🏆</Text>
                      <Text style={styles.trophyName}>Cup wins</Text>
                      <Text style={styles.trophyYear}>{save.cupWins}</Text>
                    </View>
                  ) : null}
                  {(save.continentalTitles ?? 0) > 0 ? (
                    <View style={styles.trophyCard}>
                      <Text style={styles.trophyIcon}>🏆</Text>
                      <Text style={styles.trophyName}>Continental titles</Text>
                      <Text style={styles.trophyYear}>{save.continentalTitles}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Card>
                  <Text style={styles.empty}>No trophies won by your club yet.</Text>
                </Card>
              )
            ) : rec?.titles.length ? (
              <View style={styles.trophyGrid}>
                {rec.titles.map((t, i) => (
                  <View key={i} style={styles.trophyCard}>
                    <Text style={styles.trophyIcon}>🏆</Text>
                    <Text style={styles.trophyName} numberOfLines={2}>
                      {t.name}
                    </Text>
                    <Text style={styles.trophyYear}>{t.year}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Card>
                <Text style={styles.empty}>No champions crowned yet — go win some silverware.</Text>
              </Card>
            )}
          </Animated.View>
        </>
      )}

      {/* ── ACHIEVEMENTS TAB ────────────────────────────────────────── */}
      {mainTab === 'achievements' && (
        <>
          <Animated.View entering={FadeInDown.duration(280)}>
            <Card style={styles.achSummaryCard}>
              {/* Gamerscore prominent display */}
              <View style={styles.gamerscoreRow}>
                <View style={styles.gamerscoreLeft}>
                  <Text style={styles.gamerscoreValue}>{gamerscore}</Text>
                  <Text style={styles.gamerscoreLabel}>GAMERSCORE</Text>
                </View>
                <View style={styles.gamerscoreDivider} />
                <View style={{ flex: 1, paddingLeft: spacing.md }}>
                  <ProgressBar
                    value={gamerscoreMax > 0 ? gamerscore / gamerscoreMax : 0}
                    color={colors.accent}
                  />
                  <Text style={styles.gamerscoreMax}>
                    {gamerscore} / {gamerscoreMax} pts
                  </Text>
                </View>
              </View>
              <View style={[styles.achSummaryRow, { marginTop: spacing.md }]}>
                <View style={styles.achSummaryItem}>
                  <Text style={styles.achSummaryNum}>{earnedCount}</Text>
                  <Text style={styles.achSummaryLabel}>Earned</Text>
                </View>
                <View style={styles.achSummaryDivider} />
                <View style={styles.achSummaryItem}>
                  <Text style={styles.achSummaryNum}>{totalAch}</Text>
                  <Text style={styles.achSummaryLabel}>Total</Text>
                </View>
                <View style={styles.achSummaryDivider} />
                <View style={styles.achSummaryItem}>
                  <Text style={[styles.achSummaryNum, { color: colors.accent }]}>
                    {Math.round((earnedCount / totalAch) * 100)}%
                  </Text>
                  <Text style={styles.achSummaryLabel}>Complete</Text>
                </View>
              </View>
              {/* Completion-based prestige label (no fabricated global player base). */}
              <Text style={styles.achGlobalRank}>
                {(() => {
                  const pct = totalAch > 0 ? earnedCount / totalAch : 0;
                  if (pct >= 0.9) return '🏆 Legendary completionist';
                  if (pct >= 0.6) return '🥇 Elite collector';
                  if (pct >= 0.3) return '🥈 Rising achiever';
                  return '🎯 Just getting started — keep earning achievements';
                })()}
              </Text>
            </Card>
          </Animated.View>

          <View style={styles.chips}>
            {(['all', 'earned', 'locked'] as const).map((f) => {
              const sel = achFilter === f;
              const label = f === 'all' ? 'All' : f === 'earned' ? '✓ Earned' : '🔒 Locked';
              return (
                <Pressable
                  key={f}
                  onPress={() => setAchFilter(f)}
                  style={[styles.chip, sel && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {achList.map((a, idx) => {
            const isEarned = earned.some((e) => e.id === a.id);
            const progress = achievementProgress(save, a.id);
            const tierColor = TIER_COLOR[a.tier] ?? TIER_COLOR.gold;
            const isHidden = a.hidden && !isEarned;
            const isPlatinum = a.tier === 'platinum';

            // Achievement chain: find the next step
            const CHAINS: Record<string, string> = {
              bat_first_run: 'bat_first_fifty',
              bat_first_fifty: 'bat_first_hundred',
              bat_first_hundred: 'bat_5_hundreds',
              bat_1000_runs: 'bat_5000_runs',
              bat_5000_runs: 'bat_10000_runs',
              bat_50_fours: 'bat_100_fours',
              bat_30_sixes: 'bat_100_sixes',
              bowl_first_wicket: 'bowl_five_fer',
              bowl_five_fer: 'bowl_ten_fer',
              bowl_100_wickets: 'bowl_300_wickets',
              bowl_300_wickets: 'bowl_500_wickets',
              career_domestic: 'career_franchise',
              career_franchise: 'career_intl_debut',
              career_intl_debut: 'career_50_caps',
              career_50_caps: 'career_100_caps',
            };
            const nextChainId = isEarned ? CHAINS[a.id] : null;
            const nextChain = nextChainId
              ? achievementCatalog.find((x) => x.id === nextChainId)
              : null;
            const nextChainEarned = nextChain ? earned.some((e) => e.id === nextChain.id) : false;

            return (
              <Animated.View
                key={a.id}
                entering={FadeInDown.duration(240).delay(Math.min(idx * 18, 400))}
              >
                <View
                  style={[
                    styles.achCard,
                    isEarned && styles.achCardEarned,
                    { borderLeftColor: tierColor },
                    isPlatinum && isEarned && styles.achCardPlatinum,
                  ]}
                >
                  <View
                    style={[
                      styles.achIconWrap,
                      { backgroundColor: isEarned ? `${tierColor}22` : colors.surfaceMuted },
                    ]}
                  >
                    <Text style={[styles.achIcon, !isEarned && styles.achIconLocked]}>
                      {isHidden ? '❓' : a.icon}
                    </Text>
                  </View>
                  <View style={styles.achBody}>
                    <View style={styles.achTitleRow}>
                      <Text
                        style={[styles.achTitle, !isEarned && styles.achTitleLocked]}
                        numberOfLines={1}
                      >
                        {isHidden ? '???' : a.title}
                      </Text>
                      <View
                        style={[
                          styles.tierBadge,
                          { borderColor: tierColor, backgroundColor: `${tierColor}1A` },
                        ]}
                      >
                        <Text style={[styles.tierText, { color: tierColor }]}>
                          {isPlatinum ? '✦ ' : ''}
                          {a.tier.toUpperCase()} · {getTierPoints(a.tier)}pts · +
                          {achievementGemReward(a.tier)}💎
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.achDesc} numberOfLines={2}>
                      {isHidden ? 'Keep playing to discover this achievement.' : a.description}
                    </Text>
                    {progress !== null && !isEarned && (
                      <View>
                        <ProgressBar value={progress} color={tierColor} style={{ marginTop: 4 }} />
                        <Text style={[styles.achProgress, { color: tierColor }]}>
                          {Math.round(progress * 100)}%
                        </Text>
                      </View>
                    )}
                    {/* Chain indicator */}
                    {nextChain && !nextChainEarned && (
                      <View style={styles.achChainRow}>
                        <Text style={styles.achChainArrow}>→</Text>
                        <Text style={styles.achChainNext}>Next: {nextChain.title}</Text>
                        <Text style={styles.achChainIcon}>{nextChain.icon}</Text>
                      </View>
                    )}
                  </View>
                  {isEarned && (
                    <Text style={[styles.achCheck, { color: tierColor }]}>
                      {isPlatinum ? '✦' : '✓'}
                    </Text>
                  )}
                </View>
              </Animated.View>
            );
          })}
        </>
      )}

      {/* ── HALL OF FAME TAB ─────────────────────────────────────────── */}
      {mainTab === 'hof' && (
        <>
          <Animated.View entering={FadeInDown.duration(280)}>
            {/* HoF Header Banner */}
            <View style={styles.hofHeader}>
              <View style={styles.hofMonogram}>
                <Text style={styles.hofMonogramText}>HOF</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.hofHeaderTitle}>Hall of Fame</Text>
                <Text style={styles.hofHeaderSub}>
                  Player and manager legacies are ranked separately across saved careers.
                </Text>
              </View>
            </View>

            <View style={styles.chips}>
              {(['players', 'managers'] as HofTab[]).map((t) => {
                const sel = hofTab === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setHofTab(t)}
                    style={[styles.chip, sel && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                      {t === 'players' ? 'Player Careers' : 'Manager Careers'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {hofTab === 'managers' && activeManagerEntry ? (
            <Card style={styles.managerQualification}>
              <View style={styles.managerQualificationHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.managerQualificationTitle}>Current Manager Career</Text>
                  <Text style={styles.managerQualificationClub} numberOfLines={1}>
                    {activeManagerEntry.club}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.managerQualificationStatus,
                    {
                      color: qualifiesForManagerHall(activeManagerEntry)
                        ? colors.success
                        : colors.warning,
                    },
                  ]}
                >
                  {qualifiesForManagerHall(activeManagerEntry) ? 'INDUCTED' : 'BUILDING'}
                </Text>
              </View>
              <View style={styles.managerQualificationStats}>
                <HofStat
                  label="Trophies"
                  value={String(activeManagerEntry.trophies)}
                  accent={colors.accent}
                />
                <HofStat
                  label="Promotions"
                  value={String(activeManagerEntry.promotions)}
                  accent={colors.primaryLight}
                />
                <HofStat
                  label="Win Rate"
                  value={`${activeManagerEntry.winRate ?? 0}%`}
                  accent={colors.success}
                />
                <HofStat
                  label="Legends"
                  value={String(activeManagerEntry.legendsProduced ?? 0)}
                  accent={colors.info}
                />
              </View>
              <ProgressBar
                value={Math.min(1, activeManagerScore / MANAGER_HOF_MIN_SCORE)}
                color={
                  qualifiesForManagerHall(activeManagerEntry) ? colors.success : colors.warning
                }
                style={{ marginTop: spacing.sm }}
              />
              <Text style={styles.managerQualificationNote}>
                Hall score {Math.round(activeManagerScore)} / {MANAGER_HOF_MIN_SCORE}. A trophy or
                promotion grants immediate qualification; league finishes, win rate and legendary
                players also build the score.
              </Text>
            </Card>
          ) : null}

          {hofTab === 'players' ? (
            hof.players.length ? (
              hof.players.map((e, i) => {
                const isFirst = i === 0;
                const isTop3 = i < 3;
                const isActive = e.saveId === save.id;
                const rankMeta = [
                  {
                    color: '#E9B23B',
                    bg: ['#F7D06E', '#8A5D08'] as [string, string],
                    icon: '👑',
                    label: 'LEGEND',
                  },
                  {
                    color: '#C0C7D0',
                    bg: ['#D8DDE3', '#5E6570'] as [string, string],
                    icon: '🥈',
                    label: 'ELITE',
                  },
                  {
                    color: '#CD7F32',
                    bg: ['#E8A065', '#7A4020'] as [string, string],
                    icon: '🥉',
                    label: 'VETERAN',
                  },
                ][i] ?? {
                  color: colors.textFaint,
                  bg: [colors.surface, colors.surfaceMuted] as [string, string],
                  icon: `#${i + 1}`,
                  label: '',
                };

                if (isFirst) {
                  // Full Legend Card for #1
                  return (
                    <Animated.View
                      key={e.saveId}
                      entering={FadeInDown.duration(350).delay(0)}
                      style={styles.legendCardWrap}
                    >
                      <LinearGradient colors={['#3A2800', '#1A1000']} style={styles.legendCard}>
                        {/* Gold shimmer border */}
                        <LinearGradient
                          colors={['#F7D06E', '#C6902A', '#F7D06E']}
                          style={styles.legendBorderTop}
                        />

                        <View style={styles.legendHeader}>
                          <View style={styles.legendCrown}>
                            <Text style={styles.legendCrownIcon}>👑</Text>
                          </View>
                          <View style={{ flex: 1, marginLeft: spacing.md }}>
                            <Text style={styles.legendRankLabel}>GREATEST OF ALL TIME</Text>
                            <Text style={styles.legendName} numberOfLines={1}>
                              {e.name}
                            </Text>
                            {e.retired && (
                              <Text style={styles.legendRetiredBadge}>🎖️ RETIRED LEGEND</Text>
                            )}
                            {isActive && (
                              <Text
                                style={[styles.legendRetiredBadge, { color: colors.primaryLight }]}
                              >
                                ⚡ ACTIVE
                              </Text>
                            )}
                          </View>
                          <View style={styles.legendOvr}>
                            <Text style={styles.legendOvrVal}>{e.overall}</Text>
                            <Text style={styles.legendOvrLabel}>OVR</Text>
                          </View>
                        </View>

                        <View style={styles.legendStats}>
                          {[
                            { label: 'RUNS', value: String(e.runs), icon: '🏏' },
                            { label: 'WICKETS', value: String(e.wickets), icon: '🎯' },
                            { label: 'HIGH SCORE', value: String(e.highScore), icon: '💯' },
                            { label: 'CENTURIES', value: String(e.hundreds ?? 0), icon: '💎' },
                            { label: 'CAPS', value: String(e.caps), icon: '🧢' },
                            { label: 'TITLES', value: String(e.titles ?? 0), icon: '🏆' },
                          ].map((s) => (
                            <View key={s.label} style={styles.legendStatItem}>
                              <Text style={styles.legendStatIcon}>{s.icon}</Text>
                              <Text style={styles.legendStatValue}>{s.value}</Text>
                              <Text style={styles.legendStatLabel}>{s.label}</Text>
                            </View>
                          ))}
                        </View>

                        <Text style={styles.legendSeasons}>
                          {e.seasons} season{e.seasons !== 1 ? 's' : ''} · The benchmark for all who
                          follow.
                        </Text>
                      </LinearGradient>
                    </Animated.View>
                  );
                }

                return (
                  <Animated.View key={e.saveId} entering={FadeInDown.duration(280).delay(i * 50)}>
                    <View
                      style={[
                        styles.hofPlaque,
                        isTop3 && { borderColor: rankMeta.color, borderWidth: 1.5 },
                        isActive && { borderColor: colors.primary, borderWidth: 2 },
                      ]}
                    >
                      <View
                        style={[styles.hofRankBadge, { backgroundColor: rankMeta.color + '22' }]}
                      >
                        <Text style={[styles.hofRankNum, { color: rankMeta.color }]}>
                          {rankMeta.icon}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.hofNameRow}>
                          <Text
                            style={[
                              styles.hofName,
                              { color: isTop3 ? rankMeta.color : colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {e.name}
                          </Text>
                          {e.retired ? (
                            <Text
                              style={[
                                styles.hofRetiredBadge,
                                { color: rankMeta.color, borderColor: rankMeta.color },
                              ]}
                            >
                              {rankMeta.label}
                            </Text>
                          ) : null}
                          {isActive ? (
                            <Text
                              style={[
                                styles.hofRetiredBadge,
                                { color: colors.primary, borderColor: colors.primary },
                              ]}
                            >
                              Active
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.hofStats}>
                          <HofStat
                            label="Runs"
                            value={String(e.runs)}
                            accent={colors.primaryLight}
                          />
                          <HofStat label="Wkts" value={String(e.wickets)} accent={colors.info} />
                          <HofStat label="HS" value={String(e.highScore)} accent={rankMeta.color} />
                          <HofStat
                            label="100s"
                            value={String(e.hundreds ?? 0)}
                            accent={rankMeta.color}
                          />
                          <HofStat label="Caps" value={String(e.caps)} accent={colors.success} />
                          <HofStat
                            label="Titles"
                            value={String(e.titles ?? 0)}
                            accent={rankMeta.color}
                          />
                        </View>
                        <Text style={styles.hofSeasons}>
                          {e.seasons} season{e.seasons !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={[styles.hofOvr, { borderColor: rankMeta.color }]}>
                        <Text style={[styles.hofOvrVal, { color: rankMeta.color }]}>
                          {e.overall}
                        </Text>
                        <Text style={styles.hofOvrLabel}>OVR</Text>
                      </View>
                    </View>
                  </Animated.View>
                );
              })
            ) : (
              <Card style={styles.hofEmpty}>
                <Text style={styles.hofEmptyIcon}>🏛️</Text>
                <Text style={styles.hofEmptyTitle}>The Hall Awaits</Text>
                <Text style={styles.hofEmptyText}>
                  No legends enshrined yet. Complete a career season to earn your place among the
                  greats.
                </Text>
              </Card>
            )
          ) : managerHofEntries.length ? (
            managerHofEntries.map((e, i) => {
              const isFirst = i === 0;
              const isActive = e.saveId === save.id;
              const score = e.trophies + (e.promotions ?? 0);
              return (
                <Animated.View key={e.saveId} entering={FadeInDown.duration(280).delay(i * 40)}>
                  <View
                    style={[
                      styles.hofPlaque,
                      styles.managerHofPlaque,
                      isFirst && styles.hofPlaqueFirst,
                      isActive && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                  >
                    <View
                      style={[
                        styles.hofRankBadge,
                        { backgroundColor: isFirst ? colors.accent : colors.surfaceAlt },
                      ]}
                    >
                      <Text
                        style={[
                          styles.hofRankNum,
                          { color: isFirst ? colors.bg : colors.textFaint },
                        ]}
                      >
                        {isFirst ? '👑' : `#${i + 1}`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.hofNameRow}>
                        <Text
                          style={[
                            styles.hofName,
                            isFirst && { fontSize: fontSize.xl, color: colors.accent },
                          ]}
                          numberOfLines={1}
                        >
                          {e.club}
                        </Text>
                        {isActive ? (
                          <Text
                            style={[
                              styles.hofRetiredBadge,
                              { color: colors.primary, borderColor: colors.primary },
                            ]}
                          >
                            Active
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.hofStats}>
                        <HofStat label="Titles" value={String(e.titles)} accent={colors.accent} />
                        <HofStat
                          label="Cups"
                          value={String(e.cupWins)}
                          accent={colors.primaryLight}
                        />
                        <HofStat
                          label="Promos"
                          value={String(e.promotions)}
                          accent={colors.success}
                        />
                        <HofStat
                          label="Best"
                          value={e.bestPosition ? `${ordinal(e.bestPosition)}` : '—'}
                          accent={colors.info}
                        />
                        <HofStat
                          label="Win %"
                          value={`${e.winRate ?? 0}%`}
                          accent={colors.success}
                        />
                        <HofStat
                          label="W-L-D"
                          value={`${e.wins ?? 0}-${e.losses ?? 0}-${e.draws ?? 0}`}
                          accent={colors.text}
                        />
                        <HofStat
                          label="Legends"
                          value={String(e.legendsProduced ?? 0)}
                          accent={colors.accentLight}
                        />
                      </View>
                      <Text style={styles.hofSeasons}>
                        {e.seasons ?? 0} season{(e.seasons ?? 0) !== 1 ? 's' : ''} managed | Club
                        trophies, league finishes, win rate and elite players produced.
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.hofOvr,
                        isFirst && { borderColor: colors.accent, borderWidth: 2 },
                      ]}
                    >
                      <Text style={[styles.hofOvrVal, isFirst && { color: colors.accent }]}>
                        {score}
                      </Text>
                      <Text style={styles.hofOvrLabel}>LEG</Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })
          ) : (
            <Card style={styles.hofEmpty}>
              <Text style={styles.hofEmptyIcon}>🏛️</Text>
              <Text style={styles.hofEmptyTitle}>No Dynasties Yet</Text>
              <Text style={styles.hofEmptyText}>
                Win trophies as a manager to be inducted into the Hall of Fame.
              </Text>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function ManagerRecordRow({
  row,
  rank,
  kind,
}: {
  row: ManagerLeaderboardRow;
  rank: number;
  kind: ManagerLeaderboardKind;
}) {
  const styles = useThemedStyles(makeStyles);
  const primary =
    kind === 'runs'
      ? row.runs.toLocaleString()
      : kind === 'wickets'
        ? row.wickets.toLocaleString()
        : kind === 'highScore'
          ? row.highScore.toLocaleString()
          : row.bestBowling;
  const secondary =
    kind === 'runs'
      ? `${row.matches} matches | Avg ${row.average} | SR ${row.strikeRate}`
      : kind === 'wickets'
        ? `${row.matches} matches | Econ ${row.economy}`
        : kind === 'highScore'
          ? `${row.runs} runs | ${row.hundreds} hundreds`
          : `${row.wickets} wickets | Econ ${row.economy}`;
  return (
    <View style={[styles.managerRecordRow, row.isManagedPlayer && styles.managerRecordRowManaged]}>
      <Text style={[styles.managerRecordRank, row.isManagedPlayer && styles.managerRecordGold]}>
        {rank}
      </Text>
      <View style={styles.managerRecordIdentity}>
        <Text
          style={[styles.managerRecordName, row.isManagedPlayer && styles.managerRecordGold]}
          numberOfLines={1}
        >
          {row.name}
        </Text>
        <Text style={styles.managerRecordMeta} numberOfLines={1}>
          {row.teamShort} | {secondary}
        </Text>
      </View>
      <Text style={[styles.managerRecordValue, row.isManagedPlayer && styles.managerRecordGold]}>
        {primary}
      </Text>
    </View>
  );
}

function HofStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.hofStatItem}>
      <Text style={[styles.hofStatValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.hofStatLabel} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    careerBestName: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    careerBestHeader: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    careerBestScope: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    careerBestGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    careerBestItem: { width: '33.3%', paddingVertical: spacing.sm, alignItems: 'center' },
    careerBestVal: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.black },
    careerBestLabel: {
      color: colors.textFaint,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    statViewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    statViewButton: {
      minWidth: '31%',
      minHeight: 38,
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statViewButtonActive: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.primary,
    },
    statViewButtonText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    statViewButtonTextActive: { color: colors.primaryLight },
    managerRecordsPanel: { paddingVertical: spacing.sm },
    managerStatTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    managerStatTab: {
      flexGrow: 1,
      flexBasis: 120,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    managerStatTabSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryDark,
    },
    managerStatTabText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    managerStatTabTextSelected: { color: colors.white },
    managerLeaderboard: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    managerRecordRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    managerRecordRowManaged: {
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      backgroundColor: `${colors.accent}18`,
    },
    managerRecordRank: {
      width: 24,
      color: colors.textFaint,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      textAlign: 'center',
    },
    managerRecordIdentity: { flex: 1, minWidth: 0 },
    managerRecordName: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    managerRecordMeta: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
    managerRecordValue: {
      minWidth: 48,
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      textAlign: 'right',
    },
    managerRecordGold: { color: colors.accent },
    scopeTrackingNote: {
      color: colors.textFaint,
      fontSize: 10,
      lineHeight: 15,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    mainTabRow: {
      flexGrow: 0,
      height: 44,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    mainTabContent: {
      minHeight: 44,
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: 0,
    },
    mainTab: {
      height: 40,
      minWidth: 92,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    mainTabActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    mainTabText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    mainTabTextActive: { color: colors.white },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    empty: { color: colors.textFaint, fontSize: fontSize.sm, paddingVertical: spacing.sm },
    hofHint: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.sm },
    hofName: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      flex: 1,
      fontFamily: fonts.display,
    },
    hofSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },
    hofOvr: {
      alignItems: 'center',
      width: 50,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      justifyContent: 'center',
      flexShrink: 0,
    },
    hofOvrVal: {
      color: colors.accent,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    hofOvrLabel: {
      color: colors.textFaint,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    chip: {
      flex: 1,
      minWidth: 0,
      minHeight: 40,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    chipText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    chipTextActive: { color: colors.white },
    lbRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
      borderRadius: radius.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    lbRank: {
      color: colors.textFaint,
      fontSize: fontSize.sm,
      width: 24,
      fontWeight: fontWeight.bold,
    },
    lbName: { color: colors.text, fontSize: fontSize.sm, flex: 1 },
    lbTeam: { color: colors.textMuted, fontSize: fontSize.xs, width: 40, textAlign: 'right' },
    lbValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      width: 48,
      textAlign: 'right',
    },
    lbYou: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    // Trophy cabinet
    trophyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    trophyCard: {
      width: '30%',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      alignItems: 'center',
      minHeight: 80,
      justifyContent: 'center',
    },
    trophyIcon: { fontSize: 28 },
    trophyName: {
      color: colors.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
      textAlign: 'center',
      marginTop: 4,
    },
    trophyYear: { color: colors.accent, fontSize: 10, marginTop: 2 },
    tableHint: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.sm },
    // Gamerscore
    gamerscoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
    gamerscoreLeft: { alignItems: 'center', paddingRight: spacing.md },
    gamerscoreValue: {
      color: colors.accent,
      fontSize: 36,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    gamerscoreLabel: {
      color: colors.textFaint,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginTop: 2,
    },
    gamerscoreMax: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
    gamerscoreDivider: { width: 1, height: 48, backgroundColor: colors.border },
    // Achievement summary
    achSummaryCard: {},
    achSummaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    achSummaryItem: { alignItems: 'center', flex: 1 },
    achSummaryDivider: { width: 1, height: 32, backgroundColor: colors.border },
    achSummaryNum: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    achSummaryLabel: {
      color: colors.textFaint,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    achGlobalRank: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.md,
      fontWeight: fontWeight.semibold,
    },
    // Achievement cards
    achCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    achCardEarned: { backgroundColor: colors.surfaceAlt },
    achCardPlatinum: {
      borderColor: '#B4E4FF',
      borderWidth: 1.5,
      shadowColor: '#B4E4FF',
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    achProgress: { fontSize: 9, fontWeight: fontWeight.bold, marginTop: 2 },
    achChainRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    achChainArrow: { color: colors.textFaint, fontSize: fontSize.xs },
    achChainNext: { color: colors.textMuted, fontSize: fontSize.xs, flex: 1 },
    achChainIcon: { fontSize: 12 },
    achIconWrap: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    achIcon: { fontSize: 22 },
    achIconLocked: { opacity: 0.5 },
    achBody: { flex: 1 },
    achTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    achTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold, flex: 1 },
    achTitleLocked: { color: colors.textMuted },
    achDesc: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
    achCheck: { fontSize: fontSize.lg, fontWeight: fontWeight.black, flexShrink: 0 },
    tierBadge: {
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexShrink: 0,
    },
    tierText: {
      fontSize: 9,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // ── Legend Card (HoF #1) ──
    legendCardWrap: { marginBottom: spacing.md },
    legendCard: {
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: '#E9B23B',
    },
    legendBorderTop: { height: 3, width: '100%' },
    legendHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      paddingBottom: spacing.md,
    },
    legendCrown: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: 'rgba(233,178,59,0.15)',
      borderWidth: 2,
      borderColor: '#E9B23B',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    legendCrownIcon: { fontSize: 28 },
    legendRankLabel: {
      color: '#E9B23B',
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    legendName: {
      color: colors.white,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
      marginTop: 2,
    },
    legendRetiredBadge: {
      color: '#E9B23B',
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 0.5,
      marginTop: 3,
    },
    legendOvr: {
      alignItems: 'center',
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 2,
      borderColor: '#E9B23B',
      backgroundColor: 'rgba(233,178,59,0.1)',
      justifyContent: 'center',
      flexShrink: 0,
    },
    legendOvrVal: {
      color: '#F7D06E',
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    legendOvrLabel: { color: '#C6902A', fontSize: 9, letterSpacing: 1 },
    legendStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(233,178,59,0.2)',
      paddingTop: spacing.md,
    },
    legendStatItem: { alignItems: 'center', minWidth: 52 },
    legendStatIcon: { fontSize: 16, marginBottom: 2 },
    legendStatValue: { color: '#F7D06E', fontSize: fontSize.md, fontWeight: fontWeight.black },
    legendStatLabel: {
      color: 'rgba(233,178,59,0.6)',
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    legendSeasons: {
      color: 'rgba(255,255,255,0.35)',
      fontSize: fontSize.xs,
      textAlign: 'center',
      padding: spacing.sm,
      paddingTop: 0,
    },

    // Hall of Fame redesign
    hofHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    hofMonogram: {
      width: 46,
      height: 46,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: `${colors.accent}18`,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    hofMonogramText: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
    },
    hofHeaderTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    hofHeaderSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    managerQualification: {
      borderRadius: radius.sm,
      marginBottom: spacing.md,
      borderColor: colors.borderStrong,
    },
    managerQualificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    managerQualificationTitle: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    managerQualificationClub: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    managerQualificationStatus: {
      fontSize: 10,
      fontWeight: fontWeight.black,
      flexShrink: 0,
    },
    managerQualificationStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    managerQualificationNote: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.sm,
    },
    hofPlaque: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    hofPlaqueFirst: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.accent,
      borderWidth: 1.5,
    },
    managerHofPlaque: {
      alignItems: 'flex-start',
    },
    hofRankBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    hofRankNum: { fontSize: fontSize.md, fontWeight: fontWeight.black },
    hofNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    hofRetiredBadge: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    hofStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    hofStatItem: { alignItems: 'center', flexBasis: 50, flexGrow: 1, maxWidth: 86, minWidth: 44 },
    hofStatValue: { fontSize: fontSize.sm, fontWeight: fontWeight.black },
    hofStatLabel: {
      color: colors.textFaint,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 1,
    },
    hofSeasons: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    hofEmpty: { alignItems: 'center', paddingVertical: spacing.xl },
    hofEmptyIcon: { fontSize: 48, marginBottom: spacing.md },
    hofEmptyTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      textAlign: 'center',
    },
    hofEmptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.xs,
      lineHeight: 20,
    },
  });
