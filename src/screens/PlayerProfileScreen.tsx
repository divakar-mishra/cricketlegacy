import { Pressable, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  CountryFlag,
  PlayerAvatar,
  ProgressBar,
  Screen,
  ScreenHeader,
  SponsorBrandRow,
  AppText as Text,
} from '../components';
import { ATTR_GROUPS, ATTR_META } from '../data/attributes';
import { getCountry } from '../data/countries';
import { PlayerStats } from '../domain/types';
import { battingMean, bowlingMean, computeOverall, metaMean } from '../engine/rating';
import { baseAttributeProgress, baseAttributeValue } from '../game/attributeDisplay';
import { formatClubCurrency } from '../game/finance';
import { injuryLabel } from '../game/injuries';
import { activeSponsorBranding } from '../game/sponsorship';
import { emptyStats } from '../game/stats';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

const fmtMoney = formatClubCurrency;

function relDescriptor(level: number, colors: ThemeColors): { label: string; color: string } {
  if (level >= 55) return { label: 'Close ally', color: colors.success };
  if (level >= 20) return { label: 'On good terms', color: colors.primaryLight };
  if (level > -20) return { label: 'Neutral', color: colors.textMuted };
  if (level > -55) return { label: 'Tense', color: colors.warning };
  return { label: 'Hostile', color: colors.danger };
}

const ROLE_LABEL: Record<string, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALLROUNDER: 'All-Rounder',
  WK_BATTER: 'Wicket-Keeper',
};

const div = (a: number, b: number): number => (b > 0 ? a / b : 0);

