import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { GlassAlert as Alert } from './GlassAlertModal';
import { useAuth } from '../services/auth';
import { syncAccountCareers, useAccountBackup } from '../services/accountRecovery';
import { useCareer } from '../state/careerStore';
import { fontSize, spacing, ThemeColors, useThemedStyles } from '../theme';

export function AccountBackupCard({ onSignIn }: { onSignIn?: () => void }) {
  const user = useAuth((state) => state.user);
  const status = useAccountBackup();
  const [busy, setBusy] = useState(false);
  const styles = useThemedStyles(makeStyles);
  const signedIn = Boolean(user?.remoteId && user.provider !== 'guest');
  const backup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await useCareer.getState().persistCritical(true);
      await syncAccountCareers(true);
    } catch (error) {
      Alert.alert('Backup not confirmed', error instanceof Error ? error.message : 'Keep the app installed and retry when online.');
    } finally { setBusy(false); }
  };
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Career backup & recovery</Text>
      <Text style={styles.copy}>{signedIn ? status.message : 'Sign in with Google to back up both careers, remaining balances, tokens and ad-free expiry.'}</Text>
      {signedIn && status.confirmedAt ? <Text style={styles.copy}>Last confirmed: {new Date(status.confirmedAt).toLocaleString()}</Text> : null}
      <Text style={styles.copy}>Before uninstalling, tap Backup now and wait for confirmation. Recovery does not regrant spent packs or restart ad-free time.</Text>
      <View style={styles.action}>
        {signedIn ? <Button label="Backup now / recover careers" loading={busy || status.phase === 'syncing'} onPress={() => void backup()} />
          : onSignIn ? <Button label="Sign in for backup" variant="secondary" onPress={onSignIn} /> : null}
      </View>
    </Card>
  );
}
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { color: colors.text, fontSize: fontSize.md },
  copy: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
  action: { marginTop: spacing.md },
});
