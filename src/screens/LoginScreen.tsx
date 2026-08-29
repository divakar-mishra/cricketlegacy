import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Button, Card, Emblem, Screen, ScreenHeader, AppText as Text } from '../components';
import { ScreenProps } from '../navigation';
import { accountDeletion, auth, useAuth } from '../services';
import { SUBSCRIPTION_MANAGEMENT_URLS } from '../config/legal';
import { useCareer } from '../state/careerStore';
import { useHallOfFame } from '../state/hofStore';
import { useSettings } from '../state/settingsStore';
import { clearAllLocalData } from '../storage/storage';
import { fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const user = useAuth((s) => s.user);
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const soon = (provider: string) =>
    Alert.alert(
      'Coming soon',
      `${provider} sign-in will be enabled once the online backend is connected. You can play as a guest now.`,
    );

  const onGuest = async () => {
    setBusy(true);
    try {
      await auth.signInGuest();
      setBusy(false);
      setFlash('Signed in as guest - progress is saved on this device.');
    } catch (error) {
      setBusy(false);
      Alert.alert(
        'Guest profile unavailable',
        error instanceof Error
          ? error.message
          : 'The device could not save the guest profile. Check available storage and try again.',
      );
    }
  };

  const onSignOut = async () => {
    try {
      await auth.signOut();
      setFlash('Signed out. Your local saves are untouched.');
    } catch {
      Alert.alert('Sign-out incomplete', 'The device could not clear the local account marker.');
    }
  };

  const onBackup = () => {
    Alert.alert(
      'Cloud save unavailable',
      'Cloud save is not available in this build. Your local-only progress can be permanently removed if the app is uninstalled or app data is cleared.',
    );
  };

  const completeLocalDeletion = async (remoteDeleted: boolean) => {
    // Keep the Account action reachable if storage clearing fails. For a remote
    // account the server has already deleted Auth before this local phase.
    await clearAllLocalData();
    await auth.signOut();
    useCareer.getState().clear();
    useHallOfFame.getState().reset();
    useSettings.getState().reset();
    setFlash(remoteDeleted ? 'Account and app data deleted.' : 'All local app data deleted.');
  };

  const onDeleteConfirmed = async () => {
    setBusy(true);
    try {
      const hasRemoteAccount = Boolean(user?.remoteId);
      if (hasRemoteAccount) {
        const result = await accountDeletion.deleteCurrentRemoteAccount();
        if (result.status !== 'DELETED') {
          const message =
            result.status === 'NOT_CONFIGURED'
              ? 'Remote account deletion is not configured in this build.'
              : result.status === 'NO_REMOTE_SESSION'
                ? 'Your remote session has expired. Sign in again before deleting the account.'
                : result.error;
          Alert.alert(
            'Account not deleted',
            `${message} Nothing on this device was removed. Please try again or use Help & Support.`,
          );
          return;
        }
        await completeLocalDeletion(true);
        return;
      }
      await completeLocalDeletion(false);
    } catch {
      Alert.alert(
        'Deletion incomplete',
        'Deletion was not fully confirmed. Please reopen Account to check your status before trying again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openSubscriptionManagement = () => {
    const url =
      Platform.OS === 'ios'
        ? SUBSCRIPTION_MANAGEMENT_URLS.ios
        : SUBSCRIPTION_MANAGEMENT_URLS.android;
    void Linking.openURL(url).catch(() => {
      Alert.alert('Cannot open subscriptions', 'Open your store account to manage subscriptions.');
    });
  };

  const onDelete = () => {
    const hasRemoteAccount = Boolean(user?.remoteId);
    Alert.alert(
      hasRemoteAccount ? 'Delete account & data' : 'Delete local account & data',
      hasRemoteAccount
        ? 'This permanently deletes the signed-in account, cloud saves, rankings, save-bound sponsors and data on this device. This cannot be undone. It does not cancel a Google Play or App Store subscription.'
        : 'This permanently deletes saves, settings, Hall of Fame records and the local guest account on this device. Permanent per-save sponsors are deleted with their saves and cannot be transferred or recovered. This cannot be undone. It does not cancel a Google Play or App Store subscription.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Manage subscriptions', onPress: openSubscriptionManagement },
        {
          text: hasRemoteAccount ? 'Delete account' : 'Delete local data',
          style: 'destructive',
          onPress: () => void onDeleteConfirmed(),
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Account" onBack={() => navigation.goBack()} />

      <View style={styles.hero}>
        <Emblem size={80} />
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
          </Card>
          <View style={styles.buttons}>
            <Button label="Cloud save unavailable" variant="secondary" onPress={onBackup} />
            <Button label="Sign out" variant="secondary" onPress={onSignOut} />
            <Button
              label={user.remoteId ? 'Delete account & data' : 'Delete local account & data'}
              variant="danger"
              loading={busy}
              onPress={onDelete}
            />
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
          Guest saves stay on this device and may be lost if the app is removed. Cloud save is
          unavailable.
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
