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
  ACHIEVEMENTS,
  earnedAchievements,
  getTierPoints,
  MAX_GAMERSCORE,
  pendingAchievements,
  totalGamerscore,
} from '../game/achievements';
import { leaderboard, LeaderMetric, METRIC_LABEL, userRank } from '../game/leaderboard';
import { seasonAwards } from '../game/progression';
import { standings } from '../game/season';
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

const METRICS: LeaderMetric[] = ['runs', 'wickets', 'overall'];
type HofTab = 'players' | 'managers';
type MainTab = 'records' | 'achievements' | 'hof';

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
  const [metric, setMetric] = useState<LeaderMetric>('runs');
  const [hofTab, setHofTab] = useState<HofTab>('players');
  const [mainTab, setMainTab] = useState<MainTab>('records');
  const [achFilter, setAchFilter] = useState<'all' | 'earned' | 'locked'>('all');

  useEffect(() => {
    void loadHof();
  }, [loadHof]);

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
  const awards = seasonAwards(save);
  const nameOf = (id?: string) => (id ? (save.players[id]?.name ?? '—') : '—');
  const board = leaderboard(save, metric, 'career', 10);
  const myRank = userRank(save, metric, 'career');
  const earned = earnedAchievements(save);
  const pending = pendingAchievements(save);
  const totalAch = ACHIEVEMENTS.length;
  const earnedCount = earned.length;
  const gamerscore = totalGamerscore(save);
  const leagueRows = save.mode === 'manager' ? standings(save) : [];

  const achList: AchievementDef[] =
    achFilter === 'earned' ? earned : achFilter === 'locked' ? pending : ACHIEVEMENTS;

  const tabCfg: { key: MainTab; label: string }[] = [
    { key: 'records', label: '📊 Records' },
    { key: 'achievements', label: `🏅 Achievements (${earnedCount})` },
    { key: 'hof', label: '🏛️ Hall of Fame' },
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
          {/* Personal Career Best — the user player's own numbers */}
          {(() => {
            if (save.mode !== 'career' || !save.userPlayerId) return null;
            const me = save.players[save.userPlayerId];
            const cs = me?.careerStats;
            if (!me || !cs || cs.matches <= 0) return null;
            const dismissals = Math.max(0, cs.matches - cs.notOuts);
            const avg =
              dismissals > 0
                ? (cs.runs / dismissals).toFixed(1)
                : cs.runs > 0
                  ? cs.runs.toFixed(1)
                  : '—';
            const sr = cs.balls > 0 ? ((cs.runs / cs.balls) * 100).toFixed(1) : '—';
            const items: { label: string; value: string; accent?: string }[] = [
              { label: 'Matches', value: String(cs.matches) },
              { label: 'Runs', value: String(cs.runs), accent: colors.primaryLight },
              { label: 'High Score', value: String(cs.highScore), accent: colors.accent },
              { label: 'Average', value: avg },
              { label: 'Strike Rate', value: sr },
              { label: '100s / 50s', value: `${cs.hundreds} / ${cs.fifties}` },
              { label: 'Wickets', value: String(cs.wickets), accent: colors.info },
              { label: 'Best Bowling', value: cs.bestBowling || '—', accent: colors.info },
              { label: 'Catches', value: String(cs.catches) },
            ];
            return (
              <Animated.View entering={FadeInDown.duration(260)}>
                <Text style={styles.section}>⭐ Your Career Best</Text>
                <Card>
                  <Text style={styles.careerBestName} numberOfLines={1}>
                    {me.name}
                  </Text>
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
                </Card>
              </Animated.View>
            );
          })()}

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

          <Animated.View entering={FadeInDown.duration(280)}>
            <Text style={styles.section}>All-time records</Text>
            <Card>
              <Line
                label="Highest score"
                value={
                  rec?.highestScore
                    ? `${rec.highestScore.name} · ${rec.highestScore.runs} (${rec.highestScore.year})`
                    : '—'
                }
              />
              <Line
                label="Best bowling"
                value={
                  rec?.bestBowling
                    ? `${rec.bestBowling.name} · ${rec.bestBowling.wickets}/${rec.bestBowling.runs} (${rec.bestBowling.year})`
                    : '—'
                }
              />
            </Card>
          </Animated.View>

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

          <Animated.View entering={FadeInDown.duration(320).delay(80)}>
            <Text style={styles.section}>This season leaders</Text>
            <Card>
              <Line
                label="Most runs"
                value={
                  awards.topScorer
                    ? `${nameOf(awards.topScorer.playerId)} · ${awards.topScorer.runs}`
                    : '—'
                }
              />
              <Line
                label="Most wickets"
                value={
                  awards.topWicketTaker
                    ? `${nameOf(awards.topWicketTaker.playerId)} · ${awards.topWicketTaker.wickets}`
                    : '—'
                }
              />
            </Card>

            <Text style={styles.section}>Player Rankings</Text>
            <View style={styles.chips}>
              {METRICS.map((m) => {
                const sel = metric === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMetric(m)}
                    style={[styles.chip, sel && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, sel && styles.chipTextActive]}>
                      {METRIC_LABEL[m]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Card>
              {board.map((r) => (
                <View
                  key={r.playerId}
                  style={[styles.lbRow, r.isUser && { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.lbRank, r.isUser && { color: colors.accent }]}>
                    {r.rank}
                  </Text>
                  <Text
                    style={[
                      styles.lbName,
                      r.isUser && { color: colors.accent, fontWeight: fontWeight.bold },
                    ]}
                    numberOfLines={1}
                  >
                    {r.name} {r.isUser ? '★' : ''}
                  </Text>
                  <Text style={styles.lbTeam}>{r.teamName}</Text>
                  <Text style={[styles.lbValue, r.isUser && { color: colors.accent }]}>
                    {r.value}
                  </Text>
                </View>
              ))}
              {myRank > 10 ? <Text style={styles.lbYou}>Your rank · {myRank}</Text> : null}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(340).delay(120)}>
            <Text style={styles.section}>Centuries</Text>
            <Card>
              {rec?.centuries.length ? (
                rec.centuries
                  .slice(0, 12)
                  .map((c, i) => (
                    <Line key={i} label={`${c.year}`} value={`${c.name} · ${c.detail}`} />
                  ))
              ) : (
                <Text style={styles.empty}>No hundreds yet — go make one.</Text>
              )}
            </Card>

            <Text style={styles.section}>Five-wicket hauls</Text>
            <Card>
              {rec?.fiveWicketHauls.length ? (
                rec.fiveWicketHauls
                  .slice(0, 12)
                  .map((c, i) => (
                    <Line key={i} label={`${c.year}`} value={`${c.name} · ${c.detail}`} />
                  ))
              ) : (
                <Text style={styles.empty}>No five-fers yet.</Text>
              )}
            </Card>
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
                  <ProgressBar value={gamerscore / MAX_GAMERSCORE} color={colors.accent} />
                  <Text style={styles.gamerscoreMax}>
                    {gamerscore} / {MAX_GAMERSCORE} pts
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
            const nextChain = nextChainId ? ACHIEVEMENTS.find((x) => x.id === nextChainId) : null;
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
              <Text style={styles.hofHeaderEmoji}>🏛️</Text>
              <View>
                <Text style={styles.hofHeaderTitle}>Hall of Fame</Text>
                <Text style={styles.hofHeaderSub}>
                  Legends that transcend every career you&apos;ve played.
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
                      {t === 'players' ? '🏏 Players' : '📋 Managers'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

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
          ) : hof.managers.length ? (
            hof.managers.map((e, i) => {
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

function Line({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
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
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
      marginBottom: spacing.sm,
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
    mainTabRow: { marginTop: spacing.md, marginBottom: spacing.md },
    mainTabContent: { gap: spacing.sm, paddingHorizontal: 0 },
    mainTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
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
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    label: { color: colors.textFaint, fontSize: fontSize.sm, width: 64 },
    value: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      flex: 1,
      textAlign: 'right',
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
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
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
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    hofHeaderEmoji: { fontSize: 36 },
    hofHeaderTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    hofHeaderSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
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
