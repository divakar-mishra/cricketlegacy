import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { setMusicEnabled } from '../audio';
import { showAdPrivacyChoices } from '../services/ads';
import { FranchiseOfferModal } from '../components/FranchiseOfferModal';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import {
  AppText as Text,
  Button,
  Card,
  Icon,
  Screen,
  ScreenHeader,
  SelectableCard,
} from '../components';
import { BUILD_INFO } from '../config/buildInfo';
import { QA_TOOLS_ENABLED, QA_WHALE_CLUB_BUDGET, QA_WHALE_COINS } from '../config/qa';
import {
  PUBLIC_RESOURCE_LABELS,
  PUBLIC_RESOURCE_READINESS,
  PUBLIC_RESOURCES,
  PublicResourceKey,
} from '../config/legal';
import { LANGUAGE_OPTIONS, useT } from '../i18n';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import { GraphicsQuality, ThemeMode, useSettings } from '../state/settingsStore';
import { fontSize, fontWeight, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';

const GRAPHICS_OPTIONS: { id: GraphicsQuality; label: string; description: string }[] = [
  { id: 'low', label: 'Low', description: 'Best battery & performance on older devices.' },
  { id: 'medium', label: 'Medium', description: 'Balanced visuals and performance.' },
  { id: 'high', label: 'High', description: 'Full effects and richest presentation.' },
];

export function SettingsScreen({ navigation }: ScreenProps<'Settings'>) {
  const s = useSettings();
  const t = useT();
  const styles = useThemedStyles(makeStyles);
  const activeSave = useCareer((state) => state.save);
  const qaGrantWhaleCoins = useCareer((state) => state.qaGrantWhaleCoins);
  const qaGrantClubBudget = useCareer((state) => state.qaGrantClubBudget);
  const qaRefillEnergy = useCareer((state) => state.qaRefillEnergy);
  const [qaAuctionPreviewOpen, setQaAuctionPreviewOpen] = useState(false);

  const qaAuctionOffers =
    activeSave?.mode === 'career' && activeSave.userPlayerId
      ? Object.values(activeSave.teams)
          .filter(
            (team) =>
              !team.isNationalTeam &&
              team.id !== (activeSave.franchiseTeamId ?? activeSave.userTeamId),
          )
          .sort((left, right) => right.reputation - left.reputation)
          .slice(0, 2)
          .map((team, index) => ({
            teamId: team.id,
            fee: index === 0 ? 2_400_000 : 1_850_000,
            signingBonus: index === 0 ? 120_000 : 90_000,
            wagePromise: index === 0 ? 425_000 : 360_000,
          }))
      : [];

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: 'dark', label: t('settings.themeDark') },
    { id: 'light', label: t('settings.themeLight') },
    { id: 'system', label: t('settings.themeSystem') },
  ];

  const nonReleaseBuild = typeof __DEV__ !== 'undefined' && __DEV__;
  const publicResourceRows = (Object.keys(PUBLIC_RESOURCE_LABELS) as PublicResourceKey[]).filter(
    (key) => PUBLIC_RESOURCES[key] || nonReleaseBuild,
  );

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />

      <Text style={styles.section}>Audio</Text>
      <Card style={styles.group}>
        <ToggleRow label={t('settings.sound')} value={s.sound} onChange={s.setSound} />
        <Divider />
        <ToggleRow
          label={t('settings.music')}
          value={s.music}
          onChange={(v) => {
            s.setMusic(v);
            setMusicEnabled(v);
          }}
        />
      </Card>

      <Text style={styles.section}>Gameplay</Text>
      <Card style={styles.group}>
        <ToggleRow label={t('settings.haptics')} value={s.haptics} onChange={s.setHaptics} />
        <Divider />
        <ToggleRow
          label={t('settings.notifications')}
          value={s.notifications}
          onChange={s.setNotifications}
        />
      </Card>

      {QA_TOOLS_ENABLED ? (
        <>
          <Text style={styles.section}>QA Tools</Text>
          <Card style={styles.group}>
            <ToggleRow
              label="Unlimited energy"
              value={s.qaUnlimitedEnergy}
              onChange={(enabled) => {
                s.setQaUnlimitedEnergy(enabled);
                if (enabled) qaRefillEnergy();
              }}
            />
            <Divider />
            <View style={styles.qaCoinsRow}>
              <View style={styles.qaCoinsCopy}>
                <Text style={styles.rowLabel}>Whale Simulator</Text>
                <Text style={styles.qaBalance}>
                  {activeSave
                    ? `${activeSave.mode === 'manager' ? 'Manager' : 'Player'} · ${activeSave.wallet.coins.toLocaleString()} coins`
                    : 'Open a save first'}
                </Text>
              </View>
              <Button
                label="+10M coins"
                size="sm"
                fullWidth={false}
                disabled={!activeSave}
                style={styles.qaCoinsButton}
                onPress={async () => {
                  const result = await qaGrantWhaleCoins();
                  if (!result.ok) {
                    Alert.alert('QA tools', result.reason ?? 'Coins could not be added.');
                    return;
                  }
                  Alert.alert(
                    'All save balances ready',
                    `${QA_WHALE_COINS.toLocaleString()} coins added to ${result.savesUpdated ?? 0} saves (${result.playerSavesUpdated ?? 0} Player, ${result.managerSavesUpdated ?? 0} Manager). Active balance: ${(result.balance ?? 0).toLocaleString()}.`,
                  );
                }}
              />
            </View>
            <Divider />
            <View style={styles.qaCoinsRow}>
              <View style={styles.qaCoinsCopy}>
                <Text style={styles.rowLabel}>Club Budget Simulator</Text>
                <Text style={styles.qaBalance}>
                  {activeSave?.mode === 'manager' && activeSave.userTeamId
                    ? `$${activeSave.teams[activeSave.userTeamId]?.budget.toLocaleString() ?? '0'}`
                    : 'Open a Manager Career first'}
                </Text>
              </View>
              <Button
                label="+1B budget"
                size="sm"
                fullWidth={false}
                disabled={
                  activeSave?.mode !== 'manager' || activeSave.managerCareerLevel === 'NATIONAL'
                }
                style={styles.qaCoinsButton}
                onPress={async () => {
                  const result = await qaGrantClubBudget();
                  if (!result.ok) {
                    Alert.alert('QA tools', result.reason ?? 'Club budget could not be added.');
                    return;
                  }
                  Alert.alert(
                    'Club budget ready',
                    `$${QA_WHALE_CLUB_BUDGET.toLocaleString()} added. Balance: $${(result.balance ?? 0).toLocaleString()}.`,
                  );
                }}
              />
            </View>
            <Divider />
            <View style={styles.qaCoinsRow}>
              <View style={styles.qaCoinsCopy}>
                <Text style={styles.rowLabel}>Auction Presentation</Text>
                <Text style={styles.qaBalance}>Real UI · preview only · no contract changes</Text>
              </View>
              <Button
                label="Preview auction"
                size="sm"
                fullWidth={false}
                disabled={activeSave?.mode !== 'career' || qaAuctionOffers.length === 0}
                style={styles.qaCoinsButton}
                onPress={() => setQaAuctionPreviewOpen(true)}
              />
            </View>
          </Card>
        </>
      ) : null}

      {QA_TOOLS_ENABLED && activeSave?.mode === 'career' ? (
        <FranchiseOfferModal
          save={activeSave}
          offers={qaAuctionPreviewOpen ? qaAuctionOffers : []}
          onAccept={() => setQaAuctionPreviewOpen(false)}
          onStay={() => setQaAuctionPreviewOpen(false)}
        />
      ) : null}

      <Text style={styles.section}>{t('settings.theme')}</Text>
      <View style={styles.optionList}>
        {themeOptions.map((opt) => (
          <SelectableCard
            key={opt.id}
            title={opt.label}
            selected={s.themeMode === opt.id}
            onPress={() => s.setThemeMode(opt.id)}
          />
        ))}
      </View>

      <Text style={styles.section}>{t('settings.language')}</Text>
      <View style={styles.optionList}>
        {LANGUAGE_OPTIONS.map((opt) => (
          <SelectableCard
            key={opt.value}
            title={opt.label}
            selected={s.language === opt.value}
            onPress={() => s.setLanguage(opt.value)}
          />
        ))}
      </View>

      <Text style={styles.section}>{t('settings.graphics')}</Text>
      <View style={styles.optionList}>
        {GRAPHICS_OPTIONS.map((opt) => (
          <SelectableCard
            key={opt.id}
            title={opt.label}
            subtitle={opt.description}
            selected={s.graphics === opt.id}
            onPress={() => s.setGraphics(opt.id)}
          />
        ))}
      </View>

      <Text style={styles.section}>Guidance</Text>
      <Card
        onPress={() => navigation.navigate('CricketAcademy')}
        accessibilityLabel="Open Cricket Academy handbook"
      >
        <View style={styles.academyRow}>
          <View style={styles.academyIcon}>
            <Icon name="school-outline" size={22} />
          </View>
          <View style={styles.academyCopy}>
            <Text style={styles.academyTitle}>Cricket Academy</Text>
          </View>
          <Icon name="chevron-forward" size={20} />
        </View>
      </Card>
      <Button
        label="Replay game guides"
        variant="secondary"
        style={{ marginTop: spacing.xl }}
        onPress={s.replayGuides}
      />
      <Button
        label="Reset to Defaults"
        variant="ghost"
        style={{ marginTop: spacing.sm }}
        onPress={s.reset}
      />

      {publicResourceRows.length > 0 ? (
        <>
          <Text style={styles.section}>Legal & Support</Text>
          <Card style={styles.group}>
            {publicResourceRows.map((key, index) => (
              <View key={key}>
                {index > 0 ? <Divider /> : null}
                <PublicResourceRow resourceKey={key} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Button
        label="Ad privacy choices"
        variant="secondary"
        onPress={() => {
          void showAdPrivacyChoices().then((result) => {
            if (result !== 'shown')
              Alert.alert(
                'Ad privacy choices',
                result === 'not_required'
                  ? 'Google does not currently require an ad privacy options form for this device.'
                  : 'Ad privacy options are unavailable right now. Ads remain disabled until an eligible consent check succeeds.',
              );
          });
        }}
      />

      <Text style={styles.section}>Build Information</Text>
      <Card style={styles.group}>
        <InfoRow label="Version" value={BUILD_INFO.appVersion} />
        <Divider />
        <InfoRow
          label="Build"
          value={
            BUILD_INFO.platform === 'android'
              ? BUILD_INFO.androidVersionCode
              : BUILD_INFO.iosBuildNumber
          }
        />
      </Card>
    </Screen>
  );
}

function PublicResourceRow({ resourceKey }: { resourceKey: PublicResourceKey }) {
  const styles = useThemedStyles(makeStyles);
  const url = PUBLIC_RESOURCES[resourceKey];
  const invalid = PUBLIC_RESOURCE_READINESS.invalid.includes(resourceKey);
  const label = PUBLIC_RESOURCE_LABELS[resourceKey];

  const onOpen = async () => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(`Cannot open ${label}`, 'Check your connection and try again.');
    }
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !url }}
      disabled={!url}
      onPress={() => void onOpen()}
      style={({ pressed }) => [styles.publicResourceRow, pressed && styles.rowPressed]}
    >
      <Text style={[styles.publicResourceLabel, !url && styles.unavailableLabel]}>{label}</Text>
      {!url ? (
        <Text style={styles.resourceStatus}>
          {invalid ? 'Invalid release URL' : 'Not configured'}
        </Text>
      ) : null}
      <Icon name={url ? 'open-outline' : 'alert-circle-outline'} size={18} />
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceMuted, true: colors.primaryDark }}
        thumbColor={value ? colors.primaryLight : colors.textFaint}
      />
    </View>
  );
}

function Divider() {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.divider} />;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
    },
    group: { paddingVertical: spacing.xs },
    optionList: { gap: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    rowLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.medium },
    qaCoinsRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    qaCoinsCopy: { flex: 1, minWidth: 0 },
    qaBalance: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 3 },
    qaCoinsButton: { width: 124 },
    publicResourceRow: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    publicResourceLabel: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.medium,
      flex: 1,
    },
    unavailableLabel: { color: colors.textMuted },
    resourceStatus: { color: colors.textFaint, fontSize: fontSize.xs },
    rowPressed: { opacity: 0.72 },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
      width: 104,
    },
    infoValue: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      flex: 1,
      textAlign: 'right',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    academyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 48,
    },
    academyIcon: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      flexShrink: 0,
    },
    academyCopy: { flex: 1, minWidth: 0 },
    academyTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
    },
    academySubtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
      marginTop: 2,
    },
  });
