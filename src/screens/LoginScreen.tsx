import { useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
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
import { AccountBackupCard } from '../components/AccountBackupCard';
import { AppleAccountButton } from '../components/AppleAccountButton';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const user = useAuth((s) => s.user);
  const styles = useThemedStyles(makeStyles);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const [googlePending, setGooglePending] = useState(false);
  const [applePending, setApplePending] = useState(false);
  const [googleRetry, setGoogleRetry] = useState<{ existingAccount: boolean; message: string } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [emailForm, setEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const beginAction = () => {
    // State alone does not guard two callbacks delivered before the next render.
    if (actionPending.current) return false;
    actionPending.current = true;
    setBusy(true);
    setFlash(null);
    setGoogleRetry(null);
    return true;
  };
  const finishAction = () => {
    actionPending.current = false;
    setBusy(false);
  };

  const onEmail = async () => {
    if (!beginAction()) return;
    try {
      await auth.signInEmail(email, password);
      setEmail('');
      setEmailForm(false);
      setFlash('Signed in with email. Purchase access is checked separately.');
    } catch (error) {
      Alert.alert('Email sign-in unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPassword('');
      finishAction();
    }
  };

  const onGuest = async () => {
    if (!beginAction()) return;
    setPassword('');
    setEmailForm(false);
    try {
      await auth.signInGuest();
      setFlash('Signed in as guest - progress is saved on this device.');
    } catch (error) {
      Alert.alert(
        'Guest profile unavailable',
        error instanceof Error
          ? error.message
          : 'The device could not save the guest profile. Check available storage and try again.',
      );
    } finally {
      finishAction();
    }
  };

  const onGoogle = async (existingAccount = true) => {
    if (!beginAction()) return;
    setPassword('');
    setEmailForm(false);
    setGooglePending(true);
    try {
      const googleUser = existingAccount ? await auth.signInGoogle({ existingAccount: true }) : await auth.signInGoogle();
      setFlash(
        googleUser.displayName
          ? `Signed in with Google as ${googleUser.displayName}.`
          : 'Signed in with Google.',
      );
    } catch (error) {
      const retryMessage = auth.googleSignInRetryMessage(error);
      if (retryMessage) {
        setGoogleRetry({ existingAccount, message: retryMessage });
      } else {
        Alert.alert(
          'Google sign-in unavailable',
          error instanceof Error
            ? error.message
            : 'Google sign-in could not be completed. Please try again.',
        );
      }
    } finally {
      setGooglePending(false);
      finishAction();
    }
  };

  const onApple = async () => {
    if (!beginAction()) return;
    setPassword('');
    setEmailForm(false);
    setApplePending(true);
    try {
      await auth.signInApple({ existingAccount: true });
      setFlash('Signed in with Apple.');
    } catch (error) {
      Alert.alert('Apple sign-in unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setApplePending(false);
      finishAction();
    }
  };

  const onSignOut = async () => {
    if (!beginAction()) return;
    try {
      await auth.signOut();
      setFlash('Signed out. Your local saves are untouched.');
    } catch {
      Alert.alert('Sign-out incomplete', 'The device could not clear the local account marker.');
    } finally {
      finishAction();
    }
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
    if (!beginAction()) return;
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
      finishAction();
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
    if (actionPending.current) return;
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

      {googlePending ? (
        <Card style={styles.flash}>
          <Text style={styles.noteText}>
            Finish Google sign-in in the browser. If it expires or opens Sunlight, close that tab and retry here.
          </Text>
        </Card>
      ) : null}

      {googleRetry ? (
        <Card style={styles.flash}>
          <View accessibilityLiveRegion="polite" style={styles.retry}>
            <Text style={styles.noteTitle}>Google sign-in not completed</Text>
            <Text style={styles.noteText}>{googleRetry.message}</Text>
            <Button
              label="Try Google sign-in again"
              variant="secondary"
              disabled={busy}
              onPress={() => void onGoogle(googleRetry.existingAccount)}
            />
          </View>
        </Card>
      ) : null}

      {user ? (
        <>
          <Card style={styles.account}>
            <Text style={styles.accountLabel}>Signed in</Text>
            <Text style={styles.accountId} numberOfLines={1}>
              {user.provider === 'guest' ? 'Guest profile' : (user.displayName ?? (user.provider === 'email' ? 'Email account' : user.provider === 'apple' ? 'Apple account' : 'Google account'))}
            </Text>
          </Card>
          <View style={styles.buttons}>
            {Platform.OS === 'ios' && user.provider === 'guest' ?
              <AppleAccountButton disabled={busy} loading={applePending} onPress={() => void onApple()} /> : null}
            {user.provider === 'guest' ? (
              <Button
                label={user.remoteId ? 'Link Google account' : 'Continue with Google'}
                variant="primary"
                loading={busy}
                onPress={() => void onGoogle(false)}
              />
            ) : null}
            {user.provider === 'guest' ? <Button
              label="Sign in to existing Google account"
              variant="secondary"
              disabled={busy}
              onPress={() => void onGoogle(true)}
            /> : null}
            <Button label="Sign out" variant="secondary" disabled={busy} onPress={onSignOut} />
            <Button
              label={user.remoteId ? 'Delete account & data' : 'Delete local account & data'}
              variant="danger"
              loading={busy}
              onPress={onDelete}
            />
          </View>
          <AccountBackupCard />
        </>
      ) : (
        <View style={styles.buttons}>
          {Platform.OS === 'ios' ?
            <AppleAccountButton disabled={busy} loading={applePending} onPress={() => void onApple()} /> : null}
          <Button
            label="Continue with Google"
            variant="secondary"
            loading={busy}
            onPress={() => void onGoogle(true)}
          />
          <Button label="Play as Guest" variant="primary" loading={busy} onPress={onGuest} />
          <Button
            label="Sign in with email"
            variant="secondary"
            disabled={busy}
            onPress={() => setEmailForm(true)}
          />
          {emailForm ? (
            <Card>
              <Text style={styles.noteTitle}>Existing account / reviewer sign-in</Text>
              <Text style={styles.noteText}>Use the account provided by support. This does not create an account or unlock purchases.</Text>
              <TextInput
                accessibilityLabel="Email address"
                placeholder="Email address"
                placeholderTextColor={styles.noteText.color}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!busy}
                style={styles.input}
              />
              <TextInput
                accessibilityLabel="Password"
                placeholder="Password"
                placeholderTextColor={styles.noteText.color}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                editable={!busy}
                style={styles.input}
              />
              <Button label="Sign in" onPress={onEmail} loading={busy} disabled={!email.trim() || !password} />
              <Button label="Cancel" variant="secondary" disabled={busy} onPress={() => { setPassword(''); setEmailForm(false); }} />
            </Card>
          ) : null}
        </View>
      )}

      <Card style={styles.note}>
        <Text style={styles.noteTitle}>
          {user && user.provider !== 'guest' ? 'Recoverable account' : 'Local-only progress'}
        </Text>
        <Text style={styles.noteText}>
          {user && user.provider !== 'guest'
            ? 'Sign-in reconnects purchase ownership. Career progress and remaining pack benefits are recoverable only after an account backup is confirmed above.'
            : 'Guest saves stay on this device and may be lost if the app is removed. Sign in and confirm an account backup before uninstalling.'}
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
    retry: { gap: spacing.sm },
    input: { color: colors.text, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: 8, padding: spacing.md, marginVertical: spacing.sm, fontSize: fontSize.md },
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
