import { StyleSheet, Switch, View } from 'react-native';
import { setMusicEnabled } from '../audio';
import { Button, Card, Screen, ScreenHeader, SelectableCard, AppText as Text } from '../components';
import { BUILD_INFO } from '../config/buildInfo';
import { LANGUAGE_OPTIONS, useT } from '../i18n';
import { ScreenProps } from '../navigation';
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

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: 'dark', label: t('settings.themeDark') },
    { id: 'light', label: t('settings.themeLight') },
    { id: 'system', label: t('settings.themeSystem') },
  ];

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
        <Divider />
        <InfoRow
          label="Commit"
          value={`${BUILD_INFO.gitCommit}${BUILD_INFO.gitDirty ? ' (dirty)' : ''}`}
        />
        <Divider />
        <InfoRow label="Built" value={formatBuiltAt(BUILD_INFO.builtAt)} />
        <Divider />
        <InfoRow label="Environment" value={BUILD_INFO.environment} />
        <Divider />
        <InfoRow label="Save schema" value={BUILD_INFO.saveSchemaVersion} />
        <Divider />
        <InfoRow label="Data config" value={BUILD_INFO.dataConfigVersion} />
        <Divider />
        <InfoRow label="Platform" value={BUILD_INFO.platform} />
      </Card>
    </Screen>
  );
}

function formatBuiltAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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
  });
