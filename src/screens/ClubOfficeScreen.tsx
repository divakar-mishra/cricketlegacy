import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, ProgressBar, Screen, ScreenHeader, AppText as Text } from '../components';
import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import { Facilities, StaffRole } from '../domain/types';
import { computeValue, formatClubCurrency } from '../game/finance';
import { injuredIn, injuryLabel } from '../game/injuries';
import {
  calculateClubRating,
  expiringContracts,
  facilityMaintenance,
  facilityUpgradeCost,
  MAX_FACILITY,
  MAX_STAFF_QUALITY,
  STAFF_ROLES,
  staffInvestCost,
  staffWageBill,
  superstarAttractionChance,
} from '../game/manager';
import {
  MANAGER_ELITE_STAFF_SEARCH_GEMS,
  MANAGER_MATCH_ANALYSIS_COINS,
  managerResourceUsed,
} from '../game/managerResources';
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

const OFFICE_FACILITIES = ['training', 'medical'] as const satisfies readonly (keyof Facilities)[];

const FACILITY_LABEL: Record<(typeof OFFICE_FACILITIES)[number], string> = {
  training: 'Training Ground',
  medical: 'Medical Centre',
};

export function ClubOfficeScreen({ navigation }: ScreenProps<'ClubOffice'>) {
  const save = useCareer((s) => s.save);
  const investStaff = useCareer((s) => s.investStaff);
  const upgradeFacilityLevel = useCareer((s) => s.upgradeFacilityLevel);
  const renewDeal = useCareer((s) => s.renewDeal);
  const releasePlayer = useCareer((s) => s.releasePlayer);
  const refreshEnergy = useCareer((s) => s.refreshEnergy);
  const purchaseProduct = useCareer((s) => s.purchaseProduct);
  const runManagerResource = useCareer((s) => s.useManagerResource);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [, force] = useState(0);

  useFocusEffect(useCallback(() => refreshEnergy(), [refreshEnergy]));

  if (!save || !save.userTeamId || save.mode !== 'manager') {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Club Office" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>Available in Manager mode.</Text>
      </Screen>
    );
  }

  const team = save.teams[save.userTeamId];
  const staff = save.staff ?? [];
  const facilities = save.facilities ?? { training: 1, medical: 1, academy: 1 };
  const expiring = expiringContracts(save);
  const injured = injuredIn(save, team.playerIds);
  const staffWages = staffWageBill(save);
  const upkeep = facilityMaintenance(save);
  const clubRating = calculateClubRating(save);
  const eliteAppeal = Math.round(superstarAttractionChance(save) * 100);
  const selectedOffice = save.seasonPassExperience?.selectedOfficeTheme ?? 'office_classic';
  const managerLegendOffice = Boolean(save.inventory?.manager_legend_office_theme);
  const monthlyOffice = MONTHLY_PASS_CONTENT.find(
    (content) => content.office.themeId === selectedOffice,
  );
  const officeLabel = managerLegendOffice
    ? 'Legend Boardroom'
    : selectedOffice === 'office_noir'
      ? 'Executive Office'
      : monthlyOffice?.office.label;
  const officeAccent = managerLegendOffice
    ? '#F5CF65'
    : (monthlyOffice?.office.accent ?? '#D5B56D');
  const analysisUsed = managerResourceUsed(save, 'MATCH_ANALYSIS');
  const staffSearchUsed = managerResourceUsed(save, 'ELITE_STAFF_SEARCH');
  const facilityUpgradeTokens = Math.max(0, save.inventory?.facility_upgrade_token ?? 0);

  const doInvest = (role: StaffRole) => {
    const res = investStaff(role);
    if (!res.ok) Alert.alert('Cannot invest', res.reason ?? 'Unavailable.');
    force((n) => n + 1);
  };
  const doUpgrade = (kind: keyof Facilities) => {
    const res = upgradeFacilityLevel(kind);
    if (!res.ok) {
      if (res.reason?.toLowerCase().includes('budget')) {
        Alert.alert(
          'Not enough budget',
          'Add emergency club funds and retry this facility upgrade.',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Emergency Funds',
              onPress: () =>
                void purchaseProduct('transfer_budget_sm').then((r) => {
                  Alert.alert(
                    r.ok ? 'Applied' : 'Purchase failed',
                    r.ok
                      ? `+${fmtMoney(500_000)} added to your transfer budget.`
                      : (r.error ?? 'Please try again.'),
                  );
                }),
            },
          ],
        );
      } else {
        Alert.alert('Cannot upgrade', res.reason ?? 'Unavailable.');
      }
    }
    force((n) => n + 1);
  };
  const doRenew = (id: string, name: string) => {
    const res = renewDeal(id, 2);
    Alert.alert(
      res.ok ? 'Contract renewed' : 'Cannot renew',
      res.ok
        ? `${name} signed for 2 more years. Fee: ${fmtMoney(res.cost)}.`
        : (res.reason ?? 'Unavailable.'),
    );
    force((n) => n + 1);
  };
  const doRelease = (id: string, name: string) => {
    Alert.alert('Release player', `Release ${name} from the squad now?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Release',
        style: 'destructive',
        onPress: () => {
          const res = releasePlayer(id);
          Alert.alert(
            res.ok ? 'Player released' : 'Cannot release',
            res.ok
              ? `${name} moved to the free-agent market. Recouped ${fmtMoney(res.recouped)}.`
              : (res.reason ?? 'Unavailable.'),
          );
          force((n) => n + 1);
        },
      },
    ]);
  };
  const doWait = (name: string) => {
    Alert.alert(
      'Decision deferred',
      `${name} remains on the current contract. You can renew or release before the season contract tick.`,
    );
  };
  const runResourceAction = (action: 'MATCH_ANALYSIS' | 'ELITE_STAFF_SEARCH') => {
    const result = runManagerResource(action);
    Alert.alert(
      result.ok ? 'Club service confirmed' : 'Unavailable',
      result.detail ?? result.reason,
    );
    force((value) => value + 1);
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader title="Club Office" subtitle={team.name} onBack={() => navigation.goBack()} />

      {officeLabel && (
        <ImageBackground
          source={require('../../assets/generated/season-pass-manager-office.png')}
          resizeMode="cover"
          imageStyle={styles.officeHeroImage}
          style={styles.officeHero}
        >
          <View style={[styles.officeHeroShade, { backgroundColor: `${officeAccent}55` }]} />
          <View style={styles.officeHeroCopy}>
            <Text style={[styles.officeHeroLabel, { color: officeAccent }]}>
              {officeLabel.toUpperCase()}
            </Text>
            <Text style={styles.officeHeroTitle}>{team.name}</Text>
            <Text style={styles.officeHeroText}>
              Club rating {clubRating.toFixed(1)} · Elite-player interest {eliteAppeal}%
            </Text>
          </View>
        </ImageBackground>
      )}

      <Card style={styles.finance}>
        <View style={styles.financeRow}>
          <View style={styles.financeCol}>
            <Text style={styles.finLabel}>Club balance</Text>
            <Text style={styles.finValue}>{fmtMoney(team.budget)}</Text>
          </View>
          <View style={styles.financeCol}>
            <Text style={styles.finLabel}>Board confidence</Text>
            <Text
              style={[
                styles.finValue,
                { color: confidenceColor(save.boardConfidence ?? 60, colors) },
              ]}
            >
              {save.boardConfidence ?? 60}%
            </Text>
          </View>
        </View>
        <Text style={styles.finNote}>
          Staff wages {fmtMoney(staffWages)}/season · Facility upkeep {fmtMoney(upkeep)}/season
        </Text>
        <Text style={styles.finNote}>
          Club budget pays transfers, staff, facilities and wages. Wallet coins and gems fund the
          optional Manager services below.
        </Text>
        {save.finances?.lastGateReceipts ? (
          <Text style={styles.finNote}>
            Last season gate receipts {fmtMoney(save.finances.lastGateReceipts)}
          </Text>
        ) : null}
        {/* Wage Ledger */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            label="💰 Wage Ledger"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => navigation.navigate('WageBreakdown')}
          />
          {team.budget < 500_000 ? (
            <Button
              label="Emergency Funds"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() =>
                void purchaseProduct('transfer_budget_sm').then((r) => {
                  Alert.alert(
                    r.ok ? 'Applied' : 'Purchase failed',
                    r.ok
                      ? `+${fmtMoney(500_000)} added to your transfer budget.`
                      : (r.error ?? 'Please try again.'),
                  );
                })
              }
            />
          ) : null}
        </View>
      </Card>

      <Text style={styles.section}>Manager Resource Desk</Text>
      <View style={styles.resourceBand}>
        <View style={styles.resourceWallet}>
          <View>
            <Text style={styles.finLabel}>Wallet coins</Text>
            <Text style={styles.resourceBalance}>{save.wallet.coins.toLocaleString()}</Text>
          </View>
          <View>
            <Text style={styles.finLabel}>Gems</Text>
            <Text style={styles.resourceBalance}>{save.wallet.gems.toLocaleString()}</Text>
          </View>
        </View>
        <View style={styles.resourceRow}>
          <View style={styles.resourceCopy}>
            <Text style={styles.staffName}>Opposition Analysis</Text>
            <Text style={styles.finNote}>
              Once per fixture. The selected XI receives +2 form and +1 morale; no result is
              guaranteed.
            </Text>
          </View>
          <Button
            label={analysisUsed ? 'Prepared' : `${MANAGER_MATCH_ANALYSIS_COINS} coins`}
            size="sm"
            variant={analysisUsed ? 'ghost' : 'secondary'}
            fullWidth={false}
            disabled={analysisUsed || save.wallet.coins < MANAGER_MATCH_ANALYSIS_COINS}
            onPress={() => runResourceAction('MATCH_ANALYSIS')}
          />
        </View>
        <View style={[styles.resourceRow, styles.divider]}>
          <View style={styles.resourceCopy}>
            <Text style={styles.staffName}>Elite Staff Search</Text>
            <Text style={styles.finNote}>
              Once per season. Adds three stronger candidates; hiring still costs club budget and
              wages.
            </Text>
          </View>
          <Button
            label={staffSearchUsed ? 'Completed' : `${MANAGER_ELITE_STAFF_SEARCH_GEMS} gems`}
            size="sm"
            variant={staffSearchUsed ? 'ghost' : 'secondary'}
            fullWidth={false}
            disabled={staffSearchUsed || save.wallet.gems < MANAGER_ELITE_STAFF_SEARCH_GEMS}
            onPress={() => runResourceAction('ELITE_STAFF_SEARCH')}
          />
        </View>
        <Text style={styles.resourceAudit}>
          Wallet coins come from completed matches, daily rewards and quests. They pay only for
          manager services here; transfers, contracts, staff hiring and facilities always use the
          club budget above.{'\n'}
          Spent here: {(save.managerResources?.totalCoinsSpent ?? 0).toLocaleString()} coins and{' '}
          {(save.managerResources?.totalGemsSpent ?? 0).toLocaleString()} gems.
        </Text>
      </View>

      <Text style={styles.section}>Coaching Staff</Text>
      <View style={styles.staffSummary}>
        <View>
          <Text style={styles.finLabel}>Club rating</Text>
          <Text style={styles.staffSummaryValue}>{clubRating.toFixed(1)}</Text>
        </View>
        <View>
          <Text style={styles.finLabel}>Elite-player appeal</Text>
          <Text style={styles.staffSummaryValue}>{eliteAppeal}%</Text>
        </View>
        <Button
          label="Recruit Staff"
          variant="secondary"
          size="sm"
          style={styles.staffRecruitButton}
          onPress={() => navigation.navigate('StaffRecruitment')}
        />
      </View>
      <Card>
        {staff.map((s, i) => {
          const label = STAFF_ROLES.find((r) => r.role === s.role)?.label ?? s.role;
          const cost = staffInvestCost(s.quality);
          const maxed = s.quality >= MAX_STAFF_QUALITY;
          const afford = team.budget >= cost;
          return (
            <View key={s.id} style={[styles.staffRow, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffRole}>{label}</Text>
                <Text style={styles.staffName} numberOfLines={1}>
                  {s.name}
                </Text>
                <ProgressBar
                  value={s.quality / 100}
                  color={colors.primaryLight}
                  style={{ marginTop: 4 }}
                />
              </View>
              <View style={styles.staffAction}>
                <Text style={styles.staffQual}>{s.quality}</Text>
                <Button
                  label={maxed ? 'Elite' : fmtMoney(cost)}
                  size="sm"
                  variant={maxed ? 'ghost' : afford ? 'secondary' : 'ghost'}
                  fullWidth={false}
                  disabled={maxed}
                  onPress={() => doInvest(s.role)}
                />
              </View>
            </View>
          );
        })}
      </Card>

      <Text style={styles.section}>Facilities</Text>
      <Card>
        {OFFICE_FACILITIES.map((kind, i) => {
          const level = facilities[kind];
          const maxed = level >= MAX_FACILITY;
          const cost = facilityUpgradeCost(level + 1);
          const afford = team.budget >= cost;
          // ROI descriptions per facility kind and level
          const roiDesc = getFacilityROI(kind, level + 1);
          return (
            <View key={kind} style={[styles.staffRow, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffRole}>
                  {FACILITY_LABEL[kind]} · Level {level}/{MAX_FACILITY}
                </Text>
                <View style={styles.pips}>
                  {Array.from({ length: MAX_FACILITY }).map((_, k) => (
                    <View key={k} style={[styles.pip, k < level && styles.pipOn]} />
                  ))}
                </View>
                {!maxed && roiDesc && <Text style={styles.roiHint}>↑ {roiDesc}</Text>}
                {maxed && <Text style={styles.roiHint}>✓ Fully upgraded</Text>}
              </View>
              <Button
                label={maxed ? 'Max' : facilityUpgradeTokens > 0 ? 'Use token' : fmtMoney(cost)}
                size="sm"
                variant={
                  maxed
                    ? 'ghost'
                    : facilityUpgradeTokens > 0
                      ? 'gold'
                      : afford
                        ? 'secondary'
                        : 'ghost'
                }
                fullWidth={false}
                disabled={maxed}
                onPress={() => doUpgrade(kind)}
              />
            </View>
          );
        })}
      </Card>

      {expiring.length ? (
        <>
          <Text style={styles.section}>Contracts expiring</Text>
          <Card>
            {expiring.map((p, i) => {
              const fee = Math.round(computeValue(p) * 0.1);
              const recoup = Math.round(computeValue(p) * 0.5);
              return (
                <View key={p.id} style={[styles.staffRow, i > 0 && styles.divider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.staffName} numberOfLines={1}>
                      {p.name} <Text style={styles.staffRole}>· OVR {p.overall}</Text>
                    </Text>
                    <Text style={styles.expNote}>
                      {(p.contract?.yearsLeft ?? 0) <= 0 ? 'Out of contract' : 'Final year'} · wage{' '}
                      {fmtMoney(p.contract?.wage ?? 0)}
                    </Text>
                    <Text style={styles.expNote}>
                      Renewal offer: 2 years - fee {fmtMoney(fee)} - release recoup{' '}
                      {fmtMoney(recoup)}
                    </Text>
                  </View>
                  <View style={styles.contractActions}>
                    <Button
                      label="Renew 2yr"
                      size="sm"
                      variant="secondary"
                      fullWidth={false}
                      onPress={() => doRenew(p.id, p.name)}
                    />
                    <Button
                      label="Release"
                      size="sm"
                      variant="ghost"
                      fullWidth={false}
                      onPress={() => doRelease(p.id, p.name)}
                    />
                    <Button
                      label="Wait"
                      size="sm"
                      variant="ghost"
                      fullWidth={false}
                      onPress={() => doWait(p.name)}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {injured.length ? (
        <>
          <Text style={styles.section}>Treatment room</Text>
          <Card>
            {injured.map((p) => (
              <View key={p.id} style={styles.injRow}>
                <Text style={styles.staffName} numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.injLabel}>{p.injury ? injuryLabel(p.injury) : ''}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

    </Screen>
  );
}

const FACILITY_ROI: Record<(typeof OFFICE_FACILITIES)[number], string[]> = {
  training: [
    '+8% attribute growth per session',
    '+12% attribute growth · coaches more effective',
    '+18% growth · recovery 10% faster',
    '+25% growth · youth development unlocked',
    'MAX: elite training programme and faster youth development',
  ],
  medical: [
    'Injuries heal 15% faster',
    '+20% recovery speed · niggles auto-clear',
    '+30% recovery · fitness preserved mid-season',
    '+40% recovery · major injuries cut by half',
    'MAX: near-instant recovery, fitness stays peak',
  ],
};

function getFacilityROI(kind: keyof typeof FACILITY_ROI, nextLevel: number): string | undefined {
  return FACILITY_ROI[kind]?.[nextLevel - 2];
}

function confidenceColor(v: number, colors: ThemeColors): string {
  return v >= 60 ? colors.success : v >= 40 ? colors.warning : colors.danger;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    officeHero: {
      minHeight: 190,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radius.xl,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    officeHeroImage: { borderRadius: radius.xl },
    officeHeroShade: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(5,8,6,0.48)',
    },
    officeHeroCopy: { padding: spacing.lg, paddingTop: 72 },
    officeHeroLabel: {
      color: '#D5B56D',
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1.1,
    },
    officeHeroTitle: {
      color: '#F5F7F4',
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      marginTop: 3,
    },
    officeHeroText: { color: '#D9E0DA', fontSize: fontSize.xs, marginTop: 3 },
    msg: { color: colors.textMuted, fontSize: fontSize.md },
    finance: { marginTop: spacing.md },
    financeRow: { flexDirection: 'row', gap: spacing.lg },
    financeCol: { flex: 1 },
    finLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    finValue: {
      color: colors.accent,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    finNote: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    staffRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    staffSummary: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.sm,
    },
    staffRecruitButton: { flexBasis: '100%', minWidth: 0 },
    staffSummaryValue: {
      color: colors.accent,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
    },
    resourceBand: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
    },
    resourceWallet: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    resourceBalance: {
      color: colors.accent,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    resourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    resourceCopy: { flex: 1 },
    resourceAudit: { color: colors.textFaint, fontSize: fontSize.xs, paddingVertical: spacing.sm },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    staffRole: { color: colors.textMuted, fontSize: fontSize.xs },
    staffName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    staffAction: { alignItems: 'center', gap: 4, width: 92 },
    contractActions: { alignItems: 'flex-end', gap: spacing.xs, minWidth: 96 },
    staffQual: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.black },
    pips: { flexDirection: 'row', gap: 4, marginTop: 6 },
    pip: { width: 22, height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted },
    pipOn: { backgroundColor: colors.primary },
    expNote: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
    roiHint: { color: colors.success, fontSize: fontSize.xs, marginTop: 3, fontStyle: 'italic' },
    injRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    injLabel: { color: colors.danger, fontSize: fontSize.xs },
    // IAP banner
    iapBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderRadius: radius.md,
      padding: spacing.md,
      marginTop: spacing.md,
      backgroundColor: colors.surfaceAlt,
      gap: spacing.sm,
    },
    iapBannerTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.heavy, marginBottom: 2 },
    iapBannerDesc: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 15 },
  });
