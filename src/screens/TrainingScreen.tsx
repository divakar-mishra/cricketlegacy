import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { playHaptic } from '../audio';
import { showShortageOffer } from '../components/showShortageOffer';
import { PlayerDevelopmentPanel } from '../components/PlayerDevelopmentPanel';
import {
  Button,
  Card,
  Icon,
  ProgressBar,
  Screen,
  ScreenHeader,
  SMOOTH_CARD_ZOOM,
  SMOOTH_MODAL_ENTER,
  SMOOTH_MODAL_EXIT,
  AppText as Text,
  WalletBar,
} from '../components';
import { ATTR_META, TRAINING } from '../data/attributes';
import { computeOverall, computeOverallRaw } from '../engine/rating';
import { baseAttributeValue } from '../game/attributeDisplay';
import { resolveNextCareerStep } from '../game/careerStep';
import {
  canTrain,
  sessionsDone,
  TrainGain,
  TrainGroup,
  trainingCost,
  trainingFocusSessionLimit,
  trainingFocusesForRole,
  trainingSessionLimit,
} from '../game/progression';
import { nextUserFixtureId } from '../game/season';
import { trainingAttributeCeiling } from '../game/youthBalance';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
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
import { ManagerTrainingScreen } from './ManagerTrainingScreen';

interface GainPopup {
  id: number;
  gains: TrainGain[];
  newOverall: number;
  oldOverall: number;
  newDevelopment: number;
  oldDevelopment: number;
}

