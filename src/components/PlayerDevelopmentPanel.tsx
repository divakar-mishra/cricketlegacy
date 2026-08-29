import { Pressable, StyleSheet, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import type { PersonalCoachDiscipline } from '../domain/types';
import {
  ensurePlayerLifeState,
  PERSONAL_COACHES,
  PLAYER_EQUIPMENT,
  PLAYER_LIFE_COSTS,
} from '../game/playerLife';
import { nextUserFixtureId } from '../game/season';
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
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { GlassAlert as Alert } from './GlassAlertModal';
import { Icon, IconName } from './Icon';

function label(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Coaches, equipment and match support shown inside the Player Training screen. */
export function PlayerDevelopmentPanel() {
  const {
    save,
    hirePersonalCoach,
    buyPlayerEquipment,
    bookPersonalPhysio,
    buyPerformanceAnalysis,
  } = useCareer(
    useShallow((state) => ({
      save: state.save,
      hirePersonalCoach: state.hirePersonalCoach,
      buyPlayerEquipment: state.buyPlayerEquipment,
      bookPersonalPhysio: state.bookPersonalPhysio,
      buyPerformanceAnalysis: state.buyPerformanceAnalysis,
    })),
  );
  const styles = useThemedStyles(makeStyles);

  if (!save || save.mode !== 'career' || !save.userPlayerId) return null;
  const player = save.players[save.userPlayerId];
  if (!player) return null;

  const life = ensurePlayerLifeState(save);
  const fixtureId = nextUserFixtureId(save);
  const fixture = fixtureId ? save.fixtures[fixtureId] : undefined;
  const activeAnalysis =
    fixtureId && life.lastAnalysisReport?.fixtureId === fixtureId
      ? life.lastAnalysisReport
      : undefined;
  const resultAlert = (title: string, result: { ok: boolean; detail?: string; reason?: string }) =>
    Alert.alert(
      result.ok ? title : 'Not available',
      result.detail ?? result.reason ?? 'Try again.',
    );

  return (
    <View style={styles.container}>
      <SectionTitle title="Match support" />
      <View style={styles.actionGrid}>
        <ServiceTile
          icon="medkit-outline"
          title="Personal Physio"
          detail={`${life.physioVisitsThisSeason}/${PLAYER_LIFE_COSTS.maxPhysioVisits} used`}
          price={PLAYER_LIFE_COSTS.physio}
          disabled={
            life.physioVisitsThisSeason >= PLAYER_LIFE_COSTS.maxPhysioVisits ||
            (!player.injury && (save.playerCareerResources?.playerCondition ?? 100) >= 95)
          }
          onPress={() => resultAlert('Physio complete', bookPersonalPhysio())}
        />
        <ServiceTile
          icon="analytics-outline"
          title="Performance Analyst"
          detail={
            fixture
              ? activeAnalysis
                ? `${activeAnalysis.opponentName} report ready`
                : `${fixture.format} matchup report`
              : 'No upcoming match'
          }
          price={PLAYER_LIFE_COSTS.analyst}
          disabled={!fixtureId || life.analysedFixtureIds.includes(fixtureId)}
          onPress={() => resultAlert('Report ready', buyPerformanceAnalysis())}
        />
      </View>

      {activeAnalysis ? (
        <Card style={styles.analysisReport}>
          <Text style={styles.panelTitle}>
            {activeAnalysis.opponentName} · {activeAnalysis.format}
          </Text>
          <ReportLine label="Primary threat" value={activeAnalysis.threatName} />
          <ReportLine label="Weakness" value={activeAnalysis.weakness} />
          <ReportLine label="Match plan" value={activeAnalysis.matchAdvice} />
          <Text style={styles.recommended}>
            Train {label(activeAnalysis.recommendedTrainingGroup)}
          </Text>
        </Card>
      ) : null}

      <SectionTitle title="Personal coaches" />
      <Card style={styles.listPanel}>
        {PERSONAL_COACHES.map((coach, index) => {
          const active = (life.personalCoaches[coach.discipline]?.seasonsRemaining ?? 0) > 0;
          return (
            <ActionRow
              key={coach.discipline}
              icon={
                coach.discipline === 'BATTING'
                  ? 'baseball-outline'
                  : coach.discipline === 'BOWLING'
                    ? 'disc-outline'
                    : 'sparkles-outline'
              }
              title={coach.name}
              detail={`${label(coach.discipline)} · One season`}
              action={active ? 'Active' : coach.cost.toLocaleString()}
              disabled={active || save.wallet.coins < coach.cost}
              last={index === PERSONAL_COACHES.length - 1}
              onPress={() =>
                resultAlert(
                  'Coach hired',
                  hirePersonalCoach(coach.discipline as PersonalCoachDiscipline),
                )
              }
            />
          );
        })}
      </Card>

      <SectionTitle title="Equipment" />
      <Card style={styles.listPanel}>
        {PLAYER_EQUIPMENT.map((equipment, index) => {
          const owned = life.equipmentIds.includes(equipment.id);
          return (
            <ActionRow
              key={equipment.id}
              icon={
                equipment.id === 'balanced-bat'
                  ? 'baseball-outline'
                  : equipment.id === 'keeper-gloves'
                    ? 'hand-left-outline'
                    : equipment.id === 'performance-shoes'
                      ? 'footsteps-outline'
                      : 'shield-checkmark-outline'
              }
              title={equipment.name}
              detail={
                equipment.id === 'balanced-bat'
                  ? 'Batting control'
                  : equipment.id === 'keeper-gloves'
                    ? 'Catching'
                    : equipment.id === 'performance-shoes'
                      ? 'Running and agility'
                      : 'Resilience'
              }
              action={owned ? 'Owned' : equipment.cost.toLocaleString()}
              disabled={owned || save.wallet.coins < equipment.cost}
              last={index === PLAYER_EQUIPMENT.length - 1}
              onPress={() => resultAlert('Equipment ready', buyPlayerEquipment(equipment.id))}
            />
          );
        })}
      </Card>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ActionRow({
  icon,
  title,
  detail,
  action,
  disabled,
  last,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  action: string;
  disabled?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.actionRow, last && styles.lastRow]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={20} color={colors.primaryLight} />
      </View>
      <View style={styles.flexText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowMeta}>{detail}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[styles.rowAction, disabled && styles.rowActionDisabled]}
        onPress={onPress}
      >
        <Text style={[styles.rowActionText, disabled && styles.rowActionTextDisabled]}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

function ReportLine({ label: reportLabel, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.reportLine}>
      <Text style={styles.reportLabel}>{reportLabel}</Text>
      <Text style={styles.reportValue}>{value}</Text>
    </View>
  );
}

function ServiceTile({
  icon,
  title,
  detail,
  price,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  price: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.serviceTile, disabled && styles.disabledTile]}>
      <Icon name={icon} size={24} color={colors.primaryLight} />
      <Text style={styles.serviceTitle}>{title}</Text>
      <Text style={styles.serviceDetail}>{detail}</Text>
      <Button
        label={disabled ? 'Unavailable' : `${price.toLocaleString()} coins`}
        size="sm"
        variant="secondary"
        disabled={disabled}
        style={styles.serviceButton}
        onPress={onPress}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { paddingBottom: spacing.xxl },
    sectionTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    serviceTile: {
      flexGrow: 1,
      flexBasis: '46%',
      minWidth: 150,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
    },
    disabledTile: { opacity: 0.68 },
    serviceTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: spacing.sm,
    },
    serviceDetail: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      minHeight: 34,
      marginTop: 3,
    },
    serviceButton: { marginTop: spacing.sm },
    analysisReport: { marginTop: spacing.md, borderColor: colors.accent, borderLeftWidth: 3 },
    panelTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    recommended: {
      color: colors.success,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: spacing.sm,
    },
    reportLine: {
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    reportLabel: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
    },
    reportValue: { color: colors.text, fontSize: fontSize.sm, lineHeight: 19, marginTop: 3 },
    listPanel: { paddingVertical: 0, borderRadius: radius.sm },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 64,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastRow: { borderBottomWidth: 0 },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    flexText: { flex: 1, minWidth: 0 },
    rowTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    rowMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    rowAction: {
      minWidth: 88,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderWidth: 1,
      borderColor: colors.primaryLight,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryDark,
    },
    rowActionDisabled: { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
    rowActionText: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    rowActionTextDisabled: { color: colors.textMuted },
  });