export function PlayerProfileScreen({ navigation, route }: ScreenProps<'PlayerProfile'>) {
  const save = useCareer((s) => s.save);
  const setTrainFocus = useCareer((s) => s.setTrainFocus);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const player = save?.players[route.params.playerId];

  if (!save || !player) {
    return (
      <Screen>
        <ScreenHeader title="Player" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>Player not found.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const country = getCountry(player.nationality);
  const career = player.careerStats ?? emptyStats();
  const season = player.seasonStats ?? emptyStats();
  const isUser = Boolean(player.isUserPlayer) && save.mode === 'career';
  const inSquad = Boolean(
    save.userTeamId && save.teams[save.userTeamId]?.playerIds.includes(player.id),
  );
  const scoutRep = save.scoutReports?.find((r) => r.playerId === player.id);
  const isExternalManagerPlayer = save.mode === 'manager' && !inSquad;
  const hasFullScoutReport = Boolean(scoutRep && scoutRep.uncertainty <= 0);
  const showPrivateRatings = !isExternalManagerPlayer || hasFullScoutReport;
  const relationships = isUser ? Object.values(save.relationships ?? {}) : [];
  const timeline = isUser ? (save.timeline ?? []) : [];
  const overall = computeOverall(player);
  const visibleAttributeGroups = isUser
    ? ATTR_GROUPS.filter((group) => group.id !== 'fielding')
    : ATTR_GROUPS;
  const team = Object.values(save.teams).find((candidate) =>
    candidate.playerIds.includes(player.id),
  );
  const sponsorBranding = isUser
    ? activeSponsorBranding(save)
    : { earned: undefined, premium: undefined };

  return (
    <Screen scroll>
      <ScreenHeader
        title={player.name}
        subtitle={`${country?.name ?? player.nationality} | ${ROLE_LABEL[player.role] ?? player.role} | Age ${player.age}`}
        onBack={() => navigation.goBack()}
      />

      <Card style={styles.hero}>
        <PlayerAvatar
          name={player.name}
          role={player.role}
          primaryColor={team?.primaryColor}
          secondaryColor={team?.secondaryColor}
          config={isUser ? save.cosmetics?.avatarConfig : undefined}
          profileFrame={isUser ? save.cosmetics?.profileFrame : undefined}
          earnedSponsor={sponsorBranding.earned}
          premiumSponsor={sponsorBranding.premium}
          size="lg"
          showRole
        />
        <View style={styles.heroContent}>
          <SponsorBrandRow
            earned={sponsorBranding.earned}
            premium={sponsorBranding.premium}
            compact
          />
          {country ? (
            <View style={styles.countryRow}>
              <CountryFlag countryId={country.id} flag={country.flag} size={18} />
              <Text style={styles.countryName}>{country.name}</Text>
            </View>
          ) : null}
          <View style={styles.heroRatings}>
            <Badge
              value={
                showPrivateRatings ? overall : scoutRep ? `~${scoutRep.knownOverall}` : '?'
              }
              label="OVR"
              big
            />
            <Badge
              value={showPrivateRatings ? baseAttributeValue(player.meta.form) : '?'}
              label="FORM"
            />
          </View>
        </View>
      </Card>

      {showPrivateRatings ? (
        <Card style={styles.coreRatingsCard}>
          <Text style={styles.coreRatingsTitle}>Core ratings</Text>
          <RatingRow
            label="Batting"
            value={baseAttributeValue(battingMean(player))}
            color={colors.primary}
          />
          <RatingRow
            label="Bowling"
            value={baseAttributeValue(bowlingMean(player))}
            color={colors.info}
          />
          <RatingRow
            label="Mental"
            value={baseAttributeValue(metaMean(player))}
            color={colors.accent}
          />
        </Card>
      ) : (
        <Card style={styles.scoutLockedCard}>
          <Text style={styles.scoutTitle}>Private ratings hidden</Text>
          <Text style={styles.scoutText}>
            {scoutRep
              ? 'Estimated report · Full scout reveals exact status.'
              : 'Public record only.'}
          </Text>
        </Card>
      )}

      {showPrivateRatings && player.traits.length ? (
        <View style={styles.traits}>
          {player.traits.map((t) => (
            <View key={t} style={styles.traitPill}>
              <Text style={styles.traitText}>{t.replace(/_/g, ' ').toLowerCase()}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {showPrivateRatings && player.injury ? (
        <Card style={styles.injuryCard}>
          <Text style={styles.injuryText}>🩹 Injured — {injuryLabel(player.injury)}</Text>
        </Card>
      ) : null}

      {isUser ? (
        <Card style={styles.lifeRow}>
          <Life
            label="Morale"
            value={baseAttributeValue(player.morale ?? 70)}
            color={colors.info}
          />
          <Life label="Brand" value={baseAttributeValue(save.brand ?? 20)} color={colors.accent} />
          <Life
            label="Integrity"
            value={baseAttributeValue(save.integrity ?? 80)}
            color={colors.success}
          />
        </Card>
      ) : null}
      {isUser && (save.captainClub || save.captainCountry) ? (
        <Text style={styles.captainLine}>
          🧢{' '}
          {[save.captainClub ? 'Club captain' : '', save.captainCountry ? 'National captain' : '']
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}

      {player.contract && save.mode === 'manager' ? (
        <Text style={styles.contractLine}>
          Contract · {fmtMoney(player.contract.wage)}/season · {player.contract.yearsLeft} yr
          {player.contract.yearsLeft === 1 ? '' : 's'} left
        </Text>
      ) : null}

      {scoutRep && !inSquad ? (
        <Card style={styles.scoutCard}>
          <Text style={styles.scoutTitle}>Scout report</Text>
          <Text style={styles.scoutText}>
            Assessed ~{scoutRep.knownOverall} OVR · Certainty{' '}
            {Math.round((1 - scoutRep.uncertainty) * 100)}%
            {scoutRep.recommended ? ' · Recommended' : ''}
          </Text>
        </Card>
      ) : null}

      {inSquad && save.mode === 'manager' && !player.isUserPlayer ? (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={styles.groupTitle}>Training focus</Text>
          <View style={styles.focusChips}>
            {ATTR_GROUPS.map((g) => {
              const sel = save.trainingFocus?.[player.id] === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setTrainFocus(player.id, g.id)}
                  style={[styles.focusChip, sel && styles.focusChipActive]}
                >
                  <Text style={[styles.focusText, sel && styles.focusTextActive]}>{g.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showPrivateRatings && visibleAttributeGroups.map((group) => {
        const obj = player[group.id] as unknown as Record<string, number>;
        return (
          <View key={group.id} style={{ marginTop: spacing.lg }}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <Card>
              {ATTR_META[group.id].map(([key, label]) => {
                const v = baseAttributeValue(obj[key as string]);
                return (
                  <View key={key} style={styles.attrRow}>
                    <Text style={styles.attrLabel} numberOfLines={1}>
                      {label}
                    </Text>
                    <ProgressBar
                      value={baseAttributeProgress(v)}
                      color={colors.primary}
                      style={styles.attrBar}
                    />
                    <Text style={styles.attrVal}>{v}</Text>
                  </View>
                );
              })}
            </Card>
          </View>
        );
      })}

      <Text style={styles.groupTitle}>
        {isExternalManagerPlayer ? 'Public career record' : 'Career'}
      </Text>
      <StatsCard s={career} />
      <Text style={styles.groupTitle}>
        {isExternalManagerPlayer ? 'Public season record' : 'This season'}
      </Text>
      <StatsCard s={season} />

      {isUser && relationships.length ? (
        <>
          <Text style={styles.groupTitle}>Relationships</Text>
          <Card>
            {relationships.map((r) => {
              const d = relDescriptor(r.level, colors);
              return (
                <View key={r.id} style={styles.relRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.relName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={styles.relRole}>{r.role}</Text>
                  </View>
                  <Text style={[styles.relLevel, { color: d.color }]}>{d.label}</Text>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {isUser && timeline.length ? (
        <>
          <Text style={styles.groupTitle}>Career timeline</Text>
          <Card>
            {timeline.slice(0, 14).map((t, i) => (
              <View key={i} style={styles.tlRow}>
                <Text style={styles.tlYear}>{t.year}</Text>
                <Text style={styles.tlText}>{t.text}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Life({ label, value, color }: { label: string; value: number; color: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.lifeItem}>
      <Text style={[styles.lifeValue, { color }]}>{value}</Text>
      <Text style={styles.lifeLabel}>{label}</Text>
    </View>
  );
}

function RatingRow({ label, value, color }: { label: string; value: number; color: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingLabel}>{label}</Text>
      <ProgressBar value={baseAttributeProgress(value)} color={color} style={styles.ratingBar} />
      <Text style={[styles.ratingValue, { color }]}>{value}</Text>
    </View>
  );
}

function StatsCard({ s }: { s: PlayerStats }) {
  const styles = useThemedStyles(makeStyles);
  const batAvg = div(s.runs, Math.max(1, s.matches - s.notOuts));
  const sr = div(s.runs, s.balls) * 100;
  const econ = div(s.runsConceded, s.ballsBowled / 6);
  const bowlAvg = div(s.runsConceded, Math.max(1, s.wickets));
  return (
    <Card>
      <View style={styles.statGrid}>
        <Stat label="Mat" value={s.matches} />
        <Stat label="Runs" value={s.runs} />
        <Stat label="HS" value={s.highScore} />
        <Stat label="Avg" value={batAvg.toFixed(1)} />
        <Stat label="SR" value={sr.toFixed(1)} />
        <Stat label="50/100" value={`${s.fifties}/${s.hundreds}`} />
        <Stat label="Wkts" value={s.wickets} />
        <Stat label="Best" value={s.bestBowling} />
        <Stat label="Econ" value={econ.toFixed(2)} />
        <Stat label="Bowl Avg" value={s.wickets ? bowlAvg.toFixed(1) : '-'} />
        <Stat label="Ct" value={s.catches} />
        <Stat label="St" value={s.stumpings} />
      </View>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
}

function Badge({ value, label, big }: { value: number | string; label: string; big?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.badge}>
      <Text
        style={[styles.badgeValue, big && { color: colors.accent, fontSize: fontSize.display }]}
      >
        {value}
      </Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
    heroContent: { flex: 1, gap: spacing.sm },
    countryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    countryName: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    heroRatings: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    coreRatingsCard: { marginTop: spacing.lg, gap: spacing.md },
    coreRatingsTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
    },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    ratingLabel: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      width: 62,
    },
    ratingBar: { flex: 1 },
    ratingValue: {
      width: 34,
      textAlign: 'right',
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
    },
    badge: { alignItems: 'center' },
    badgeValue: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
    badgeLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 1 },
    traits: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    traitPill: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 3,
    },
    traitText: { color: colors.accent, fontSize: fontSize.xs, textTransform: 'capitalize' },
    groupTitle: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    attrRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: spacing.sm },
    attrLabel: { color: colors.textMuted, fontSize: fontSize.sm, flexBasis: 82, flexShrink: 1 },
    attrBar: { flex: 1, minWidth: 72 },
    attrVal: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      width: 28,
      textAlign: 'right',
    },
    statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    stat: {
      flexBasis: '25%',
      flexGrow: 1,
      minWidth: 72,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: 2,
    },
    statValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    statLabel: {
      color: colors.textFaint,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    injuryCard: { marginTop: spacing.md, borderColor: colors.danger, borderWidth: 1.5 },
    injuryText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    lifeRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md },
    lifeItem: { alignItems: 'center', flex: 1 },
    lifeValue: { fontSize: fontSize.xl, fontWeight: fontWeight.black },
    lifeLabel: {
      color: colors.textFaint,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    captainLine: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    contractLine: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    scoutCard: { marginTop: spacing.md },
    scoutLockedCard: { marginTop: spacing.lg, borderColor: colors.accent, borderWidth: 1 },
    scoutTitle: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    scoutText: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, lineHeight: 18 },
    focusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    focusChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    focusChipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    focusText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    focusTextActive: { color: colors.white },
    relRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    relName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    relRole: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 1 },
    relLevel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    tlRow: {
      flexDirection: 'row',
      paddingVertical: 5,
      gap: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tlYear: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, width: 36 },
    tlText: { color: colors.textMuted, fontSize: fontSize.sm, flex: 1, lineHeight: 18 },
  });
