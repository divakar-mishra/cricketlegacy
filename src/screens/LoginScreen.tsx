import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, Emblem, Screen, ScreenHeader, AppText as Text } from '../components';
import { ScreenProps } from '../navigation';
import { auth, connectivity, sessionGate, useAuth } from '../services';
import { useCareer } from '../state/careerStore';
import { deleteSave, listAllSaves } from '../storage/saveGames';
import { fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';

export function LoginScreen({ navigation, route }: ScreenProps<'Login'>) {
  const user = useAuth((s) => s.user);
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const isDailyGate = route.params?.gate === 'daily';

  const soon = (provider: string) =>
    Alert.alert(
      'Coming soon',
      `${provider} sign-in will be enabled once the online backend is connected. You can play as a guest now.`,
    );

  const onGuest = async () => {
    setBusy(true);
    try {
      const status = await sessionGate.dailySessionStatus();
      if (!status.online && !status.validToday) {
        setBusy(false);
        Alert.alert(
          'Online verification required',
          'Open the app while online once every 24 hours. After verification, normal career play works offline until the window expires.',
        );
        return;
      }
      await auth.signInGuest();
      if (await connectivity.isOnline()) await sessionGate.recordDailyLogin();
      setBusy(false);
      if (isDailyGate) navigation.replace('MainMenu');
      setFlash('Signed in as guest - progress is saved on this device.');
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Verification failed',
        error instanceof Error
          ? error.message
          : 'The online verification service did not complete. Check your connection and Supabase setup, then try again.',
      );
    }
  };

  const onVerifyDailyGate = async () => {
    setBusy(true);
    if (!(await connectivity.isOnline())) {
      setBusy(false);
      Alert.alert(
        'Online verification required',
        'Reconnect to refresh the 24-hour play window. Normal career play can continue offline after that local verification.',
      );
      return;
    }
    try {
      await sessionGate.recordDailyLogin();
      setBusy(false);
      navigation.replace('MainMenu');
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Verification failed',
        error instanceof Error
          ? error.message
          : 'The online verification service did not complete. Check your connection and try again.',
      );
    }
  };

  const onSignOut = async () => {
    await auth.signOut();
    setFlash('Signed out. Your local saves are untouched.');
  };

  const onBackup = () => {
    Alert.alert(
      'Cloud save unavailable',
      'Cloud save is not connected in this build. Your local-only progress can be permanently removed if the app is uninstalled or app data is cleared.',
    );
  };

  const onDelete = () => {
    Alert.alert(
      'Delete account data',
      'This permanently deletes ALL local saves on this device and signs you out. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const saves = await listAllSaves();
            for (const s of saves) await deleteSave(s.mode, s.slot);
            await auth.signOut();
            useCareer.getState().clear();
            setBusy(false);
            setFlash('All account data deleted.');
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Account" onBack={() => navigation.goBack()} />

      <View style={styles.hero}>
        <Emblem size={80} />
        <Text style={styles.heroText}>
          {isDailyGate
            ? 'Open online once every 24 hours. After verification, your careers work offline until that window expires.'
            : 'Sign in to sync your careers across devices and keep your progress safe.'}
        </Text>
      </View>

      {flash ? (
        <Card style={styles.flash}>
          <Text style={styles.flashText}>{flash}</Text>
        </Card>
      ) : null}

      {user ? (
        <>
          <Card style={styles.account}>
            <Text style={styles.accountLabel}>Signed in</Text>
            <Text style={styles.accountId} numberOfLines={1}>
              {user.provider === 'guest' ? 'Guest profile' : `${user.provider} account`}
            </Text>
            <Text style={styles.syncNote}>Local-only progress on this device.</Text>
          </Card>
          <View style={styles.buttons}>
            {isDailyGate ? (
              <Button
                label="Verify online session"
                variant="primary"
                loading={busy}
                onPress={onVerifyDailyGate}
              />
            ) : null}
            <Button label="Cloud save unavailable" variant="secondary" onPress={onBackup} />
            <Button label="Sign out" variant="secondary" onPress={onSignOut} />
            <Button label="Delete account data" variant="danger" onPress={onDelete} />
          </View>
        </>
      ) : (
        <View style={styles.buttons}>
          <Button label="Continue with Google" variant="secondary" onPress={() => soon('Google')} />
          <Button label="Play as Guest" variant="primary" loading={busy} onPress={onGuest} />
        </View>
      )}

      <Card style={styles.note}>
        <Text style={styles.noteTitle}>Local-only progress</Text>
        <Text style={styles.noteText}>
          You can play as a guest after online verification. Progress is saved only on this device
          and can be permanently removed if the app is uninstalled or app data is cleared. Cloud
          save is not available in this build.
        </Text>
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: { alignItems: 'center', marginVertical: spacing.xl, gap: spacing.lg },
    heroText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: spacing.md,
    },
    buttons: { gap: spacing.md },
    flash: { marginBottom: spacing.md, borderColor: colors.borderStrong },
    flashText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    account: { marginBottom: spacing.md },
    accountLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    accountId: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
      marginTop: 2,
    },
    syncNote: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs },
    note: { marginTop: spacing.xxl },
    noteTitle: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.xs,
    },
    noteText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  });
