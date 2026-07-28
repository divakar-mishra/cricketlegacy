/**
 * ContractNegotiationScreen — player career mode.
 *
 * Replaces the one-tap "Sign" button with a real negotiation flow:
 *   1. See the club's offer (weekly wage, years, bonus)
 *   2. Counter-demand: slide to your wage demand (1.0× – 1.6×), pick years
 *   3. Club accepts, or sends a counter — one more round of counters allowed
 *   4. Hold-out option: form drops but the offer improves
 *   5. Sign once happy with the terms
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, ProgressBar, Screen, ScreenHeader, WalletBar } from '../components';
import { AppText as Text } from '../components/AppText';
import {
  ContractDemand,
  contractOffer,
  ContractOffer,
  holdOut,
  negotiateContract,
  weeklyWage,
} from '../game/career';
import { storyRng } from '../game/careerEvents';
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

const YEARS_OPTIONS = [1, 2, 3, 4, 5] as const;

type Stage = 'VIEW_OFFER' | 'COUNTER' | 'RESULT' | 'SIGNED';

function fmtWeekly(annual: number): string {
  const w = weeklyWage(annual);
  if (w >= 1000) return `₹${Math.round(w / 1000)}k/week`;
  return `₹${w}/week`;
}
function fmtCoins(n: number): string {
  return n.toLocaleString() + ' coins';
}

export function ContractNegotiationScreen({ navigation }: ScreenProps<'ContractNegotiation'>) {
  const save = useCareer((s) => s.save);
  const signNegotiatedContract = useCareer((s) => s.signNegotiatedContract);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [stage, setStage] = useState<Stage>('VIEW_OFFER');
  const [clubOffer, setClubOffer] = useState<ContractOffer | null>(null);
  const [demandMult, setDemandMult] = useState(1.0);
  const [demandYears, setDemandYears] = useState<number>(2);
  const [resultText, setResultText] = useState('');
  const [counterOffer, setCounterOffer] = useState<ContractOffer | null>(null);
  const [held, setHeld] = useState(false); // has the player held out once?
  const [heldImprovedOffer, setHeldImprovedOffer] = useState<ContractOffer | null>(null);
  const [signedOffer, setSignedOffer] = useState<ContractOffer | null>(null);

  if (!save || !save.userPlayerId) {
    return (
      <Screen>
        <ScreenHeader title="Contract" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active career.</Text>
      </Screen>
    );
  }

  const user = save.players[save.userPlayerId];
  const team = save.userTeamId ? save.teams[save.userTeamId] : undefined;
  const baseOffer = clubOffer ?? contractOffer(save);
  const displayOffer = heldImprovedOffer ?? counterOffer ?? baseOffer;
  const contractBoostStored = Math.max(0, save.inventory?.contract_boost_token ?? 0);

  const doNegotiate = () => {
    const demand: ContractDemand = {
      wageMultiplier: demandMult,
      yearsOverride: demandYears,
    };
    const rng = storyRng(save, (save.story?.seenEventIds.length ?? 0) * 31 + 7);
    const result = negotiateContract(save, demand, rng);
    setResultText(result.text);
    if (result.clubAccepted) {
      setClubOffer(result.finalOffer);
      setCounterOffer(null);
      setStage('RESULT');
    } else {
      setCounterOffer(result.counterOffer ?? null);
      setStage('RESULT');
    }
  };

  const doHoldOut = () => {
    Alert.alert(
      'Hold Out?',
      'Your form will drop by 3 points while negotiations drag on, but the club should improve their offer.',
      [
        { text: 'Stay patient', style: 'cancel' },
        {
          text: 'Hold out',
          onPress: () => {
            const improved = holdOut(save);
            setHeldImprovedOffer(improved);
            setHeld(true);
            setResultText(
              'You held your ground. The club came back with a slightly improved offer.',
            );
            setClubOffer(improved);
            setCounterOffer(null);
            setStage('RESULT');
          },
        },
      ],
    );
  };

  const doSign = (offer: ContractOffer) => {
    // Route through the store action so the signing bonus is actually credited
    // to the wallet, a timeline entry is written, and the save is persisted.
    const signed = signNegotiatedContract(offer);
    if (signed.ok) {
      setSignedOffer(signed.offer ?? offer);
      setStage('SIGNED');
    }
  };

  // ── Signed confirmation ──────────────────────────────────────────────────
  if (stage === 'SIGNED') {
    const signed = signedOffer ?? heldImprovedOffer ?? counterOffer ?? clubOffer ?? baseOffer;
    return (
      <Screen scroll>
        <ScreenHeader title="Contract Signed!" onBack={() => navigation.goBack()} />
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={styles.signedCard}>
            <Text style={styles.signedTitle}>✅ Deal Done</Text>
            <Text style={styles.signedTeam}>{team?.name ?? 'Your club'}</Text>
            <View style={styles.dealGrid}>
              <DealItem label="Weekly wage" value={fmtWeekly(signed.wage)} highlight />
              <DealItem
                label="Contract length"
                value={`${signed.years} year${signed.years !== 1 ? 's' : ''}`}
              />
              <DealItem label="Signing bonus" value={fmtCoins(signed.signingBonus)} />
            </View>
            <Text style={[styles.note, { marginTop: spacing.md }]}>
              Your new deal starts immediately. Perform well to secure an even better renewal.
            </Text>
          </Card>
        </Animated.View>
        <Button
          label="Back to Hub"
          variant="gold"
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl }}
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  // ── Result of negotiation ────────────────────────────────────────────────
  if (stage === 'RESULT') {
    const toSign = heldImprovedOffer ?? counterOffer ?? clubOffer ?? baseOffer;
    const accepted = !counterOffer && !heldImprovedOffer;
    return (
      <Screen scroll>
        <ScreenHeader title="Club Response" onBack={() => navigation.goBack()} />
        <Animated.View entering={FadeInDown.duration(350)}>
          <Card
            style={[styles.resultCard, { borderColor: accepted ? colors.success : colors.accent }]}
          >
            <Text
              style={[styles.resultTitle, { color: accepted ? colors.success : colors.accent }]}
            >
              {accepted ? '🎉 Accepted!' : '🤝 Counter-Offer'}
            </Text>
            <Text style={styles.resultText}>{resultText}</Text>
          </Card>
        </Animated.View>

        <Text style={styles.section}>Terms on the table</Text>
        <Animated.View entering={FadeInDown.duration(300).delay(100)}>
          <Card>
            <View style={styles.dealGrid}>
              <DealItem label="Weekly wage" value={fmtWeekly(toSign.wage)} highlight />
              <DealItem
                label="Contract length"
                value={`${toSign.years} year${toSign.years !== 1 ? 's' : ''}`}
              />
              <DealItem label="Signing bonus" value={fmtCoins(toSign.signingBonus)} />
            </View>
          </Card>
        </Animated.View>

        <View style={styles.actions}>
          <Button label="✅ Sign this deal" variant="gold" onPress={() => doSign(toSign)} />
          {!held && (
            <Button
              label="⏳ Hold out for more"
              variant="secondary"
              style={{ marginTop: spacing.sm }}
              onPress={doHoldOut}
            />
          )}
          {counterOffer && !held && (
            <Button
              label="↩ Counter again"
              variant="ghost"
              style={{ marginTop: spacing.sm }}
              onPress={() => {
                setCounterOffer(null);
                setClubOffer(counterOffer);
                setStage('COUNTER');
              }}
            />
          )}
          <Button
            label="✗ Walk away"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  // ── Counter demand UI ────────────────────────────────────────────────────
  if (stage === 'COUNTER') {
    const demandedWage = Math.round(displayOffer.wage * demandMult);
    const steps = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6] as const;

    return (
      <Screen scroll>
        <ScreenHeader title="Your Demands" onBack={() => setStage('VIEW_OFFER')} />

        <Animated.View entering={FadeInDown.duration(300)}>
          <Card style={styles.demandCard}>
            <Text style={styles.demandLabel}>WAGE DEMAND</Text>
            <Text style={styles.demandValue}>{fmtWeekly(demandedWage)}</Text>
            <Text style={styles.demandMult}>
              {demandMult === 1.0
                ? 'Accepting the offer as-is'
                : `${((demandMult - 1) * 100).toFixed(0)}% above the club's offer`}
            </Text>

            {/* Wage multiplier selector */}
            <View style={styles.stepsRow}>
              {steps.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.stepBtn, demandMult === s && styles.stepBtnActive]}
                  onPress={() => setDemandMult(s)}
                >
                  <Text style={[styles.stepText, demandMult === s && styles.stepTextActive]}>
                    {s === 1.0 ? 'As-is' : `+${((s - 1) * 100).toFixed(0)}%`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(320).delay(80)}>
          <Card style={{ marginHorizontal: spacing.lg }}>
            <Text style={styles.demandLabel}>CONTRACT LENGTH</Text>
            <View style={styles.yearsRow}>
              {YEARS_OPTIONS.map((y) => (
                <Pressable
                  key={y}
                  style={[styles.yearBtn, demandYears === y && styles.yearBtnActive]}
                  onPress={() => setDemandYears(y)}
                >
                  <Text style={[styles.yearText, demandYears === y && styles.yearTextActive]}>
                    {y}yr
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </Animated.View>

        {/* Acceptance likelihood indicator */}
        <Animated.View entering={FadeInDown.duration(340).delay(120)}>
          <Card style={{ marginHorizontal: spacing.lg }}>
            <Text style={styles.demandLabel}>ESTIMATED ACCEPTANCE CHANCE</Text>
            <ProgressBar
              value={Math.max(0.05, 0.92 - (demandMult - 1) * 1.4)}
              color={
                demandMult <= 1.1
                  ? colors.success
                  : demandMult <= 1.3
                    ? colors.warning
                    : colors.danger
              }
              style={{ marginTop: spacing.xs }}
            />
            <Text style={[styles.note, { marginTop: spacing.xs }]}>
              {demandMult <= 1.0
                ? 'Guaranteed acceptance'
                : demandMult <= 1.1
                  ? 'Very likely to be accepted'
                  : demandMult <= 1.2
                    ? 'Likely'
                    : demandMult <= 1.3
                      ? 'Club may push back'
                      : demandMult <= 1.4
                        ? 'Risky — expect a counter'
                        : 'Bold — they may walk away from negotiations'}
            </Text>
          </Card>
        </Animated.View>

        <View style={styles.actions}>
          <Button label="Submit demand" variant="primary" onPress={doNegotiate} />
          <Button
            label="⏳ Hold out instead"
            variant="secondary"
            style={{ marginTop: spacing.sm }}
            onPress={doHoldOut}
            disabled={held}
          />
          <Button
            label="Accept their offer as-is"
            variant="ghost"
            style={{ marginTop: spacing.sm }}
            onPress={() => doSign(displayOffer)}
          />
        </View>
      </Screen>
    );
  }

  // ── Initial offer view ───────────────────────────────────────────────────
  return (
    <Screen scroll>
      <ScreenHeader
        title="Contract Offer"
        subtitle={team?.name}
        onBack={() => navigation.goBack()}
      />

      <WalletBar wallet={save.wallet} />

      <Animated.View entering={FadeInDown.duration(320)}>
        <Card style={[styles.offerCard, { borderColor: colors.accent }]}>
          <Text style={styles.offerFrom}>📝 {team?.name ?? 'Club'} Offer</Text>
          <View style={styles.dealGrid}>
            <DealItem label="Weekly wage" value={fmtWeekly(baseOffer.wage)} highlight />
            <DealItem label="Annual salary" value={`₹${Math.round(baseOffer.wage / 1000)}k/yr`} />
            <DealItem
              label="Contract length"
              value={`${baseOffer.years} year${baseOffer.years !== 1 ? 's' : ''}`}
            />
            <DealItem label="Signing bonus" value={fmtCoins(baseOffer.signingBonus)} />
          </View>
          <Text style={styles.note}>
            Your overall is {user?.overall}/100
            {(save.userCaps ?? 0) > 0 ? ` · ${save.userCaps} international caps` : ''}.
            {baseOffer.wage > 50000
              ? ' The club values you highly.'
              : ' There is room to negotiate upward.'}
          </Text>
        </Card>
      </Animated.View>

      <View style={[styles.boostBand, contractBoostStored > 0 && styles.boostBandActive]}>
        <View style={styles.boostCopy}>
          <Text style={styles.boostTitle}>
            {contractBoostStored > 0 ? 'Renewal boost ready' : 'Want stronger terms?'}
          </Text>
          <Text style={styles.boostText}>
            {contractBoostStored > 0
              ? '+25% wage and signing bonus will apply when you sign.'
              : 'The optional renewal boost adds 25% to your next signed wage and bonus.'}
          </Text>
        </View>
        {contractBoostStored === 0 ? (
          <Button
            label="View boost"
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => navigation.navigate('Purchase')}
          />
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button label="✅ Sign this deal" variant="gold" onPress={() => doSign(baseOffer)} />
        <Animated.View entering={FadeInRight.duration(300).delay(150)}>
          <Button
            label="💬 Negotiate for more"
            variant="primary"
            style={{ marginTop: spacing.sm }}
            onPress={() => {
              setDemandMult(1.1);
              setDemandYears(baseOffer.years);
              setStage('COUNTER');
            }}
          />
        </Animated.View>
        <Button
          label="⏳ Hold out — wait for better"
          variant="secondary"
          style={{ marginTop: spacing.sm }}
          onPress={doHoldOut}
          disabled={held}
        />
        <Button
          label="✗ Reject & test the market"
          variant="ghost"
          style={{ marginTop: spacing.sm }}
          onPress={() => navigation.goBack()}
        />
      </View>
    </Screen>
  );
}

function DealItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text
        style={{
          color: colors.textFaint,
          fontSize: fontSize.xs,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: highlight ? colors.accent : colors.text,
          fontSize: highlight ? fontSize.xl : fontSize.md,
          fontWeight: fontWeight.heavy,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.lg },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginHorizontal: spacing.lg,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    note: { color: colors.textFaint, fontSize: fontSize.xs, lineHeight: 16 },
    offerCard: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderWidth: 1.5 },
    offerFrom: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.md,
    },
    dealGrid: { gap: spacing.sm },
    boostBand: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    boostBandActive: { borderColor: colors.accent },
    boostCopy: { flex: 1, minWidth: 180 },
    boostTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    boostText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: 2 },
    actions: { marginHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl },
    signedCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
    signedTitle: {
      color: colors.success,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      marginBottom: spacing.xs,
    },
    signedTeam: { color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.md },
    resultCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, borderWidth: 1.5 },
    resultTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginBottom: spacing.xs },
    resultText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
    demandCard: { marginHorizontal: spacing.lg, marginTop: spacing.md },
    demandLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    demandValue: { color: colors.accent, fontSize: fontSize.xxxl, fontWeight: fontWeight.black },
    demandMult: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      marginBottom: spacing.md,
    },
    stepsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    stepBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepBtnActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    stepText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
    stepTextActive: { color: colors.white },
    yearsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    yearBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    yearBtnActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    yearText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    yearTextActive: { color: colors.white },
  });
