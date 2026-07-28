/**
 * InvestmentScreen — personal stock portfolio manager.
 * Feature 2: shows portfolio, sparkline history, invest/withdraw actions.
 */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { Sparkline } from '../components/charts/Sparkline';
import { LEGACY_TIERS, legacyRank } from '../data/legacy';
import { STOCK_MAX_INVEST, STOCK_MIN_INVEST } from '../game/career';
import { stockMarketUnlocked } from '../game/readiness';
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

export function InvestmentScreen({ navigation }: ScreenProps<'InvestmentScreen'>) {
  const save = useCareer((s) => s.save);
  const investStocksAction = useCareer((s) => s.investStocksAction);
  const withdrawStocksAction = useCareer((s) => s.withdrawStocksAction);
  const contributeLegacy = useCareer((s) => s.contributeLegacy);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [amount, setAmount] = useState('');

  if (!save) {
    return (
      <Screen>
        <ScreenHeader title="Investment Portfolio" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active save.</Text>
      </Screen>
    );
  }

  // Defense-in-depth: youth pathways (School/U14, U19) can never open the market,
  // regardless of how this screen was reached.
  const userAge = save.userPlayerId ? (save.players[save.userPlayerId]?.age ?? 0) : 0;
  if (save.mode === 'career' && !stockMarketUnlocked(save.careerPathLevel, userAge)) {
    return (
      <Screen>
        <ScreenHeader title="Investment Portfolio" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>
          The stock market unlocks once you turn 18 and reach domestic cricket. Keep developing your
          career first.
        </Text>
      </Screen>
    );
  }

  const inv = save.stockInvestment;
  const invested = inv?.invested ?? 0;
  const currentValue = inv?.currentValue ?? 0;
  const totalWithdrawn = inv?.totalWithdrawn ?? 0;
  const history = inv?.history ?? [];
  const pnl = currentValue - invested;
  const pnlPct = invested > 0 ? ((pnl / invested) * 100).toFixed(1) : '0.0';
  const pnlColor = pnl >= 0 ? colors.success : colors.danger;

  const handleInvest = () => {
    const coins = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(coins) || coins < STOCK_MIN_INVEST) {
      Alert.alert(
        'Invalid amount',
        `Minimum investment is ${STOCK_MIN_INVEST.toLocaleString()} coins.`,
      );
      return;
    }
    if (coins > STOCK_MAX_INVEST) {
      Alert.alert(
        'Invalid amount',
        `Maximum investment is ${STOCK_MAX_INVEST.toLocaleString()} coins.`,
      );
      return;
    }
    const res = investStocksAction(coins);
    if (!res.ok) {
      Alert.alert('Investment failed', res.reason ?? 'Unknown error.');
      return;
    }
    setAmount('');
    Alert.alert('Invested!', `${coins.toLocaleString()} coins are now in the market.`);
  };

  const handleWithdraw = () => {
    if (currentValue <= 0) {
      Alert.alert('No position', 'You have no active investment to withdraw.');
      return;
    }
    Alert.alert(
      'Withdraw all funds?',
      `You will receive ${currentValue.toLocaleString()} coins back into your wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: () => {
            const withdrawn = withdrawStocksAction();
            if (withdrawn > 0) {
              Alert.alert('Withdrawn', `${withdrawn.toLocaleString()} coins added to your wallet.`);
            }
          },
        },
      ],
    );
  };

  const legacyPoints = save.legacyPoints ?? 0;
  const legacyRankTitle = legacyRank(legacyPoints);
  const handleContribute = (tier: (typeof LEGACY_TIERS)[number]) => {
    Alert.alert(
      `Fund: ${tier.label}?`,
      `Spend ${tier.coinCost.toLocaleString()} coins for +${tier.points} legacy. This is a prestige contribution — it builds your legacy rank and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fund',
          onPress: () => {
            const res = contributeLegacy(tier.id);
            if (!res.ok) Alert.alert('Cannot fund', res.reason ?? 'Please try again.');
            else Alert.alert('Legacy grows', `${tier.label} funded. Your legacy rank is updated.`);
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Investment Portfolio" onBack={() => navigation.goBack()} />

      {/* Current portfolio card */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.portfolioCard}>
          <Text style={styles.sectionLabel}>CURRENT POSITION</Text>
          <View style={styles.valueRow}>
            <View>
              <Text style={styles.valueLabel}>Current Value</Text>
              <Text style={[styles.valueAmount, { color: colors.accent }]}>
                {currentValue.toLocaleString()} coins
              </Text>
            </View>
            <View style={styles.pnlBox}>
              <Text style={[styles.pnlAmount, { color: pnlColor }]}>
                {pnl >= 0 ? '+' : ''}
                {pnl.toLocaleString()}
              </Text>
              <Text style={[styles.pnlPct, { color: pnlColor }]}>({pnlPct}%)</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Invested</Text>
              <Text style={styles.metaValue}>{invested.toLocaleString()}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Total Withdrawn</Text>
              <Text style={styles.metaValue}>{totalWithdrawn.toLocaleString()}</Text>
            </View>
          </View>

          {/* Sparkline chart */}
          {history.length >= 2 && (
            <View style={styles.chartRow}>
              <Sparkline
                values={history}
                width={280}
                height={52}
                color={pnl >= 0 ? colors.success : colors.danger}
              />
              <Text style={styles.chartCaption}>Last {history.length} seasons</Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Invest input */}
      <Animated.View entering={FadeInDown.duration(350).delay(80)}>
        <Card style={styles.inputCard}>
          <Text style={styles.sectionLabel}>INVEST COINS</Text>
          <Text style={styles.note}>
            Min {STOCK_MIN_INVEST.toLocaleString()} · Max {STOCK_MAX_INVEST.toLocaleString()} coins
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="Enter amount"
              placeholderTextColor={colors.textFaint}
            />
            <Button
              label="Invest"
              size="sm"
              fullWidth={false}
              onPress={handleInvest}
              style={styles.investBtn}
            />
          </View>
          <Text style={styles.walletLine}>
            Wallet: {save.wallet.coins.toLocaleString()} coins available
          </Text>
        </Card>
      </Animated.View>

      {/* Withdraw */}
      {currentValue > 0 && (
        <Animated.View entering={FadeInDown.duration(380).delay(120)}>
          <Button
            label={`Withdraw all (${currentValue.toLocaleString()} coins)`}
            variant="secondary"
            style={styles.withdrawBtn}
            onPress={handleWithdraw}
          />
        </Animated.View>
      )}

      {/* Risk disclosure */}
      <Animated.View entering={FadeInDown.duration(400).delay(160)}>
        <Card style={styles.riskCard}>
          <Text style={styles.sectionLabel}>RISK DISCLOSURE</Text>
          <Text style={styles.riskText}>
            Your stock portfolio fluctuates ±10% each season, influenced by your team's win rate and
            general market noise. A dominant season drives positive drift; a losing run weighs on
            returns. Past performance does not guarantee future results. All investments can lose
            value.
          </Text>
        </Card>
      </Animated.View>

      {/* ── Legacy Fund (late-game coin sink) ── */}
      <Animated.View entering={FadeInDown.duration(420).delay(200)}>
        <Card style={styles.legacyCard}>
          <View style={styles.legacyHeader}>
            <Text style={styles.sectionLabel}>LEGACY FUND</Text>
            <View style={styles.legacyRankPill}>
              <Text style={styles.legacyRankText}>
                {legacyRankTitle} · {legacyPoints} pts
              </Text>
            </View>
          </View>
          <Text style={styles.riskText}>
            Put your career fortune to work off the field. Legacy contributions are pure prestige —
            they build your permanent Legacy rank and never expire, but grant no in-game advantage.
          </Text>
          {LEGACY_TIERS.map((t) => {
            const owned = (save.inventory?.[t.id] ?? 0) > 0;
            const affordable = save.wallet.coins >= t.coinCost;
            return (
              <View key={t.id} style={styles.legacyRow}>
                <Text style={styles.legacyIcon}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legacyLabel}>{t.label}</Text>
                  <Text style={styles.legacyDesc}>{t.description}</Text>
                  <Text style={styles.legacyPts}>+{t.points} legacy</Text>
                </View>
                <Button
                  label={owned ? 'Funded ✓' : t.coinCost.toLocaleString()}
                  size="sm"
                  variant={owned ? 'secondary' : 'gold'}
                  fullWidth={false}
                  disabled={owned || !affordable}
                  onPress={() => handleContribute(t)}
                />
              </View>
            );
          })}
          <Text style={styles.walletLine}>Wallet: {save.wallet.coins.toLocaleString()} coins</Text>
        </Card>
      </Animated.View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.lg },
    sectionLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    portfolioCard: { marginTop: spacing.lg },
    valueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    valueLabel: { color: colors.textMuted, fontSize: fontSize.xs },
    valueAmount: { fontSize: fontSize.xxl, fontWeight: fontWeight.black, marginTop: 2 },
    pnlBox: { alignItems: 'flex-end' },
    pnlAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    pnlPct: { fontSize: fontSize.xs, marginTop: 2 },
    metaRow: {
      flexDirection: 'row',
      gap: spacing.xl,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    metaItem: {},
    metaLabel: { color: colors.textFaint, fontSize: fontSize.xs },
    metaValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    chartRow: { marginTop: spacing.md, alignItems: 'flex-start' },
    chartCaption: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    inputCard: { marginTop: spacing.md },
    note: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: spacing.sm },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    input: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: fontSize.md,
      backgroundColor: colors.surfaceAlt,
    },
    investBtn: { flexShrink: 0 },
    walletLine: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm },
    withdrawBtn: { marginTop: spacing.md },
    riskCard: { marginTop: spacing.md, borderColor: colors.warning + '55', borderWidth: 1 },
    riskText: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
    legacyCard: { marginTop: spacing.md, borderColor: colors.accent + '55', borderWidth: 1 },
    legacyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    legacyRankPill: {
      backgroundColor: colors.accent + '22',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.accent + '55',
    },
    legacyRankText: { color: colors.accent, fontSize: 10, fontWeight: fontWeight.bold },
    legacyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    legacyIcon: { fontSize: 24, width: 32, textAlign: 'center' },
    legacyLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    legacyDesc: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1, lineHeight: 15 },
    legacyPts: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
  });
