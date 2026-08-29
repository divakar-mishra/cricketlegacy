import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { Sparkline } from '../components/charts/Sparkline';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  STOCK_COMPANIES,
  STOCK_RISK_LABELS,
  STOCK_SECTOR_LABELS,
  STOCK_SECTORS,
  stockCompany,
} from '../data/stockCompanies';
import { LEGACY_TIERS, legacyRank } from '../data/legacy';
import type { StockHolding, StockSector } from '../domain/types';
import { stockMarketUnlocked } from '../game/readiness';
import {
  ensureStockPortfolio,
  holdingDisplayName,
  LEGACY_MARKET_INDEX_ID,
  STOCK_MAX_INVEST,
  STOCK_MIN_INVEST,
  STOCK_RISK_RANGES,
  stockPortfolioTotals,
} from '../game/stockMarket';
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

type SectorFilter = 'ALL' | StockSector;
type TradeIntent = { kind: 'BUY'; companyId: string } | { kind: 'SELL'; companyId: string };

function signedPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function InvestmentScreen({ navigation }: ScreenProps<'InvestmentScreen'>) {
  const save = useCareer((state) => state.save);
  const investStocksAction = useCareer((state) => state.investStocksAction);
  const withdrawStocksAction = useCareer((state) => state.withdrawStocksAction);
  const contributeLegacy = useCareer((state) => state.contributeLegacy);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [sector, setSector] = useState<SectorFilter>('ALL');
  const [trade, setTrade] = useState<TradeIntent | null>(null);
  const [amount, setAmount] = useState('');

  const filteredCompanies = useMemo(
    () =>
      sector === 'ALL'
        ? STOCK_COMPANIES
        : STOCK_COMPANIES.filter((company) => company.sector === sector),
    [sector],
  );

  if (!save || save.mode !== 'career') {
    return (
      <Screen>
        <ScreenHeader title="Investment Portfolio" onBack={() => navigation.goBack()} />
        <Text style={styles.message}>Open a Player Career to use the portfolio.</Text>
      </Screen>
    );
  }

  const userAge = save.userPlayerId ? (save.players[save.userPlayerId]?.age ?? 0) : 0;
  if (!stockMarketUnlocked(save.careerPathLevel, userAge)) {
    return (
      <Screen>
        <ScreenHeader title="Investment Portfolio" onBack={() => navigation.goBack()} />
        <Text style={styles.message}>Unlocks at 18 in senior domestic cricket.</Text>
      </Screen>
    );
  }

  const portfolio = ensureStockPortfolio(save);
  const holdings = Object.values(portfolio.holdings).sort((left, right) =>
    holdingDisplayName(left).localeCompare(holdingDisplayName(right)),
  );
  const totals = stockPortfolioTotals(portfolio);
  const pnlPct = totals.costBasis > 0 ? (totals.profitLoss / totals.costBasis) * 100 : 0;
  const pnlColor = totals.profitLoss >= 0 ? colors.success : colors.danger;
  const legacyPoints = save.legacyPoints ?? 0;
  const legacyRankTitle = legacyRank(legacyPoints);

  const closeTrade = () => {
    setTrade(null);
    setAmount('');
  };
  const parsedAmount = Math.max(0, parseInt(amount.replace(/[^0-9]/g, ''), 10) || 0);
  const tradeHolding = trade?.kind === 'SELL' ? portfolio.holdings[trade.companyId] : undefined;
  const tradeCompany = trade ? stockCompany(trade.companyId) : undefined;
  const tradeName = tradeHolding
    ? holdingDisplayName(tradeHolding)
    : (tradeCompany?.name ?? 'Company');
  const buyShortfall = trade?.kind === 'BUY' ? Math.max(0, parsedAmount - save.wallet.coins) : 0;
  const sellExcess =
    trade?.kind === 'SELL' ? Math.max(0, parsedAmount - (tradeHolding?.currentValue ?? 0)) : 0;

  const buy = () => {
    if (!trade || trade.kind !== 'BUY') return;
    const result = investStocksAction(trade.companyId, parsedAmount);
    if (!result.ok) {
      Alert.alert('Investment unavailable', result.reason ?? 'Please try again.');
      return;
    }
    closeTrade();
    Alert.alert('Investment complete', `${parsedAmount.toLocaleString()} coins invested.`);
  };

  const sell = (all = false) => {
    if (!trade || trade.kind !== 'SELL') return;
    const result = withdrawStocksAction(trade.companyId, all ? undefined : parsedAmount);
    if (!result.ok) {
      Alert.alert('Sale unavailable', result.reason ?? 'Please try again.');
      return;
    }
    closeTrade();
    Alert.alert('Sale complete', `${(result.coins ?? 0).toLocaleString()} coins returned.`);
  };

  const fundLegacy = (tier: (typeof LEGACY_TIERS)[number]) => {
    Alert.alert(
      `Fund ${tier.label}?`,
      `Spend ${tier.coinCost.toLocaleString()} coins for +${tier.points} legacy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fund',
          onPress: () => {
            const result = contributeLegacy(tier.id);
            if (!result.ok) Alert.alert('Cannot fund', result.reason ?? 'Please try again.');
          },
        },
      ],
    );
  };

  return (
    <>
      <Screen scroll>
        <ScreenHeader
          title="Investment Portfolio"
          subtitle={`${holdings.length} active holding${holdings.length === 1 ? '' : 's'}`}
          onBack={() => navigation.goBack()}
        />

        <Card style={styles.summaryCard}>
          <Text style={styles.eyebrow}>MY PORTFOLIO</Text>
          <View style={styles.summaryTop}>
            <View style={styles.summaryValueWrap}>
              <Text style={styles.summaryLabel}>Current value</Text>
              <Text style={styles.summaryValue}>{totals.currentValue.toLocaleString()}</Text>
            </View>
            <View style={styles.pnlWrap}>
              <Text style={[styles.pnlValue, { color: pnlColor }]}>
                {totals.profitLoss >= 0 ? '+' : ''}
                {totals.profitLoss.toLocaleString()}
              </Text>
              <Text style={[styles.pnlPercent, { color: pnlColor }]}>{signedPercent(pnlPct)}</Text>
            </View>
          </View>
          <View style={styles.summaryMeta}>
            <Metric label="Cost basis" value={totals.costBasis} />
            <Metric label="Withdrawn" value={portfolio.totalWithdrawn} />
            <Metric label="Wallet" value={save.wallet.coins} />
          </View>
        </Card>

        <Text style={styles.sectionTitle}>Holdings</Text>
        {holdings.length ? (
          holdings.map((holding) => (
            <HoldingCard
              key={holding.companyId}
              holding={holding}
              onSell={() => setTrade({ kind: 'SELL', companyId: holding.companyId })}
            />
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Choose a company below to start your portfolio.</Text>
          </Card>
        )}

        <View style={styles.marketHeader}>
          <Text style={styles.sectionTitle}>Company Market</Text>
          <Text style={styles.marketYear}>
            {portfolio.lastUpdatedYear ? `Season ${portfolio.lastUpdatedYear}` : 'Opening board'}
          </Text>
        </View>
        <View style={styles.filters}>
          <FilterChip label="All" active={sector === 'ALL'} onPress={() => setSector('ALL')} />
          {STOCK_SECTORS.map((item) => (
            <FilterChip
              key={item}
              label={STOCK_SECTOR_LABELS[item]}
              active={sector === item}
              onPress={() => setSector(item)}
            />
          ))}
        </View>

        <Card style={styles.marketCard}>
          {filteredCompanies.map((company, index) => {
            const movement = portfolio.lastReturns[company.id];
            const owns = Boolean(portfolio.holdings[company.id]);
            return (
              <View
                key={company.id}
                style={[
                  styles.companyRow,
                  index === filteredCompanies.length - 1 && styles.lastRow,
                ]}
              >
                <View style={styles.companyMark}>
                  <Text style={styles.companyMarkText}>
                    {company.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.companyCopy}>
                  <Text style={styles.companyName}>{company.name}</Text>
                  <Text style={styles.companyMeta}>
                    {STOCK_SECTOR_LABELS[company.sector]} · {STOCK_RISK_LABELS[company.risk]}
                  </Text>
                </View>
                <View style={styles.companyAction}>
                  <Text
                    style={[
                      styles.marketMove,
                      movement !== undefined && {
                        color: movement >= 0 ? colors.success : colors.danger,
                      },
                    ]}
                  >
                    {movement === undefined ? '—' : signedPercent(movement)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.investAction, owns && styles.investActionOwned]}
                    onPress={() => setTrade({ kind: 'BUY', companyId: company.id })}
                  >
                    <Text
                      style={[
                        styles.investActionText,
                        owns && styles.investActionTextOwned,
                      ]}
                    >
                      {owns ? 'Add' : 'Invest'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </Card>

        <Text style={styles.riskLine}>Company values update once at each season end.</Text>

        <Card style={styles.legacyCard}>
          <View style={styles.legacyHeader}>
            <View>
              <Text style={styles.eyebrow}>LEGACY FUND</Text>
              <Text style={styles.legacyTitle}>{legacyRankTitle}</Text>
            </View>
            <Text style={styles.legacyPoints}>{legacyPoints} pts</Text>
          </View>
          {LEGACY_TIERS.map((tier, index) => {
            const owned = (save.inventory?.[tier.id] ?? 0) > 0;
            return (
              <View
                key={tier.id}
                style={[styles.legacyRow, index === LEGACY_TIERS.length - 1 && styles.lastRow]}
              >
                <View style={styles.companyCopy}>
                  <Text style={styles.companyName}>{tier.label}</Text>
                  <Text style={styles.companyMeta}>+{tier.points} legacy</Text>
                </View>
                <Button
                  label={owned ? 'Funded' : tier.coinCost.toLocaleString()}
                  size="sm"
                  variant={owned ? 'secondary' : 'gold'}
                  fullWidth={false}
                  disabled={owned || save.wallet.coins < tier.coinCost}
                  onPress={() => fundLegacy(tier)}
                />
              </View>
            );
          })}
        </Card>
      </Screen>

      <Modal transparent visible={Boolean(trade)} animationType="fade" onRequestClose={closeTrade}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTrade} />
          <View style={styles.tradeSheet}>
            <Text style={styles.tradeKicker}>
              {trade?.kind === 'SELL' ? 'SELL HOLDING' : 'INVEST'}
            </Text>
            <Text style={styles.tradeTitle}>{tradeName}</Text>
            {tradeCompany ? (
              <>
                <Text style={styles.tradeMeta}>
                  {STOCK_SECTOR_LABELS[tradeCompany.sector]} ·{' '}
                  {STOCK_RISK_LABELS[tradeCompany.risk]}
                </Text>
                <Text style={styles.tradeRange}>
                  Season range {STOCK_RISK_RANGES[tradeCompany.risk].min}% to +
                  {STOCK_RISK_RANGES[tradeCompany.risk].max}%
                </Text>
              </>
            ) : (
              <Text style={styles.tradeMeta}>Sell-only position from the previous market</Text>
            )}
            {tradeHolding && tradeHolding.history.length >= 2 ? (
              <View style={styles.tradeChart}>
                <Sparkline
                  values={tradeHolding.history}
                  width={280}
                  height={52}
                  color={
                    tradeHolding.currentValue >= tradeHolding.costBasis
                      ? colors.success
                      : colors.danger
                  }
                />
              </View>
            ) : null}
            <TextInput
              style={styles.tradeInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder={
                trade?.kind === 'SELL'
                  ? `Up to ${(tradeHolding?.currentValue ?? 0).toLocaleString()}`
                  : `${STOCK_MIN_INVEST.toLocaleString()}–${STOCK_MAX_INVEST.toLocaleString()} coins`
              }
              placeholderTextColor={colors.textFaint}
            />
            <Text
              style={[
                styles.tradeFunds,
                (buyShortfall > 0 || sellExcess > 0) && styles.tradeFundsError,
              ]}
            >
              {trade?.kind === 'SELL'
                ? sellExcess > 0
                  ? `Exceeds holding by ${sellExcess.toLocaleString()} coins`
                  : `Holding value ${(tradeHolding?.currentValue ?? 0).toLocaleString()} coins`
                : buyShortfall > 0
                  ? `Need ${buyShortfall.toLocaleString()} more coins`
                  : `Wallet ${save.wallet.coins.toLocaleString()} coins`}
            </Text>
            {trade?.kind === 'SELL' ? (
              <View style={styles.tradeButtons}>
                <Button
                  label="Sell amount"
                  fullWidth={false}
                  style={styles.tradeButton}
                  disabled={parsedAmount < 1 || sellExcess > 0}
                  onPress={() => sell(false)}
                />
                <Button
                  label="Sell all"
                  variant="secondary"
                  fullWidth={false}
                  style={styles.tradeButton}
                  onPress={() => sell(true)}
                />
              </View>
            ) : (
              <Button
                label="Confirm investment"
                variant="gold"
                disabled={
                  parsedAmount < STOCK_MIN_INVEST ||
                  parsedAmount > STOCK_MAX_INVEST ||
                  buyShortfall > 0
                }
                onPress={buy}
              />
            )}
            <Button label="Cancel" variant="ghost" onPress={closeTrade} />
          </View>
        </View>
      </Modal>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
    </View>
  );
}

function HoldingCard({ holding, onSell }: { holding: StockHolding; onSell: () => void }) {
  const company = stockCompany(holding.companyId);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pnl = holding.currentValue - holding.costBasis;
  const pnlColor = pnl >= 0 ? colors.success : colors.danger;
  return (
    <Card style={styles.holdingCard}>
      <View style={styles.holdingTop}>
        <View style={styles.companyCopy}>
          <Text style={styles.holdingName}>{holdingDisplayName(holding)}</Text>
          <Text style={styles.companyMeta}>
            {holding.companyId === LEGACY_MARKET_INDEX_ID
              ? 'Sell only · Previous market position'
              : `${company ? STOCK_SECTOR_LABELS[company.sector] : 'Market'} · ${
                  company ? STOCK_RISK_LABELS[company.risk] : 'Retired'
                }`}
          </Text>
        </View>
        <View style={styles.holdingValueWrap}>
          <Text style={styles.holdingValue}>{holding.currentValue.toLocaleString()}</Text>
          <Text style={[styles.holdingPnl, { color: pnlColor }]}>
            {pnl >= 0 ? '+' : ''}
            {pnl.toLocaleString()}
          </Text>
        </View>
      </View>
      <View style={styles.holdingBottom}>
        <Text style={styles.costBasis}>Cost {holding.costBasis.toLocaleString()}</Text>
        <Button label="Sell" size="sm" variant="secondary" fullWidth={false} onPress={onSell} />
      </View>
    </Card>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    message: { color: colors.textMuted, fontSize: fontSize.md, margin: spacing.lg },
    summaryCard: { marginTop: spacing.md, borderColor: colors.accent, borderTopWidth: 2 },
    eyebrow: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },
    summaryTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: spacing.sm,
    },
    summaryValueWrap: { flex: 1 },
    summaryLabel: { color: colors.textMuted, fontSize: fontSize.xs },
    summaryValue: { color: colors.text, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
    pnlWrap: { alignItems: 'flex-end' },
    pnlValue: { fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    pnlPercent: { fontSize: fontSize.xs, marginTop: 2 },
    summaryMeta: {
      flexDirection: 'row',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    metric: { flex: 1, minWidth: 0 },
    metricLabel: { color: colors.textFaint, fontSize: 10 },
    metricValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginTop: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    emptyCard: { paddingVertical: spacing.lg },
    emptyText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
    holdingCard: { marginBottom: spacing.sm },
    holdingTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    holdingName: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    holdingValueWrap: { alignItems: 'flex-end' },
    holdingValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    holdingPnl: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 2 },
    holdingBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.md,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    costBasis: { color: colors.textMuted, fontSize: fontSize.xs },
    marketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    marketYear: { color: colors.textMuted, fontSize: fontSize.xs },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      paddingBottom: spacing.sm,
      maxWidth: '100%',
    },
    filterChip: {
      minHeight: 36,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '18' },
    filterText: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    filterTextActive: { color: colors.accent },
    marketCard: { paddingVertical: 0 },
    companyRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastRow: { borderBottomWidth: 0 },
    companyMark: {
      width: 38,
      height: 38,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companyMarkText: { color: colors.accent, fontSize: 10, fontWeight: fontWeight.black },
    companyCopy: { flex: 1, minWidth: 0 },
    companyName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    companyMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    companyAction: { alignItems: 'flex-end', gap: 4 },
    marketMove: { color: colors.textFaint, fontSize: 10, fontWeight: fontWeight.bold },
    investAction: {
      minWidth: 62,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: colors.accent,
    },
    investActionOwned: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    investActionText: { color: colors.bg, fontSize: fontSize.xs, fontWeight: fontWeight.heavy },
    investActionTextOwned: { color: colors.accent },
    riskLine: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    legacyCard: { marginTop: spacing.xl, marginBottom: spacing.xxl },
    legacyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    legacyTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: 2,
    },
    legacyPoints: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    legacyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: spacing.sm,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.72)',
    },
    tradeSheet: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.bgElevated,
      padding: spacing.lg,
    },
    tradeKicker: {
      color: colors.accent,
      fontSize: 10,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },
    tradeTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.heavy,
      marginTop: 4,
    },
    tradeMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    tradeRange: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    tradeChart: { marginTop: spacing.md },
    tradeInput: {
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    tradeFunds: { color: colors.textMuted, fontSize: fontSize.xs, marginVertical: spacing.sm },
    tradeFundsError: { color: colors.danger },
    tradeButtons: { flexDirection: 'row', gap: spacing.sm },
    tradeButton: { flex: 1 },
  });
