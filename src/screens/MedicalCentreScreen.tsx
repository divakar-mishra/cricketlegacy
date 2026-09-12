import { StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { showShortageOffer } from '../components/showShortageOffer';
import { FacilityScene } from '../components/FacilityScene';
import { AppText as Text, Button, Card, Icon, Screen, ScreenHeader } from '../components';
import { injuryLabel } from '../game/injuries';
import { managerControlledTeamId } from '../game/managerCalendar';
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

const RECOVERY_THRESHOLD = 60;
const MINIMUM_TIRED_PLAYERS = 3;

function average(values: number[]): number {
  return values.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : 0;
}

export function MedicalCentreScreen({ navigation }: ScreenProps<'MedicalCentre'>) {
  const save = useCareer((state) => state.save);
  const applySquadRecovery = useCareer((state) => state.applySquadRecovery);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save || save.mode !== 'manager' || !save.userTeamId) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Medical Centre" onBack={() => navigation.goBack()} />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Manager career required</Text>
        </Card>
      </Screen>
    );
  }

  if (save.managerCareerLevel === 'NATIONAL') {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Medical Centre" onBack={() => navigation.goBack()} />
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Icon name="flag-outline" size={24} color={colors.primaryLight} />
          </View>
          <Text style={styles.emptyTitle}>Club operations paused</Text>
        </Card>
      </Screen>
    );
  }

  const teamId = managerControlledTeamId(save) ?? save.userTeamId;
  const team = save.teams[teamId];
  if (!team) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Medical Centre" onBack={() => navigation.goBack()} />
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active club</Text>
        </Card>
      </Screen>
    );
  }

  const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean);
  const conditionFor = (player: (typeof squad)[number]) =>
    player.condition ?? player.meta.fitness ?? 70;
  const averageCondition = average(squad.map(conditionFor));
  const injured = squad.filter((player) => Boolean(player.injury));
  const lowCondition = squad.filter((player) => conditionFor(player) < RECOVERY_THRESHOLD);
  const recoveryOfferVisible = lowCondition.length >= MINIMUM_TIRED_PLAYERS;
  const recoveryTokens = Math.max(0, save.inventory?.squad_recovery_token ?? 0);
  const affected = squad.filter((player) => !player.injury);
  const averageAfterRecovery = average(
    squad.map((player) =>
      player.injury ? conditionFor(player) : Math.min(95, conditionFor(player) + 20),
    ),
  );
  const attention = squad
    .filter((player) => player.injury || conditionFor(player) < RECOVERY_THRESHOLD)
    .sort((left, right) => {
      if (Boolean(left.injury) !== Boolean(right.injury)) return left.injury ? -1 : 1;
      return conditionFor(left) - conditionFor(right);
    });
  const medicalLevel = save.facilities?.medical ?? 1;
  const confirmTokenRecovery = () => {
    if (!recoveryOfferVisible) return;
    Alert.alert(
      'Apply Squad Recovery?',
      [
        '1 Recovery Token',
        `Squad condition: ${averageCondition}% → ${averageAfterRecovery}%`,
        `${affected.length} eligible non-injured players`,
        'Cooldown: 3 fixtures or 7 days',
      ].join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () => {
            const result = applySquadRecovery('token');
            Alert.alert(
              result.ok ? 'Recovery applied' : 'Cannot recover squad',
              result.ok
                ? `Recovered ${result.preview?.affectedPlayers ?? affected.length} players.`
                : (result.reason ?? 'Please try again later.'),
            );
          },
        },
      ],
    );
  };

  const buyRecoveryToken = async () => {
    showShortageOffer(save, 'conditioning', (productId) => navigation.navigate('Purchase', { productId }));
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Medical Centre"
        subtitle={team.name}
        onBack={() => navigation.goBack()}
      />

      <Card style={styles.heroCard}>
        <FacilityScene kind="medical" level={medicalLevel} accent={team.primaryColor} />
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <Icon name="medkit-outline" size={25} color={colors.primaryLight} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>MEDICAL FACILITY</Text>
            <Text style={styles.heroTitle}>Level {medicalLevel}/5</Text>
            <Text style={styles.heroEffect}>Recovery support</Text>
          </View>
          <View style={styles.tokenPill}>
            <Text style={styles.tokenPillValue}>{recoveryTokens}</Text>
            <Text style={styles.tokenPillLabel}>Tokens</Text>
          </View>
        </View>
        <View style={styles.levelPips}>
          {Array.from({ length: 5 }).map((_, index) => (
            <View
              key={index}
              style={[styles.levelPip, index < medicalLevel && styles.levelPipOn]}
            />
          ))}
        </View>
      </Card>

      <Text style={styles.section}>Squad readiness</Text>
      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{averageCondition}%</Text>
          <Text style={styles.statLabel}>Average condition</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, lowCondition.length > 0 && styles.warningValue]}>
            {lowCondition.length}
          </Text>
          <Text style={styles.statLabel}>Below {RECOVERY_THRESHOLD}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, injured.length > 0 && styles.dangerValue]}>
            {injured.length}
          </Text>
          <Text style={styles.statLabel}>Injured</Text>
        </Card>
      </View>

      {(
        <>
          <Text style={styles.section}>Squad recovery</Text>
          <Card style={styles.recoveryCard}>
            <View style={styles.recoveryHeader}>
              <View>
                <Text style={styles.recoveryTitle}>Recovery tokens</Text>
                <Text style={styles.tokenCount}>{recoveryTokens}</Text>
              </View>
              <Icon name="fitness-outline" size={28} color={colors.info} />
            </View>
            <Text style={styles.recoveryEffect}>
              {recoveryOfferVisible
                ? 'Preview squad recovery'
                : 'Available when at least 3 players are below 60 condition. Your tokens are kept until used.'}
            </Text>
            <Button
              label={!recoveryOfferVisible
                ? squad.length > 0 && squad.every((player) => conditionFor(player) >= 100)
                  ? 'Squad already fit'
                  : 'Recovery not needed yet'
                : recoveryTokens > 0 ? 'Preview recovery · 1 token' : 'Buy 1 recovery token'}
              disabled={!recoveryOfferVisible}
              variant={recoveryTokens > 0 ? 'secondary' : 'gold'}
              style={styles.recoveryAction}
              onPress={() => {
                if (!recoveryOfferVisible) return;
                recoveryTokens > 0 ? confirmTokenRecovery() : void buyRecoveryToken();
              }}
            />
          </Card>
        </>
      )}

      <Text style={styles.section}>Needs attention</Text>
      <Card padded={false} style={styles.listCard}>
        {attention.length ? (
          attention.map((player, index) => (
            <View key={player.id} style={[styles.playerRow, index > 0 && styles.rowDivider]}>
              <View style={styles.playerCopy}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {player.name}
                </Text>
                <Text style={styles.playerStatus}>
                  {player.injury ? injuryLabel(player.injury) : 'Low condition'}
                </Text>
              </View>
              <Text
                style={[
                  styles.playerCondition,
                  player.injury ? styles.dangerValue : styles.warningValue,
                ]}
              >
                {Math.round(conditionFor(player))}%
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.readyRow}>
            <Icon name="checkmark-circle" size={22} color={colors.primaryLight} />
            <Text style={styles.readyText}>Squad ready.</Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    emptyCard: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.xxl },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      marginBottom: spacing.md,
    },
    emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    emptyCopy: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 20,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    heroCard: { marginTop: spacing.sm, backgroundColor: colors.bgElevated },
    heroHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    heroIcon: {
      width: 50,
      height: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    heroCopy: { flex: 1, minWidth: 0 },
    kicker: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    heroTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    heroEffect: { color: colors.primaryLight, fontSize: fontSize.sm, marginTop: 2 },
    tokenPill: {
      minWidth: 52,
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    tokenPillValue: { color: colors.info, fontSize: fontSize.md, fontWeight: fontWeight.black },
    tokenPillLabel: { color: colors.textMuted, fontSize: 9, textTransform: 'uppercase' },
    levelPips: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
    levelPip: {
      flex: 1,
      height: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
    levelPipOn: { backgroundColor: colors.primary },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    statGrid: { flexDirection: 'row', gap: spacing.sm },
    statCard: { flex: 1, minWidth: 0, padding: spacing.md },
    statValue: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.black },
    statLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    warningValue: { color: colors.warning },
    dangerValue: { color: colors.danger },
    recoveryCard: { borderColor: colors.info, backgroundColor: colors.bgElevated },
    recoveryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    recoveryTitle: { color: colors.textMuted, fontSize: fontSize.sm },
    tokenCount: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.black },
    recoveryEffect: { color: colors.text, fontSize: fontSize.sm, marginTop: spacing.md },
    recoveryMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
    recoveryAction: { marginTop: spacing.md },
    listCard: { overflow: 'hidden' },
    playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    playerCopy: { flex: 1, minWidth: 0 },
    playerName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    playerStatus: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    playerCondition: { fontSize: fontSize.md, fontWeight: fontWeight.black },
    readyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
    },
    readyText: { color: colors.textMuted, fontSize: fontSize.sm },
  });
