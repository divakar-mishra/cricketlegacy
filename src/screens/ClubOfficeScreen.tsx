import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  AppText as Text,
  Button,
  Card,
  Icon,
  type IconName,
  ProgressBar,
  Screen,
  ScreenHeader,
  SponsorBrandRow,
  SponsorLogo,
  SponsorMark,
} from '../components';
import { MONTHLY_PASS_CONTENT } from '../data/seasonPassContent';
import { Facilities, StaffRole } from '../domain/types';
import { computeValue, formatClubCurrency } from '../game/finance';
import { injuredIn, injuryLabel } from '../game/injuries';
import {
  calculateClubRating,
  expiringContracts,
  facilityMaintenance,
  facilityUpgradeCost,
  type FacilityUpgradePaymentMethod,
  MAX_FACILITY,
  MAX_STAFF_QUALITY,
  STAFF_ROLES,
  staffInvestCost,
  staffWageBill,
} from '../game/manager';
import { activeManagerClub } from '../game/managerClubState';
import { MANAGER_ELITE_STAFF_SEARCH_GEMS, managerResourceUsed } from '../game/managerResources';
import {
  activeEarnedSponsorContract,
  activeSponsorBranding,
  premiumSponsorWeeklyRate,
  sponsorshipOffers,
} from '../game/sponsorship';
import {
  MATCHDAY_EXPERIENCE,
  stadiumSeasonUpkeep,
  stadiumSummary,
} from '../game/stadiumManagement';
import { useIsCompact } from '../hooks/useResponsive';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import { confirmFacilityUpgrade } from './facilityUpgradePrompt';
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

const INFRASTRUCTURE_FACILITIES = [
  { kind: 'training', label: 'Training Ground', icon: 'barbell-outline' },
  { kind: 'medical', label: 'Medical Centre', icon: 'medkit-outline' },
  { kind: 'academy', label: 'Youth Academy', icon: 'school-outline' },
] as const satisfies readonly {
  kind: keyof Facilities;
  label: string;
  icon: IconName;
}[];

function currentFacilityEffect(kind: keyof Facilities): string {
  if (kind === 'training') return 'Player development';
  if (kind === 'medical') return 'Recovery and injury prevention';
  return 'Youth intake quality';
}

