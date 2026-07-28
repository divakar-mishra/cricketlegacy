import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { playHaptic } from '../audio';
import {
  Button,
  Card,
  ProgressBar,
  Screen,
  ScreenHeader,
  AppText as Text,
  WalletBar,
} from '../components';
import { ATTR_META, TRAINING } from '../data/attributes';
import { computeOverall } from '../engine/rating';
import { baseAttributeValue } from '../game/attributeDisplay';
import {
  canTrain,
  sessionsDone,
  TrainGain,
  TrainGroup,
  trainingCost,
  trainingFocusesForRole,
} from '../game/progression';
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

interface GainPopup {
  id: number;
  gains: TrainGain[];
  newOverall: number;
  oldOverall: number;
}

function capReason(level: string | undefined): string {
  if (level === 'SCHOOL') return 'School-level coaching cap';
  if (level === 'U19') return 'Under-19 coaching cap';
  return 'Senior professional cap';
}

function capRequirement(level: string | undefined): string {
  if (level === 'SCHOOL') return 'Earn an Under-19 call-up to raise this cap.';
  if (level === 'U19') return 'Earn a domestic contract to raise this cap.';
  return 'Keep form, fitness and coaching high to sustain long-term development.';
}

export function TrainingScreen({ navigation }: ScreenProps<'Training'>) {
  const save = useCareer((s) => s.save);
  const train = useCareer((s) => s.train);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [flash, setFlash] = useState<string | null>(null);
  const [popup, setPopup] = useState<GainPopup | null>(null);
  const [busyGroup, setBusyGroup] = useState<TrainGroup | null>(null);
  const popupCounter = useRef(0);

  // Animated values for the popup card
  const popupScale = useSharedValue(0.5);
  const popupOpacity = useSharedValue(0);

  const showPopup = useCallback(
    (gains: TrainGain[], newOvr: number, oldOvr: number) => {
      popupCounter.current += 1;
      const id = popupCounter.current;
      setPopup({ id, gains, newOverall: newOvr, oldOverall: oldOvr });
      popupScale.value = withSequence(
        withSpring(1.08, { damping: 10, stiffness: 300 }),
        withSpring(1.0, { damping: 14, stiffness: 200 }),
      );
      popupOpacity.value = withTiming(1, { duration: 180 });

      // Auto-dismiss after 2.8 s
      setTimeout(() => {
        setPopup((p) => (p?.id === id ? null : p));
        popupOpacity.value = withTiming(0, { duration: 250 });
      }, 2800);
    },
    [popupScale, popupOpacity],
  );

  const popupAnimStyle = useAnimatedStyle(() => ({
    opacity: popupOpacity.value,
    transform: [{ scale: popupScale.value }],
  }));

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
  const done = sessionsDone(player);
  const visibleGroups = trainingFocusesForRole(player.role);
  const totalAllowedSessions = Math.max(1, visibleGroups.length * TRAINING.maxSessionsPerSeason);
  const left = visibleGroups.reduce(
    (sum, group) =>
      sum + Math.max(0, TRAINING.maxSessionsPerSeason - sessionsDone(player, group.id)),
    0,
  );
  const progressPct = done / totalAllowedSessions;
  const acceleratorCharges = Math.max(0, save.inventory?.training_accelerator ?? 0);

  const onTrain = async (group: TrainGroup) => {
    if (busyGroup) return;
    setBusyGroup(group);
    const oldOvr = computeOverall(player);
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
    showPopup(res.gains, newOvr, oldOvr);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Training Ground"
        subtitle={`Season ${save.currentSeasonId ? '' : ''}· ${left} session${left === 1 ? '' : 's'} left`}
        onBack={() => navigation.goBack()}
      />
      <WalletBar wallet={save.wallet} />

      {acceleratorCharges > 0 ? (
        <View
          style={styles.acceleratorBanner}
          accessibilityLabel={`${acceleratorCharges} Training Accelerator charges remaining`}
        >
          <Text style={styles.acceleratorTitle}>Training Accelerator active</Text>
          <Text style={styles.acceleratorText}>
            Next session earns 3x gains · {acceleratorCharges} charge
            {acceleratorCharges === 1 ? '' : 's'} remaining
          </Text>
        </View>
      ) : left > 0 ? (
        <View style={styles.acceleratorOffer}>
          <View style={styles.acceleratorOfferCopy}>
            <Text style={styles.acceleratorTitle}>Accelerate this season</Text>
            <Text style={styles.acceleratorText}>
              Three sessions at 3x gains. Training limits still apply.
            </Text>
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
          <Text style={styles.progressLabel}>Training sessions this season</Text>
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
        {visibleGroups.map((group, idx) => {
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
          const groupLeft = Math.max(0, TRAINING.maxSessionsPerSeason - groupDone);
          const groupCost = trainingCost(groupDone);
          const groupTrainable = canTrain(player, group.id);
          const cost = groupCost;
          const trainable = groupTrainable;
          const cap = Math.min(
            TRAINING.attrCeiling,
            trainingAttributeCeiling(save.careerPathLevel),
          );
          const improvableCount = attrs.filter((attr) => attr.val < cap).length;
          const possibleGain =
            trainable && improvableCount > 0 ? `+1 to +${TRAINING.gainMax}` : 'No gain available';
          const blockedByCap = improvableCount === 0;

          return (
            <Animated.View key={group.id} entering={FadeInDown.duration(300).delay(80 + idx * 50)}>
              <Card style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>{group.label}</Text>
                    <Text style={styles.groupAvg}>
                      Avg: {groupAvg} · {groupLeft} left
                    </Text>
                    <Text style={styles.capLine}>
                      Possible gain: {possibleGain} · Cost: {cost.toLocaleString()} coins
                    </Text>
                  </View>
                  <Button
                    label={isBusy ? 'Training…' : trainable ? `Train · ${cost} 🪙` : 'Maxed'}
                    size="sm"
                    variant={
                      groupTrainable && save.wallet.coins >= groupCost ? 'primary' : 'secondary'
                    }
                    fullWidth={false}
                    loading={isBusy}
                    disabled={!groupTrainable || save.wallet.coins < groupCost || !!busyGroup}
                    onPress={() => void onTrain(group.id)}
                  />
                </View>
                <View style={styles.capBox}>
                  <Text style={styles.capText}>
                    Current cap: {cap} - {capReason(save.careerPathLevel)}
                  </Text>
                  <Text style={[styles.capText, blockedByCap && styles.capWarn]}>
                    {blockedByCap
                      ? capRequirement(save.careerPathLevel)
                      : `${improvableCount} attribute${improvableCount === 1 ? '' : 's'} can still improve in this focus.`}
                  </Text>
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
        })}

        <Text style={styles.note}>
          Training improves your two weakest attributes in a discipline. Costs rise each session and
          reset every new season.
        </Text>
      </ScrollView>

      {/* Gain popup overlay */}
      {popup ? (
        <Animated.View style={[styles.popupOverlay, popupAnimStyle]}>
          <View style={[styles.popupCard, shadow.card]}>
            {/* OVR change header */}
            <View style={styles.popupHeader}>
              <Text style={styles.popupTitle}>Training Complete!</Text>
              {popup.newOverall !== popup.oldOverall && (
                <Animated.View
                  entering={ZoomIn.duration(250).delay(200)}
                  style={styles.ovrChangeBadge}
                >
                  <Text style={styles.ovrChangeText}>
                    OVR {popup.oldOverall} → {popup.newOverall}
                  </Text>
                  <Text style={styles.ovrChangeDelta}>+{popup.newOverall - popup.oldOverall}</Text>
                </Animated.View>
              )}
            </View>

            {/* Individual gains */}
            {popup.gains.map((g, i) => (
              <Animated.View
                key={g.key}
                entering={FadeInDown.duration(220).delay(i * 80)}
                style={styles.gainRow}
              >
                <Text style={styles.gainLabel}>{g.label}</Text>
                <View style={styles.gainRight}>
                  <Text style={styles.gainFrom}>{g.from}</Text>
                  <Text style={styles.gainArrow}> → </Text>
                  <Text style={styles.gainTo}>{g.to}</Text>
                  <Animated.View
                    entering={ZoomIn.duration(200).delay(100 + i * 80)}
                    style={styles.gainDeltaBadge}
                  >
                    <Text style={styles.gainDelta}>+{g.to - g.from}</Text>
                  </Animated.View>
                </View>
              </Animated.View>
            ))}

            <Pressable onPress={() => setPopup(null)} style={styles.popupDismiss}>
              <Text style={styles.popupDismissText}>Tap to dismiss</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
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
    groupAvg: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
    capLine: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16, marginTop: 4 },
    capBox: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.sm,
    },
    capText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 16 },
    capWarn: { color: colors.warning, fontWeight: fontWeight.semibold },
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
    note: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      marginTop: spacing.lg,
      marginBottom: spacing.xxl,
      lineHeight: 18,
      paddingHorizontal: spacing.sm,
    },

    // Gain popup
    popupOverlay: {
      position: 'absolute',
      bottom: spacing.xxl,
      left: spacing.lg,
      right: spacing.lg,
      zIndex: 100,
    },
    popupCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.xl,
      borderWidth: 2,
      borderColor: colors.primary,
      padding: spacing.lg,
    },
    popupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
