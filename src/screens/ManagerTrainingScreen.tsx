import { useEffect, useState } from 'react';
import { FacilityScene } from '../components/FacilityScene';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppText as Text,
  Button,
  Card,
  Icon,
  MechanicInfoButton,
  Screen,
  ScreenHeader,
} from '../components';
import type { IconName } from '../components';
import { ManagerTrainingFocus, ManagerTrainingIntensity } from '../domain/types';
import { activeManagerClub } from '../game/managerClubState';
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

const BOARD = {
  green: '#17382F',
  greenDeep: '#0D251F',
  chalk: '#F3EBD7',
  chalkMuted: '#C6D2C7',
  leather: '#9B3328',
  frame: '#C7A96B',
} as const;

const FOCUSES: {
  id: ManagerTrainingFocus;
  label: string;
  summary: string;
  icon: IconName;
}[] = [
  { id: 'BATTING', label: 'Batting', summary: 'Sharper scoring skills', icon: 'baseball-outline' },
  {
    id: 'BOWLING',
    label: 'Bowling',
    summary: 'Better control and stamina',
    icon: 'radio-button-on',
  },
  {
    id: 'FIELDING',
    label: 'Fielding',
    summary: 'Catching, throwing and agility',
    icon: 'hand-left-outline',
  },
  { id: 'FITNESS', label: 'Fitness', summary: 'Physical preparation', icon: 'fitness-outline' },
  {
    id: 'BALANCED',
    label: 'Balanced',
    summary: 'Development across the squad',
    icon: 'options',
  },
  {
    id: 'RECOVERY',
    label: 'Recovery',
    summary: 'Restore condition without growth',
    icon: 'medical-outline',
  },
];

const INTENSITIES: {
  id: ManagerTrainingIntensity;
  label: string;
  detail: string;
}[] = [
  { id: 'LIGHT', label: 'Light', detail: 'More recovery · Slower development' },
  { id: 'NORMAL', label: 'Normal', detail: 'Balanced workload' },
  { id: 'HIGH', label: 'High', detail: 'Faster development · Higher fatigue risk' },
];

const focusLabel = (focus: ManagerTrainingFocus): string =>
  FOCUSES.find((option) => option.id === focus)?.label ?? focus;

