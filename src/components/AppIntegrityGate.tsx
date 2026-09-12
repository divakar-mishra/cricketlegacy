import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, Text, View } from 'react-native';
import { AppIntegrityStatus, checkAppIntegrity } from '../services/appIntegrity';
import { useTheme } from '../theme';

export function AppIntegrityGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppIntegrityStatus | 'CHECKING'>('CHECKING');
  const { colors } = useTheme();
  useEffect(() => {
    let active = true;
    const verify = () => {
      void checkAppIntegrity().then((result) => {
        if (active) setStatus(result);
      });
    };
    verify();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') verify();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  if (status === 'VERIFIED' || status === 'OFFLINE' || status === 'SKIPPED') return <>{children}</>;
  const rejected = status === 'REJECTED';
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 28,
        gap: 20,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
        {status === 'CHECKING'
          ? 'Checking your game'
          : rejected
            ? 'Install the official game'
            : 'Connect to verify your game'}
      </Text>
      {status === 'CHECKING' ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>
            {rejected
              ? 'Google Play could not recognise this installation as an official licensed copy. Open Cricket Legacy on Google Play. Your saves have not been deleted.'
              : 'Verification is unavailable. Check your connection and Google Play services, then retry. After a successful check, offline play is available.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStatus('CHECKING');
              void checkAppIntegrity().then(setStatus);
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 18, paddingVertical: 12 }}>
              Retry verification
            </Text>
          </Pressable>
          {rejected ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => {
                void Linking.openURL(
                  'https://play.google.com/store/apps/details?id=com.coverdrive.cricket',
                ).catch(() => undefined);
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 18 }}>Open Google Play</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}