export function ClubOfficeScreen({ navigation }: ScreenProps<'ClubOffice'>) {
  const save = useCareer((s) => s.save);
  const investStaff = useCareer((s) => s.investStaff);
  const upgradeFacilityLevel = useCareer((s) => s.upgradeFacilityLevel);
  const acceptEarnedSponsorOffer = useCareer((s) => s.acceptEarnedSponsorOffer);
  const renewDeal = useCareer((s) => s.renewDeal);
  const releasePlayer = useCareer((s) => s.releasePlayer);
  const refreshEnergy = useCareer((s) => s.refreshEnergy);
  const purchaseProduct = useCareer((s) => s.purchaseProduct);
  const runManagerResource = useCareer((s) => s.useManagerResource);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const compactActions = useIsCompact(520);
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

  if (save.managerCareerLevel === 'NATIONAL') {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Club Office" onBack={() => navigation.goBack()} />
        <Card style={styles.nationalPauseCard}>
          <Icon name="flag-outline" size={24} color={colors.primaryLight} />
          <Text style={styles.nationalPauseTitle}>Club operations paused</Text>
        </Card>
      </Screen>
    );
  }

  const team = save.teams[save.userTeamId];
  const staff = save.staff ?? [];
  const facilities = save.facilities ?? { training: 1, medical: 1, academy: 1 };
  const expiring = expiringContracts(save);
  const injured = injuredIn(save, team.playerIds);
  const staffWages = staffWageBill(save);
  const facilityUpkeep = facilityMaintenance(save);
  const stadiumClub = activeManagerClub(save);
  const groundSummary = stadiumClub ? stadiumSummary(save) : undefined;
  const groundUpkeep = stadiumClub ? stadiumSeasonUpkeep(stadiumClub.stadium) : 0;
  const upkeep = facilityUpkeep + groundUpkeep;
  const clubRating = calculateClubRating(save);
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
  const staffSearchUsed = managerResourceUsed(save, 'ELITE_STAFF_SEARCH');
  const facilityUpgradeTokens = Math.max(0, save.inventory?.facility_upgrade_token ?? 0);
  const earnedSponsorOffers = sponsorshipOffers(save);
  const activeEarnedSponsor = activeEarnedSponsorContract(save);
  const sponsorBranding = activeSponsorBranding(save);
  const permanentSponsorRate = premiumSponsorWeeklyRate(save);

  const doInvest = (role: StaffRole) => {
    const res = investStaff(role);
    if (!res.ok) Alert.alert('Cannot invest', res.reason ?? 'Unavailable.');
    force((n) => n + 1);
  };
  const applyFacilityUpgrade = (
    kind: keyof Facilities,
    paymentMethod: FacilityUpgradePaymentMethod,
  ) => {
    const res = upgradeFacilityLevel(kind, paymentMethod);
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
  const doUpgrade = (kind: keyof Facilities, facilityLabel: string) => {
    const currentLevel = facilities[kind];
    if (currentLevel >= MAX_FACILITY) return;
    confirmFacilityUpgrade(
      {
        facilityLabel,
        currentLevel,
        cashCost: facilityUpgradeCost(currentLevel + 1),
        clubBalance: team.budget,
        tokenCount: facilityUpgradeTokens,
      },
      (paymentMethod) => applyFacilityUpgrade(kind, paymentMethod),
    );
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
    Alert.alert('Decision deferred', `${name} stays. Renew or release before season rollover.`);
  };
  const runStaffSearch = () => {
    const result = runManagerResource('ELITE_STAFF_SEARCH');
    Alert.alert(
      result.ok ? 'Club service confirmed' : 'Unavailable',
      result.detail ?? result.reason,
    );
    force((value) => value + 1);
  };

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader title="Club Office" subtitle={team.name} onBack={() => navigation.goBack()} />

      {stadiumClub && groundSummary ? (
        <>
          <Text style={styles.section}>Home Ground</Text>
          <Card
            style={styles.groundCard}
            onPress={() => navigation.navigate('ClubStadium')}
            accessibilityLabel="Manage home ground"
          >
            <View style={styles.groundHeader}>
              <View style={styles.groundIcon}>
                <Icon name="business-outline" size={22} color={colors.accentLight} />
              </View>
              <View style={styles.groundTitleCopy}>
                <Text style={styles.groundTitle} numberOfLines={1}>
                  {stadiumClub.stadium.name}
                </Text>
                <Text style={styles.groundMeta}>
                  {MATCHDAY_EXPERIENCE[stadiumClub.stadium.experienceLevel]?.label ?? 'Essentials'}
                </Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.groundStats}>
              <View style={styles.groundStat}>
                <Text style={styles.groundStatValue}>
                  {groundSummary.capacity.toLocaleString()}
                </Text>
                <Text style={styles.groundStatLabel}>Capacity</Text>
              </View>
              <View style={styles.groundStat}>
                <Text style={styles.groundStatValue}>{groundSummary.fanBase.toLocaleString()}</Text>
                <Text style={styles.groundStatLabel}>Fan base</Text>
              </View>
              <View style={styles.groundStat}>
                <Text style={[styles.groundStatValue, styles.groundRevenue]}>
                  {fmtMoney(groundSummary.currentSeasonReceipts)}
                </Text>
                <Text style={styles.groundStatLabel}>Gate receipts</Text>
              </View>
            </View>
          </Card>
        </>
      ) : null}

      <Card style={styles.finance}>
        <View style={styles.financeRow}>
          <View style={styles.financeCol}>
            <Text style={styles.finLabel}>Club balance</Text>
            <Text style={styles.finValue}>{fmtMoney(team.budget)}</Text>
          </View>
        </View>
        <Text style={styles.finNote}>
          Staff wages {fmtMoney(staffWages)}/season · Infrastructure upkeep {fmtMoney(upkeep)}
          /season
        </Text>
        {save.finances?.lastGateReceipts ? (
          <Text style={styles.finNote}>
            Last season gate receipts {fmtMoney(save.finances.lastGateReceipts)}
          </Text>
        ) : null}
        <View style={[styles.financeActions, compactActions && styles.financeActionsCompact]}>
          <Button
            label="💰 Wage Ledger"
            variant="ghost"
            size="sm"
            fullWidth={compactActions}
            style={compactActions ? undefined : styles.financeActionButton}
            onPress={() => navigation.navigate('WageBreakdown')}
          />
          {team.budget < 500_000 ? (
            <Button
              label="Emergency Funds"
              variant="secondary"
              size="sm"
              fullWidth={compactActions}
              style={compactActions ? undefined : styles.financeActionButton}
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

      <SponsorBrandRow
        earned={sponsorBranding.earned}
        premium={sponsorBranding.premium}
        compact
        style={styles.clubSponsorHeader}
      />

      {officeLabel && (
        <ImageBackground
          source={require('../../assets/generated/season-pass-manager-office.png')}
          resizeMode="cover"
          imageStyle={styles.officeHeroImage}
          style={styles.officeHero}
        >
          <View style={[styles.officeHeroShade, { backgroundColor: `${officeAccent}55` }]} />
          <View style={styles.officeHeroCopy}>
            <Text style={styles.officeHeroKicker}>OFFICE THEME</Text>
            <Text style={[styles.officeHeroTitle, { color: officeAccent }]}>{officeLabel}</Text>
          </View>
        </ImageBackground>
      )}

      <Text style={styles.section}>Kit Partnership</Text>
      <Card style={styles.sponsorCard}>
        {activeEarnedSponsor ? (
          <View style={styles.sponsorActive}>
            <SponsorMark
              name={activeEarnedSponsor.brandName ?? activeEarnedSponsor.label}
              brandId={activeEarnedSponsor.brandId}
            />
            <Text style={styles.sponsorStatus}>
              {fmtMoney(activeEarnedSponsor.appearancePayout)} per eligible fixture
              {activeEarnedSponsor.winBonus
                ? ` · +${fmtMoney(activeEarnedSponsor.winBonus)} per win`
                : ''}
            </Text>
            <Text style={styles.sponsorMeta}>
              {activeEarnedSponsor.paidFixtures}/{activeEarnedSponsor.fixtureQuota} · Club Balance
            </Text>
          </View>
        ) : earnedSponsorOffers.length ? (
          <View style={styles.sponsorOffers}>
            {earnedSponsorOffers.map((offer) => (
              <View key={offer.id} style={styles.sponsorOffer}>
                <SponsorLogo brand={offer} variant="badge" size={30} />
                <View style={styles.sponsorOfferCopy}>
                  <Text style={styles.sponsorTitle}>{offer.brandName ?? offer.label}</Text>
                  <Text style={styles.sponsorMeta}>
                    {offer.label} · {fmtMoney(offer.appearancePayout)} / fixture
                    {offer.winBonus ? ` · +${fmtMoney(offer.winBonus)} / win` : ''} ·{' '}
                    {offer.fixtureQuota} total
                  </Text>
                </View>
                <Button
                  label="Sign"
                  size="sm"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => {
                    const result = acceptEarnedSponsorOffer(offer.id);
                    Alert.alert(
                      result.ok ? 'Sponsor signed' : 'Cannot sign sponsor',
                      result.ok
                        ? `${offer.brandName ?? offer.label} partnership confirmed. Payments go to Club Balance.`
                        : (result.reason ?? 'Unavailable.'),
                    );
                  }}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sponsorMeta}>New offers arrive next season.</Text>
        )}
        {save.sponsorship?.premium ? (
          <View style={styles.sponsorPremiumSlot}>
            <SponsorMark name="Legacy Crown" brandId="legacy_crown" compact />
            <Text style={styles.sponsorTitle}>Permanent sponsor</Text>
            <Text style={styles.sponsorStatus}>
              {fmtMoney(permanentSponsorRate)} / qualifying week
            </Text>
            <Text style={styles.sponsorMeta}>Extra slot · This save only</Text>
          </View>
        ) : (
          <View style={styles.sponsorPremiumSlot}>
            <Button
              label="View permanent sponsor"
              size="sm"
              variant="secondary"
              fullWidth={false}
              onPress={() => navigation.navigate('Purchase')}
            />
          </View>
        )}
      </Card>

      <Text style={styles.section}>Infrastructure</Text>
      <View style={[styles.infrastructureGrid, compactActions && styles.infrastructureGridCompact]}>
        {INFRASTRUCTURE_FACILITIES.map(({ kind, label, icon }) => {
          const level = facilities[kind];
          const maxed = level >= MAX_FACILITY;
          const cost = facilityUpgradeCost(level + 1);
          const afford = team.budget >= cost;
          const hasPaymentChoice = !maxed && facilityUpgradeTokens > 0;
          return (
            <Card
              key={kind}
              padded={false}
              style={[
                styles.infrastructureCard,
                compactActions && styles.infrastructureCardCompact,
              ]}
            >
              <View style={styles.facilityHeader}>
                <View style={styles.facilityIcon}>
                  <Icon name={icon} size={20} color={colors.primaryLight} />
                </View>
                <View style={styles.facilityTitleCopy}>
                  <Text style={styles.facilityTitle} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={styles.facilityStatus}>
                    Level {level}/{MAX_FACILITY}
                  </Text>
                </View>
              </View>
              <View style={styles.pips}>
                {Array.from({ length: MAX_FACILITY }).map((_, index) => (
                  <View key={index} style={[styles.pip, index < level && styles.pipOn]} />
                ))}
              </View>
              <Text style={styles.facilityEffect} numberOfLines={2}>
                {currentFacilityEffect(kind)}
              </Text>
              <Button
                label={
                  maxed
                    ? 'Max level'
                    : hasPaymentChoice
                      ? 'Upgrade options'
                      : `Upgrade · ${fmtMoney(cost)}`
                }
                size="sm"
                variant={maxed ? 'ghost' : afford || hasPaymentChoice ? 'secondary' : 'ghost'}
                disabled={maxed}
                style={styles.facilityAction}
                onPress={() => doUpgrade(kind, label)}
              />
              {kind === 'training' ? (
                <Button
                  label="Set team plan"
                  size="sm"
                  variant="ghost"
                  style={styles.facilitySecondaryAction}
                  onPress={() => navigation.navigate('Training')}
                />
              ) : kind === 'medical' ? (
                <Button
                  label="Open medical centre"
                  size="sm"
                  variant="ghost"
                  style={styles.facilitySecondaryAction}
                  onPress={() => navigation.navigate('MedicalCentre')}
                />
              ) : kind === 'academy' ? (
                <Button
                  label="View prospects"
                  size="sm"
                  variant="ghost"
                  style={styles.facilitySecondaryAction}
                  onPress={() => navigation.navigate('Academy')}
                />
              ) : null}
            </Card>
          );
        })}
      </View>

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
            <Text style={styles.staffName}>Elite Staff Search</Text>
            <Text style={styles.finNote}>
              3 stronger candidates this season
            </Text>
          </View>
          <Button
            label={staffSearchUsed ? 'Completed' : `${MANAGER_ELITE_STAFF_SEARCH_GEMS} gems`}
            size="sm"
            variant={staffSearchUsed ? 'ghost' : 'secondary'}
            fullWidth={false}
            disabled={staffSearchUsed || save.wallet.gems < MANAGER_ELITE_STAFF_SEARCH_GEMS}
            onPress={runStaffSearch}
          />
        </View>
      </View>

      <Text style={styles.section}>Coaching Staff</Text>
      <View style={styles.staffSummary}>
        <View>
          <Text style={styles.finLabel}>Club rating</Text>
          <Text style={styles.staffSummaryValue}>{clubRating.toFixed(1)}</Text>
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
                      Renew 2yr: {fmtMoney(fee)} · Release: {fmtMoney(recoup)}
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    officeHero: {
      minHeight: 64,
      marginTop: spacing.sm,
      borderRadius: radius.md,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    officeHeroImage: { borderRadius: radius.md },
    officeHeroShade: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(5,8,6,0.48)',
    },
    officeHeroCopy: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    officeHeroKicker: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 9,
      fontWeight: fontWeight.black,
      letterSpacing: 1.1,
    },
    officeHeroTitle: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.black,
      marginTop: 2,
    },
    msg: { color: colors.textMuted, fontSize: fontSize.md },
    nationalPauseCard: { marginTop: spacing.md, gap: spacing.sm },
    nationalPauseTitle: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.heavy,
    },
    nationalPauseCopy: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
    finance: { marginTop: spacing.md },
    financeRow: { flexDirection: 'row', gap: spacing.lg },
    financeCol: { flex: 1 },
    financeActions: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    financeActionsCompact: { flexDirection: 'column' },
    financeActionButton: { flex: 1, minWidth: 0 },
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
    sponsorCard: { gap: spacing.sm },
    clubSponsorHeader: { marginTop: spacing.xs, marginBottom: spacing.sm },
    sponsorActive: { gap: 3 },
    sponsorTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    sponsorStatus: { color: colors.primaryLight, fontSize: fontSize.sm },
    sponsorMeta: { color: colors.textMuted, fontSize: fontSize.xs, lineHeight: 17 },
    sponsorPremiumSlot: {
      gap: 3,
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    sponsorOffers: { gap: spacing.sm },
    sponsorOffer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sponsorOfferCopy: { flex: 1, minWidth: 0 },
    infrastructureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      gap: spacing.sm,
    },
    infrastructureGridCompact: { flexDirection: 'column', flexWrap: 'nowrap' },
    infrastructureCard: {
      width: '31%',
      flexGrow: 1,
      minWidth: 190,
      padding: spacing.md,
    },
    infrastructureCardCompact: { width: '100%', minWidth: 0 },
    facilityHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    facilityIcon: {
      width: 34,
      height: 34,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    facilityTitleCopy: { flex: 1, minWidth: 0 },
    facilityTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.heavy },
    facilityStatus: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 },
    facilityEffect: {
      minHeight: 30,
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 15,
      marginTop: spacing.sm,
    },
    facilityAction: { marginTop: spacing.sm },
    facilitySecondaryAction: { marginTop: spacing.xs },
    groundCard: { backgroundColor: colors.bgElevated, borderColor: colors.borderStrong },
    groundHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    groundIcon: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    groundTitleCopy: { flex: 1, minWidth: 0 },
    groundTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    groundMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    groundStats: {
      flexDirection: 'row',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    groundStat: { flex: 1, minWidth: 0 },
    groundStatValue: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.black },
    groundRevenue: { color: colors.primaryLight },
    groundStatLabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
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