export function ManagerTrainingScreen({ navigation }: Pick<ScreenProps<'Training'>, 'navigation'>) {
  const save = useCareer((state) => state.save);
  const setPlan = useCareer((state) => state.setManagerTrainingPlan);
  const setOverride = useCareer((state) => state.setManagerTrainingOverride);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [draftFocus, setDraftFocus] = useState<ManagerTrainingFocus | null>(null);
  const [draftIntensity, setDraftIntensity] = useState<ManagerTrainingIntensity | null>(null);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const club =
    save?.mode === 'manager' && save.userTeamId && save.managerCareerLevel !== 'NATIONAL'
      ? activeManagerClub(save)
      : undefined;
  const savedPlan = club?.trainingPlan;

  useEffect(() => {
    if (!savedPlan) return;
    setDraftFocus(savedPlan.teamFocus);
    setDraftIntensity(savedPlan.intensity);
  }, [club?.teamId, savedPlan?.teamFocus, savedPlan?.intensity]);

  if (!save || save.mode !== 'manager' || !save.userTeamId) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Team Training" onBack={() => navigation.goBack()} />
        <Text style={styles.muted}>Available in Manager Career.</Text>
      </Screen>
    );
  }

  if (save.managerCareerLevel === 'NATIONAL') {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Team Training" onBack={() => navigation.goBack()} />
        <Card style={styles.unavailableCard}>
          <Icon name="flag-outline" size={24} color={colors.textMuted} />
          <Text style={styles.unavailableTitle}>Club training is paused</Text>
        </Card>
      </Screen>
    );
  }

  const team = save.teams[save.userTeamId];
  if (!team || !club || !savedPlan) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Team Training" onBack={() => navigation.goBack()} />
        <Text style={styles.muted}>Training plan unavailable.</Text>
      </Screen>
    );
  }

  const selectedFocus = draftFocus ?? savedPlan.teamFocus;
  const selectedIntensity = draftIntensity ?? savedPlan.intensity;
  const focusSummary = FOCUSES.find((option) => option.id === selectedFocus)?.summary ?? '';
  const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean);
  const overrideCount = Object.keys(savedPlan.playerOverrides).filter((id) =>
    team.playerIds.includes(id),
  ).length;
  const planChanged =
    selectedFocus !== savedPlan.teamFocus || selectedIntensity !== savedPlan.intensity;

  const chooseFocus = (focus: ManagerTrainingFocus) => {
    setDraftFocus(focus);
    setSaveMessage(null);
  };

  const chooseIntensity = (intensity: ManagerTrainingIntensity) => {
    setDraftIntensity(intensity);
    setSaveMessage(null);
  };

  const saveTrainingPlan = () => {
    const saved = setPlan({ focus: selectedFocus, intensity: selectedIntensity });
    setSaveMessage(saved ? 'Plan saved' : 'Plan could not be saved.');
  };

  return (
    <Screen
      scroll
      gradient={gradients.pitch}
      footer={
        <View style={styles.footer}>
          <Text style={[styles.footerStatus, saveMessage && styles.footerStatusSaved]}>
            {saveMessage ?? (planChanged ? 'Unsaved changes' : 'Automatic after fixtures')}
          </Text>
          <Button
            label={planChanged ? 'SAVE TRAINING PLAN' : 'PLAN SAVED'}
            variant={planChanged ? 'gold' : 'secondary'}
            disabled={!planChanged}
            onPress={saveTrainingPlan}
          />
        </View>
      }
    >
      <ScreenHeader
        title="Squad Training"
        subtitle={team.name}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.coachBoard}>
        <View style={[styles.tape, styles.tapeLeft]} />
        <View style={[styles.tape, styles.tapeRight]} />
        <View style={styles.boardHeader}>
          <View style={styles.boardTitleRow}>
            <Icon name="clipboard-outline" size={20} color={BOARD.chalk} />
            <Text style={styles.boardTitle}>COACH&apos;S BOARD</Text>
          </View>
          <MechanicInfoButton topicId="manager-training" size={32} style={styles.infoButton} />
        </View>

        <Text style={styles.boardSectionLabel}>
          TRAINING GROUND · LEVEL {club.facilities.training}/5
        </Text>
        <FacilityScene
          kind="training"
          level={club.facilities.training}
          accent={team.primaryColor}
          caption={false}
        />

        <Text style={styles.boardSectionLabel}>SESSION FOCUS</Text>
        <View style={styles.focusGrid}>
          {FOCUSES.map((option) => {
            const selected = selectedFocus === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => chooseFocus(option.id)}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} training focus`}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.focusButton,
                  selected && styles.focusButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  name={option.icon}
                  size={18}
                  color={selected ? colors.success : BOARD.chalkMuted}
                />
                <Text style={[styles.focusLabel, selected && styles.focusLabelSelected]}>
                  {option.label}
                </Text>
                {selected ? <Icon name="checkmark" size={16} color={colors.success} /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.selectionSummary}>
          <Text style={styles.selectionKicker}>SELECTED · {focusLabel(selectedFocus)}</Text>
          <Text style={styles.selectionDetail}>{focusSummary}</Text>
        </View>
      </View>

      {selectedFocus !== 'RECOVERY' ? (
        <View style={styles.workloadSection}>
          <Text style={styles.sectionTitle}>WORKLOAD</Text>
          <View style={styles.intensityRow}>
            {INTENSITIES.map((option) => {
              const selected = selectedIntensity === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => chooseIntensity(option.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label} workload. ${option.detail}`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.intensityButton,
                    selected && styles.intensityButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.intensityTitleRow}>
                    <Text
                      style={[styles.intensityTitle, selected && styles.intensityTitleSelected]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <Icon name="checkmark-circle" size={17} color={colors.success} />
                    ) : null}
                  </View>
                  <Text style={styles.intensityDetail}>{option.detail}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.recoveryBand}>
          <Icon name="shield-checkmark" size={20} color={colors.success} />
          <View style={styles.recoveryCopy}>
            <Text style={styles.recoveryTitle}>Recovery session</Text>
          </View>
        </View>
      )}

      <View style={styles.overridesSheet}>
        <Pressable
          onPress={() => setOverridesOpen((current) => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded: overridesOpen }}
          accessibilityLabel={`Player overrides, ${overrideCount} active`}
          style={({ pressed }) => [styles.overridesHeader, pressed && styles.pressed]}
        >
          <View style={styles.overridesTitleRow}>
            <Icon name="people-outline" size={20} color={colors.accentLight} />
            <View>
              <Text style={styles.overridesTitle}>PLAYER OVERRIDES</Text>
              <Text style={styles.overridesCount}>{overrideCount} active</Text>
            </View>
          </View>
          <Icon
            name={overridesOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        {overridesOpen ? (
          <View style={styles.playerList}>
            {squad.map((player, index) => {
              const expanded = expandedPlayerId === player.id;
              const override = savedPlan.playerOverrides[player.id];
              const effective = override ?? selectedFocus;
              return (
                <View key={player.id} style={[styles.playerBlock, index > 0 && styles.divider]}>
                  <Pressable
                    onPress={() => setExpandedPlayerId(expanded ? null : player.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={({ pressed }) => [styles.playerRow, pressed && styles.pressed]}
                  >
                    <View style={styles.playerCopy}>
                      <Text style={styles.playerName} numberOfLines={1}>
                        {player.name}
                      </Text>
                      <Text style={styles.playerRole}>{player.role.replace('_', ' ')}</Text>
                    </View>
                    <View style={styles.playerFocusBadge}>
                      <Text style={styles.playerFocusText}>{focusLabel(effective)}</Text>
                    </View>
                    <Icon
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                  {expanded ? (
                    <View style={styles.overridePanel}>
                      <Pressable
                        onPress={() => setOverride(player.id, undefined)}
                        style={[styles.overrideChip, !override && styles.overrideChipSelected]}
                      >
                        <Text
                          style={[styles.overrideText, !override && styles.overrideTextSelected]}
                        >
                          Team plan
                        </Text>
                      </Pressable>
                      {FOCUSES.map((option) => {
                        const selected = override === option.id;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => setOverride(player.id, option.id)}
                            style={[styles.overrideChip, selected && styles.overrideChipSelected]}
                          >
                            <Text
                              style={[styles.overrideText, selected && styles.overrideTextSelected]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    muted: { color: colors.textMuted, fontSize: fontSize.md },
    unavailableCard: { marginTop: spacing.md, gap: spacing.sm },
    unavailableTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    coachBoard: {
      position: 'relative',
      overflow: 'hidden',
      marginTop: spacing.md,
      borderWidth: 2,
      borderColor: BOARD.frame,
      borderRadius: radius.sm,
      backgroundColor: BOARD.green,
      padding: spacing.md,
      shadowColor: '#000000',
      shadowOpacity: 0.32,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    },
    tape: {
      position: 'absolute',
      top: -5,
      width: 54,
      height: 17,
      opacity: 0.78,
      backgroundColor: '#D8C69C',
    },
    tapeLeft: { left: 18, transform: [{ rotate: '-5deg' }] },
    tapeRight: { right: 18, transform: [{ rotate: '5deg' }] },
    boardHeader: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    boardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    boardTitle: {
      color: BOARD.chalk,
      fontSize: fontSize.md,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      letterSpacing: 0.8,
    },
    infoButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: BOARD.frame },
    boardSectionLabel: {
      color: BOARD.chalkMuted,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    focusButton: {
      width: '47%',
      flexGrow: 1,
      minWidth: 128,
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: 'rgba(243,235,215,0.28)',
      borderRadius: radius.sm,
      backgroundColor: 'rgba(0,0,0,0.16)',
    },
    focusButtonSelected: {
      borderWidth: 1.5,
      borderColor: colors.success,
      backgroundColor: 'rgba(48,208,112,0.14)',
    },
    focusLabel: {
      flex: 1,
      minWidth: 0,
      color: BOARD.chalk,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    focusLabelSelected: { color: '#FFFFFF' },
    selectionSummary: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(243,235,215,0.32)',
      marginTop: spacing.md,
      paddingTop: spacing.sm,
    },
    selectionKicker: {
      color: colors.success,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 0.5,
    },
    selectionDetail: { color: BOARD.chalkMuted, fontSize: fontSize.sm, marginTop: 2 },
    workloadSection: { marginTop: spacing.xl },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    intensityRow: { flexDirection: 'row', gap: spacing.sm },
    intensityButton: {
      flex: 1,
      minWidth: 0,
      minHeight: 88,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
      padding: spacing.sm,
    },
    intensityButtonSelected: {
      borderWidth: 1.5,
      borderColor: colors.success,
      backgroundColor: colors.success + '12',
    },
    intensityTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 3,
    },
    intensityTitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      textTransform: 'uppercase',
    },
    intensityTitleSelected: { color: colors.success },
    intensityDetail: { color: colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 6 },
    recoveryBand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xl,
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.success + '12',
      borderWidth: 1,
      borderColor: colors.success + '55',
    },
    recoveryCopy: { flex: 1, minWidth: 0 },
    recoveryTitle: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    recoveryText: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    overridesSheet: {
      overflow: 'hidden',
      marginTop: spacing.xl,
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    overridesHeader: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    overridesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    overridesTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontFamily: fonts.display,
      fontWeight: fontWeight.black,
      letterSpacing: 0.6,
    },
    overridesCount: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    playerList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
    playerBlock: { paddingHorizontal: spacing.md },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    playerRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    playerCopy: { flex: 1, minWidth: 0 },
    playerName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    playerRole: {
      color: colors.textMuted,
      fontSize: 10,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    playerFocusBadge: {
      maxWidth: 90,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
    },
    playerFocusText: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
    },
    overridePanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: spacing.md },
    overrideChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    overrideChipSelected: { borderColor: colors.success, backgroundColor: colors.success + '14' },
    overrideText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    overrideTextSelected: { color: colors.success },
    pressed: { opacity: 0.72 },
    footer: { gap: spacing.sm },
    footerStatus: { color: colors.warning, fontSize: fontSize.xs, textAlign: 'center' },
    footerStatusSaved: { color: colors.success },
  });