export function TrainingScreen({ navigation }: ScreenProps<'Training'>) {
  const save = useCareer((s) => s.save);
  const train = useCareer((s) => s.train);
  const advanceSeason = useCareer((s) => s.advanceSeason);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [flash, setFlash] = useState<string | null>(null);
  const [popup, setPopup] = useState<GainPopup | null>(null);
  const [busyGroup, setBusyGroup] = useState<TrainGroup | null>(null);
  const [showDevelopment, setShowDevelopment] = useState(false);
  const popupCounter = useRef(0);

  const showPopup = useCallback(
    (
      gains: TrainGain[],
      newOvr: number,
      oldOvr: number,
      newDevelopment: number,
      oldDevelopment: number,
    ) => {
      popupCounter.current += 1;
      const id = popupCounter.current;
      setPopup({
        id,
        gains,
        newOverall: newOvr,
        oldOverall: oldOvr,
        newDevelopment,
        oldDevelopment,
      });
    },
    [],
  );

  if (save?.mode === 'manager') {
    return <ManagerTrainingScreen navigation={navigation} />;
  }

  if (!save || !save.userPlayerId) {
    return (
      <Screen>
        <ScreenHeader title="Training" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>Training is only available in a Player Career.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const player = save.players[save.userPlayerId];
  const overall = computeOverall(player);
  const development = computeOverallRaw(player);
  const done = sessionsDone(player);
  const visibleGroups = trainingFocusesForRole(player.role);
  const totalAllowedSessions = trainingSessionLimit(save.careerPathLevel);
  const left = Math.max(0, totalAllowedSessions - done);
  const progressPct = done / totalAllowedSessions;
  const overallProgress = Math.max(0, Math.min(1, development - (overall - 0.5)));
  const acceleratorCharges = Math.max(0, save.inventory?.training_accelerator ?? 0);
  const activeCoachCount = Object.values(save.playerLife?.personalCoaches ?? {}).filter(
    (coach) => (coach?.seasonsRemaining ?? 0) > 0,
  ).length;
  const ownedEquipmentCount = save.playerLife?.equipmentIds?.length ?? 0;
  const nextFixtureId = nextUserFixtureId(save);
  const activeAnalysis =
    nextFixtureId && save.playerLife?.lastAnalysisReport?.fixtureId === nextFixtureId
      ? save.playerLife.lastAnalysisReport
      : undefined;
  const canContinueWithoutTraining =
    resolveNextCareerStep(save).action === 'ADVANCE_CAREER_CALENDAR';

  const onTrain = async (group: TrainGroup) => {
    if (busyGroup) return;
    setBusyGroup(group);
    const oldOvr = computeOverall(player);
    const oldDevelopment = computeOverallRaw(player);
    const res = await train(group);
    setBusyGroup(null);

    if (!res.ok) {
      setFlash(res.reason ?? 'Cannot train right now.');
      setTimeout(() => setFlash(null), 2500);
      return;
    }

    // Haptic feedback
    try {
      playHaptic('notify-success');
    } catch {
      /* haptics optional */
    }

    const trainedPlayer = save.players[save.userPlayerId!];
    const newOvr = trainedPlayer ? computeOverall(trainedPlayer) : oldOvr;
    const newDevelopment = trainedPlayer ? computeOverallRaw(trainedPlayer) : oldDevelopment;
    showPopup(res.gains, newOvr, oldOvr, newDevelopment, oldDevelopment);
  };

  return (
    <Screen
      footer={
        canContinueWithoutTraining ? (
          <Button
            label="Continue without training"
            variant="gold"
            onPress={() => {
              advanceSeason();
              navigation.goBack();
            }}
          />
        ) : undefined
      }
    >
      <ScreenHeader
        title="Training Ground"
        subtitle={`${left} session${left === 1 ? '' : 's'} left`}
        onBack={() => navigation.goBack()}
      />
      <WalletBar wallet={save.wallet} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          showDevelopment ? 'Return to training sessions' : 'Open Development Centre'
        }
        style={({ pressed }) => [
          styles.supportStrip,
          showDevelopment && styles.supportStripActive,
          pressed && styles.supportStripPressed,
        ]}
        onPress={() => setShowDevelopment((current) => !current)}
      >
        <View style={styles.supportIcon}>
          <Icon name="fitness-outline" size={24} color={colors.accent} />
        </View>
        <View style={styles.supportCopy}>
          <Text style={styles.supportTitle}>Development Centre</Text>
          <Text style={styles.supportStatus}>
            {activeCoachCount} coach{activeCoachCount === 1 ? '' : 'es'} · Equipment{' '}
            {ownedEquipmentCount}/4
          </Text>
        </View>
        <View style={styles.supportAction}>
          <Text style={styles.supportActionText}>{showDevelopment ? 'SESSIONS' : 'OPEN'}</Text>
          <Icon
            name={showDevelopment ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={colors.accent}
          />
        </View>
      </Pressable>

      {activeAnalysis ? (
        <View style={styles.analystBanner}>
          <View style={styles.analystCopy}>
            <Text style={styles.analystTitle}>
              Analyst focus: {activeAnalysis.recommendedTrainingGroup.replace('_', ' ')}
            </Text>
          </View>
        </View>
      ) : null}

      {acceleratorCharges > 0 ? (
        <View
          style={styles.acceleratorBanner}
          accessibilityLabel={`${acceleratorCharges} Training Accelerator charges remaining`}
        >
          <Text style={styles.acceleratorTitle}>Training Accelerator active</Text>
          <Text style={styles.acceleratorText}>
            1.5× gains · {acceleratorCharges} charge
            {acceleratorCharges === 1 ? '' : 's'} remaining
          </Text>
        </View>
      ) : left > 0 ? (
        <View style={styles.acceleratorOffer}>
          <View style={styles.acceleratorOfferCopy}>
            <Text style={styles.acceleratorTitle}>Accelerate this season</Text>
            <Text style={styles.acceleratorText}>3 boosted sessions</Text>
          </View>
          <Button
            label="View boost"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => navigation.navigate('Purchase')}
          />
        </View>
      ) : null}

      {/* Sessions progress bar */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.progressBox}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Sessions</Text>
          <Text style={styles.progressCount}>
            {done} / {totalAllowedSessions}
          </Text>
        </View>
        <ProgressBar value={progressPct} color={colors.primary} style={{ marginTop: spacing.xs }} />
      </Animated.View>

      {/* Player OVR card */}
      <Animated.View entering={FadeInDown.duration(320).delay(40)}>
        <Card style={styles.ovrCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{player.name}</Text>
            <Text style={styles.sub}>
              Form {player.meta.form} · Fitness {player.meta.fitness} · Age {player.age}
            </Text>
            <View style={styles.ovrProgressRow}>
              <Text style={styles.ovrProgressText}>Development {development.toFixed(2)}</Text>
              <Text style={styles.ovrProgressText}>Next OVR {Math.min(99, overall + 1)}</Text>
            </View>
            <ProgressBar
              value={overall >= 99 ? 1 : overallProgress}
              color={colors.accent}
              style={styles.ovrProgressBar}
            />
            {left === 0 && (
              <Text style={styles.maxNote}>Max sessions reached — resets next season</Text>
            )}
          </View>
          <View style={styles.ovrBadge}>
            <Text style={styles.ovrValue}>{overall}</Text>
            <Text style={styles.ovrLabel}>OVR</Text>
          </View>
        </Card>
      </Animated.View>

      {/* Flash error */}
      {flash ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(300)}
          style={styles.flashCard}
        >
          <Text style={styles.flashText}>{flash}</Text>
        </Animated.View>
      ) : null}

      {/* Attribute groups */}
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {showDevelopment ? (
          <PlayerDevelopmentPanel />
        ) : (
          visibleGroups.map((group, idx) => {
            const obj = player[group.sourceGroup] as unknown as Record<string, number>;
            const labels = new Map(
              ATTR_META[group.sourceGroup].map(([key, label]) => [key as string, label]),
            );
            const attrs = group.attributes.map((key) => ({
              key,
              label: labels.get(key) ?? key,
              val: baseAttributeValue(obj[key]),
            }));
            const groupAvg = Math.round(attrs.reduce((s, a) => s + a.val, 0) / attrs.length);
            const isBusy = busyGroup === group.id;
            const groupDone = sessionsDone(player, group.id);
            const groupLeft = Math.max(
              0,
              Math.min(trainingFocusSessionLimit(save.careerPathLevel) - groupDone, left),
            );
            const groupCost = trainingCost(done, overall, player.role);
            const groupTrainable = canTrain(player, group.id, save.careerPathLevel);
            const canAfford = save.wallet.coins >= groupCost;
            const cost = groupCost;
            const trainable = groupTrainable;
            const cap = Math.min(
              TRAINING.attrCeiling,
              trainingAttributeCeiling(save.careerPathLevel),
            );
            const improvableCount = attrs.filter((attr) => attr.val < cap).length;
            const blockedByCap = improvableCount === 0;
            const analystRecommended = activeAnalysis?.recommendedTrainingGroup === group.id;

            return (
              <Animated.View
                key={group.id}
                entering={FadeInDown.duration(300).delay(80 + idx * 50)}
              >
                <Card style={[styles.groupCard, analystRecommended && styles.recommendedGroup]}>
                  <View style={styles.groupHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupTitle}>{group.label}</Text>
                      {analystRecommended ? (
                        <Text style={styles.recommendedLabel}>Analyst recommendation</Text>
                      ) : null}
                      <Text style={styles.groupAvg}>
                        Avg {groupAvg} · {groupLeft} left
                      </Text>
                    </View>
                    <Button
                      label={
                        isBusy
                          ? 'Training...'
                          : blockedByCap
                            ? 'Stage cap reached'
                            : trainable
                              ? canAfford
                                ? `Train · ${cost}`
                                : `Need ${cost}`
                              : 'Season limit reached'
                      }
                      size="sm"
                      variant={groupTrainable && !blockedByCap ? 'primary' : 'secondary'}
                      fullWidth={false}
                      loading={isBusy}
                      disabled={!groupTrainable || blockedByCap || !!busyGroup}
                      onPress={() => {
                        if (!canAfford && showShortageOffer(save, 'coins',
                          (productId) => navigation.navigate('Purchase', { productId }), cost - save.wallet.coins)) return;
                        void onTrain(group.id);
                      }}
                    />
                  </View>
                  {attrs.map((attr) => (
                    <View key={attr.key} style={styles.attrRow}>
                      <Text style={styles.attrLabel}>{attr.label}</Text>
                      <View style={styles.attrRight}>
                        <View style={styles.attrBarBg}>
                          <View style={[styles.attrBarFill, { width: `${attr.val}%` }]} />
                        </View>
                        <Text style={styles.attrVal}>{attr.val}</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* Gain popup overlay */}
      {popup ? (
        <Modal transparent visible animationType="none" onRequestClose={() => setPopup(null)}>
          <Animated.View
            entering={SMOOTH_MODAL_ENTER}
            exiting={SMOOTH_MODAL_EXIT}
            style={styles.popupOverlay}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss training result"
              style={styles.popupDismissSurface}
              onPress={() => setPopup(null)}
            >
              <Animated.View entering={SMOOTH_CARD_ZOOM} style={[styles.popupCard, shadow.card]}>
                <View style={styles.popupHeader}>
                  <Text style={styles.popupTitle}>Training Complete!</Text>
                  <View style={styles.ovrChangeBadge}>
                    <Text style={styles.ovrChangeText}>
                      {popup.newOverall !== popup.oldOverall
                        ? `OVR ${popup.oldOverall} → ${popup.newOverall}`
                        : `OVR progress ${popup.oldDevelopment.toFixed(2)} → ${popup.newDevelopment.toFixed(2)}`}
                    </Text>
                    <Text style={styles.ovrChangeDelta}>
                      +{popup.gains.reduce((total, gain) => total + gain.to - gain.from, 0)} growth
                    </Text>
                  </View>
                </View>

                {popup.gains.map((g) => (
                  <View key={g.key} style={styles.gainRow}>
                    <Text style={styles.gainLabel}>{g.label}</Text>
                    <View style={styles.gainRight}>
                      <Text style={styles.gainFrom}>{g.from}</Text>
                      <Text style={styles.gainArrow}> → </Text>
                      <Text style={styles.gainTo}>{g.to}</Text>
                      <View style={styles.gainDeltaBadge}>
                        <Text style={styles.gainDelta}>+{g.to - g.from}</Text>
                      </View>
                    </View>
                  </View>
                ))}

                <View style={styles.popupDismiss}>
                  <Text style={styles.popupDismissText}>Tap to close</Text>
                </View>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </Modal>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    supportStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2,
      borderColor: colors.accent,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    supportStripActive: { backgroundColor: colors.accent + '12' },
    supportStripPressed: { opacity: 0.82 },
    supportIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent + '18',
      borderWidth: 1,
      borderColor: colors.accent,
    },
    supportCopy: { flex: 1, minWidth: 0 },
    supportTitle: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    supportStatus: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    supportAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    supportActionText: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 0.8,
    },
    analystBanner: {
      flexDirection: 'row',
      borderWidth: 1,
      borderLeftWidth: 3,
      borderColor: colors.accent,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    analystCopy: { flex: 1, minWidth: 0 },
    analystTitle: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.heavy,
      textTransform: 'capitalize',
    },
    analystText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 17,
      marginTop: spacing.xs,
    },
    progressBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    acceleratorBanner: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    acceleratorOffer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginTop: spacing.sm,
    },
    acceleratorOfferCopy: { flex: 1, minWidth: 180 },
    acceleratorTitle: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    acceleratorText: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 3 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressLabel: { color: colors.textMuted, fontSize: fontSize.sm },
    progressCount: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    ovrCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    name: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    sub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    ovrProgressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginRight: spacing.sm,
    },
    ovrProgressText: { color: colors.textMuted, fontSize: fontSize.xs },
    ovrProgressBar: { marginTop: 4, marginRight: spacing.sm },
    maxNote: { color: colors.warning, fontSize: fontSize.xs, marginTop: 4 },
    ovrBadge: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 2.5,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.md,
    },
    ovrValue: {
      color: colors.accent,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      fontFamily: fonts.display,
    },
    ovrLabel: { color: colors.textMuted, fontSize: 9, letterSpacing: 1 },
    flashCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.warning,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    flashText: { color: colors.warning, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    groupCard: { marginBottom: spacing.sm },
    recommendedGroup: { borderColor: colors.accent, borderLeftWidth: 3 },
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    groupTitle: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    recommendedLabel: {
      color: colors.success,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      marginTop: 2,
      textTransform: 'uppercase',
    },
    groupAvg: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
    attrRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    attrLabel: { color: colors.textMuted, fontSize: fontSize.sm, flex: 1 },
    attrRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: 120 },
    attrBarBg: {
      flex: 1,
      height: 6,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    attrBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
    },
    attrVal: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      width: 26,
      textAlign: 'right',
    },
    // Gain popup
    popupOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    popupDismissSurface: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    popupCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.xl,
      borderWidth: 2,
      borderColor: colors.primary,
      padding: spacing.lg,
    },
    popupHeader: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    popupTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    ovrChangeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing.xs,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    ovrChangeText: { color: colors.black, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    ovrChangeDelta: { color: colors.black, fontSize: fontSize.sm, fontWeight: fontWeight.black },
    gainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    gainLabel: { color: colors.textMuted, fontSize: fontSize.sm, flex: 1 },
    gainRight: { flexDirection: 'row', alignItems: 'center' },
    gainFrom: { color: colors.textFaint, fontSize: fontSize.sm },
    gainArrow: { color: colors.textMuted, fontSize: fontSize.sm },
    gainTo: { color: colors.primaryLight, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    gainDeltaBadge: {
      backgroundColor: colors.success,
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: spacing.sm,
    },
    gainDelta: { color: colors.white, fontSize: 11, fontWeight: fontWeight.black },
    popupDismiss: { marginTop: spacing.md, alignItems: 'center' },
    popupDismissText: { color: colors.textFaint, fontSize: fontSize.xs },
  });
