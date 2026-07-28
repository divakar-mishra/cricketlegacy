import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, ProgressBar, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import { calculateClubRating, superstarAttractionChance } from '../game/manager';
import {
  isSeasonPassActive,
  MONTHLY_COSMETIC_DROPS,
  monthlyBundleForCycle,
  SEASON_PASS_BENEFITS,
  SEASON_PASS_ITEM_LABELS,
} from '../game/seasonPass';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
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

export function PremiumClubhouseScreen({ navigation }: ScreenProps<'PremiumClubhouse'>) {
  const save = useCareer((state) => state.save);
  const claimDrop = useCareer((state) => state.claimMonthlyPassDrop);
  const activateScenario = useCareer((state) => state.activatePassScenario);
  const claimScenario = useCareer((state) => state.claimPassScenario);
  const savePresentation = useCareer((state) => state.savePassPresentation);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save?.pass) {
    return (
      <Screen>
        <ScreenHeader title="Premium Clubhouse" onBack={() => navigation.goBack()} />
        <Text style={styles.muted}>Start a career or manager save first.</Text>
      </Screen>
    );
  }

  const active = isSeasonPassActive(save);
  const experience = save.seasonPassExperience;
  const inventory = save.inventory ?? {};
  const monthlyBundle = monthlyBundleForCycle(save.pass.seasonId);
  const dropClaimed = experience?.monthlyDropCycleId === save.pass.seasonId;
  const selectedStadium = experience?.selectedStadiumTheme ?? 'stadium_classic';
  const selectedOffice = experience?.selectedOfficeTheme ?? 'office_classic';
  const selectedFrame = experience?.selectedProfileFrame ?? 'frame_none';

  const applyPresentation = (input: Parameters<typeof savePresentation>[0]) => {
    const result = savePresentation(input);
    Alert.alert(
      result.ok ? 'Equipped' : 'Unavailable',
      result.reason ?? 'Your presentation has been updated.',
    );
  };

  const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
  const stats = player?.careerStats;
  const recentRatings = (save.seasonRatings ?? []).slice(-5);
  const recentAverage = recentRatings.length
    ? recentRatings.reduce((sum, rating) => sum + rating, 0) / recentRatings.length
    : 0;
  const clubRating = save.mode === 'manager' ? calculateClubRating(save) : 0;
  const attraction =
    save.mode === 'manager' ? Math.round(superstarAttractionChance(save) * 100) : 0;

  return (
    <Screen scroll>
      <ScreenHeader
        title="Premium Clubhouse"
        subtitle="Your active pass benefits"
        onBack={() => navigation.goBack()}
      />

      <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
        <ImageBackground
          source={require('../../assets/generated/season-pass-stadium-noir.png')}
          resizeMode="cover"
          imageStyle={styles.heroImage}
          style={styles.heroImageWrap}
        >
          <View style={styles.heroShade} />
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>{active ? 'PASS ACTIVE' : 'PREVIEW'}</Text>
            <Text style={styles.heroTitle}>Make the career yours.</Text>
            <Text style={styles.heroText}>
              Cosmetics, fictional scenarios, live analytics and naming tools for both career modes.
            </Text>
          </View>
        </ImageBackground>
      </Animated.View>

      {!active && (
        <View style={styles.lockBand}>
          <Text style={styles.lockTitle}>Premium access is inactive</Text>
          <Text style={styles.muted}>
            Earned cosmetics remain owned and equippable. Stories, scenarios, naming tools and new
            monthly claims reactivate on renewal.
          </Text>
          <Button label="View Season Pass" onPress={() => navigation.navigate('SeasonPass')} />
        </View>
      )}

      <Text style={styles.section}>Monthly Cosmetic Drop</Text>
      <View style={styles.featureRow}>
        <View style={styles.featureCopy}>
          <Text style={styles.featureTitle}>{monthlyBundle.title} collection</Text>
          <Text style={styles.muted}>
            {monthlyBundle.kit.label}, {monthlyBundle.celebration.label} and{' '}
            {monthlyBundle.office.label}.
          </Text>
          <Text style={styles.collectionHint}>
            Unique reward: {monthlyBundle.collectible.label}. All four items remain owned
            permanently.
          </Text>
        </View>
        <Button
          label={dropClaimed ? 'Claimed' : 'Claim'}
          size="sm"
          fullWidth={false}
          disabled={!active || dropClaimed}
          onPress={() => {
            const result = claimDrop();
            const claimed = [
              ...(result.items ?? []),
              ...(result.rewardItem ? [result.rewardItem] : []),
            ]
              .map((item) => SEASON_PASS_ITEM_LABELS[item] ?? item)
              .join(', ');
            Alert.alert(
              result.ok ? 'Monthly collection claimed' : 'Unavailable',
              result.ok ? claimed : result.reason,
            );
          }}
        />
      </View>
      <Text style={styles.collectionHint}>
        Twelve distinct monthly collections contain {MONTHLY_COSMETIC_DROPS.length} non-tier
        cosmetics. Claimed items stay owned.
      </Text>

      <Text style={styles.section}>Presentation Studio</Text>
      <PresentationRow
        title="Stadium Noir"
        detail="Cinematic night-match presentation"
        selected={selectedStadium === 'stadium_noir'}
        locked={(inventory.pass_stadium_noir ?? 0) <= 0}
        onPress={() => applyPresentation({ stadiumTheme: 'stadium_noir' })}
      />
      {save.mode === 'manager' && (
        <>
          <PresentationRow
            title="Executive Office"
            detail="Premium club-office backdrop"
            selected={selectedOffice === 'office_noir'}
            locked={(inventory.pass_office_noir ?? 0) <= 0}
            onPress={() => applyPresentation({ officeTheme: 'office_noir' })}
          />
          {MONTHLY_PASS_CONTENT.filter(
            (content) =>
              (inventory[content.office.inventoryId] ?? 0) > 0 || content.id === monthlyBundle.id,
          ).map((content) => (
            <PresentationRow
              key={content.office.themeId}
              title={content.office.label}
              detail={`${content.title} Manager presentation`}
              selected={selectedOffice === content.office.themeId}
              locked={(inventory[content.office.inventoryId] ?? 0) <= 0}
              lockLabel="Monthly drop"
              onPress={() => applyPresentation({ officeTheme: content.office.themeId })}
            />
          ))}
        </>
      )}
      <PresentationRow
        title="Championship Frame"
        detail="Gold and lime illustrated-avatar frame"
        selected={selectedFrame === 'frame_gold'}
        locked={(inventory.pass_frame_gold ?? 0) <= 0}
        onPress={() => applyPresentation({ profileFrame: 'frame_gold' })}
      />
      <View style={styles.commandRow}>
        {save.mode === 'career' && (
          <Button
            label="Avatar & Kit"
            variant="secondary"
            onPress={() => navigation.navigate('PlayerCosmetics')}
          />
        )}
        <Button
          label="League & Team Editor"
          variant="secondary"
          onPress={() => navigation.navigate('LeagueEditor')}
        />
      </View>

      <Text style={styles.section}>Featured Scenario</Text>
      {[{ ...monthlyBundle.scenario, targetRuns: 0, targetWickets: 0 }].map((scenario) => {
        const progress = experience?.scenarios[scenario.id];
        const activeScenario = experience?.activeScenarioId === scenario.id;
        const progressValue =
          scenario.targetMatches > 0 ? (progress?.matches ?? 0) / scenario.targetMatches : 0;
        return (
          <View key={scenario.id} style={styles.scenarioRow}>
            <View style={styles.scenarioHeader}>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{scenario.title}</Text>
                <Text style={styles.muted}>{scenario.description}</Text>
              </View>
              {scenario.tournament && <Text style={styles.premiumTag}>TOURNAMENT</Text>}
            </View>
            <Text style={styles.objective}>{scenario.objective}</Text>
            <ProgressBar value={progressValue} color={colors.accent} />
            <Text style={styles.progressText}>
              {progress?.matches ?? 0}/{scenario.targetMatches} matches · {progress?.wins ?? 0}/
              {scenario.targetWins} wins · Reward {scenario.rewardCoins} coins +{' '}
              {scenario.rewardGems} gems
            </Text>
            <Button
              label={
                progress?.rewardClaimed
                  ? 'Reward claimed'
                  : progress?.completed
                    ? 'Claim reward'
                    : activeScenario
                      ? 'Active for next match'
                      : 'Activate'
              }
              size="sm"
              variant={progress?.completed ? 'gold' : 'secondary'}
              disabled={!active || Boolean(progress?.rewardClaimed) || activeScenario}
              onPress={() => {
                const result = progress?.completed
                  ? claimScenario(scenario.id)
                  : activateScenario(scenario.id);
                Alert.alert(
                  result.ok ? 'Ready' : 'Unavailable',
                  result.reason ??
                    (progress?.completed
                      ? 'Scenario reward claimed.'
                      : 'The scenario will track your next career matches.'),
                );
              }}
            />
          </View>
        );
      })}

      <Text style={styles.section}>Advanced Analytics</Text>
      <View style={styles.analyticsGrid}>
        {save.mode === 'career' ? (
          <>
            <Metric label="Recent rating" value={recentAverage ? recentAverage.toFixed(2) : '—'} />
            <Metric label="Selection rep" value={`${save.nationalRep ?? 0}/100`} />
            <Metric label="Career runs" value={String(stats?.runs ?? 0)} />
            <Metric label="Career wickets" value={String(stats?.wickets ?? 0)} />
          </>
        ) : (
          <>
            <Metric label="Club rating" value={clubRating.toFixed(1)} />
            <Metric label="Star attraction" value={`${attraction}%`} />
            <Metric label="Board confidence" value={`${save.boardConfidence ?? 60}/100`} />
            <Metric
              label="Staff average"
              value={String(
                Math.round(
                  (save.staff ?? []).reduce((sum, member) => sum + member.quality, 0) /
                    Math.max(1, save.staff?.length ?? 0),
                ),
              )}
            />
          </>
        )}
      </View>
      <Text style={styles.analyticsNote}>
        Premium modifiers: +{Math.round((SEASON_PASS_BENEFITS.trainingGrowthMultiplier - 1) * 100)}%
        training growth, +
        {Math.round((SEASON_PASS_BENEFITS.positiveSelectionRepMultiplier - 1) * 100)}% positive
        selection reputation, +{Math.round(SEASON_PASS_BENEFITS.superstarInterestBonus * 100)}{' '}
        points elite-player interest, and{' '}
        {Math.round(SEASON_PASS_BENEFITS.staffSigningDiscount * 100)}% lower staff signing fees.
        Eligibility, budgets and squad rules still apply.
      </Text>

      <Text style={styles.section}>Stories & Interviews</Text>
      <View style={styles.featureRow}>
        <View style={styles.featureCopy}>
          <Text style={styles.featureTitle}>
            {save.mode === 'manager'
              ? monthlyBundle.managerStory.openingTitle
              : monthlyBundle.playerStory.openingTitle}
          </Text>
          <Text style={styles.muted}>
            A new two-part {save.mode === 'manager' ? 'Manager event' : 'Player story'} is available
            this cycle. Choices persist through the follow-up and affect relationships, form or
            reputation, never guaranteed results.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function PresentationRow({
  title,
  detail,
  selected,
  locked,
  lockLabel = 'Tier reward',
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  locked: boolean;
  lockLabel?: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      style={[styles.presentationRow, locked && styles.disabledRow]}
    >
      <View style={styles.featureCopy}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.muted}>{detail}</Text>
      </View>
      <Text style={[styles.rowState, selected && styles.rowStateSelected]}>
        {locked ? lockLabel : selected ? 'Equipped' : 'Equip'}
      </Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    muted: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
    hero: { marginTop: spacing.md, borderRadius: radius.xl, overflow: 'hidden', minHeight: 230 },
    heroImage: { borderRadius: radius.xl },
    heroImageWrap: { minHeight: 230, justifyContent: 'flex-end' },
    heroShade: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(5,8,6,0.56)',
    },
    heroCopy: { padding: spacing.xl, paddingTop: 80 },
    eyebrow: { color: '#B9F23D', fontSize: 10, fontWeight: fontWeight.black, letterSpacing: 1.2 },
    heroTitle: {
      color: '#F5F7F4',
      fontFamily: fonts.display,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      marginTop: spacing.xs,
    },
    heroText: {
      color: '#D9E0DA',
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginTop: spacing.xs,
      maxWidth: 330,
    },
    lockBand: {
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.warning,
      gap: spacing.sm,
    },
    lockTitle: { color: colors.warning, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
      letterSpacing: 1.1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    featureCopy: { flex: 1 },
    featureTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    collectionHint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    presentationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 64,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    disabledRow: { opacity: 0.55 },
    rowState: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    rowStateSelected: { color: colors.accent },
    commandRow: { gap: spacing.sm, marginTop: spacing.md },
    scenarioRow: {
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    scenarioHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    premiumTag: { color: '#D5B56D', fontSize: 9, fontWeight: fontWeight.black, letterSpacing: 0.8 },
    objective: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    progressText: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 17 },
    analyticsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    metric: {
      width: '50%',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    metricValue: {
      color: colors.accent,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    metricLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    analyticsNote: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 18,
      marginTop: spacing.md,
      marginBottom: spacing.xxl,
    },
  });
