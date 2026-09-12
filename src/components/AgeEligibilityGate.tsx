import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PUBLIC_RESOURCES } from '../config/legal';
import {
  AGE_DECLARATION_KEY,
  AgeBand,
  AgeDeclaration,
  Residence,
  canUseGame,
  isAgeDeclaration,
} from '../services/ageEligibility';
import { useTheme } from '../theme';

export function AgeEligibilityGate({
  children,
  onAccepted,
}: {
  children?: ReactNode;
  onAccepted: (declaration: AgeDeclaration) => void;
}) {
  const { colors } = useTheme();
  const [status, setStatus] = useState<'loading' | 'form' | 'accepted' | 'blocked'>('loading');
  const [band, setBand] = useState<AgeBand>();
  const [residence, setResidence] = useState<Residence>();
  const [guardianPermission, setGuardianPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(AGE_DECLARATION_KEY)
      .then((raw) => {
        if (!active) return;
        const saved: unknown = raw ? JSON.parse(raw) : null;
        if (!isAgeDeclaration(saved)) {
          setStatus('form');
          return;
        }
        if (canUseGame(saved)) {
          onAccepted(saved);
          setStatus('accepted');
        } else setStatus('blocked');
      })
      .catch(() => {
        if (active) {
          setStatus('form');
          setError('Could not read your age preference. Please try again.');
        }
      });
    return () => {
      active = false;
    };
  }, [onAccepted]);
  const submit = async () => {
    if (!band || !residence || busy) return;
    setBusy(true);
    setError('');
    const declaration: AgeDeclaration = { version: 1, band, residence, guardianPermission };
    try {
      await AsyncStorage.setItem(AGE_DECLARATION_KEY, JSON.stringify(declaration));
      if (canUseGame(declaration)) {
        onAccepted(declaration);
        setStatus('accepted');
      } else setStatus('blocked');
    } catch {
      setError('Could not save your preference. Please retry; your careers are unchanged.');
    } finally {
      setBusy(false);
    }
  };
  if (status === 'accepted') return <>{children}</>;
  const choice = (label: string, selected: boolean, action: () => void) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      disabled={busy}
      onPress={action}
      style={{
        padding: 16,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 16, flexGrow: 1, justifyContent: 'center' }}
      >
        <Text style={{ color: colors.accent, fontSize: 28, fontWeight: '700' }}>
          Cricket Legacy
        </Text>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.accent} />
        ) : status === 'blocked' ? (
          <>
            <Text style={{ color: colors.text, fontSize: 22 }}>
              This game is not available for your age group
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>
              You must be 18 or older in India, or 13 or older elsewhere with parent or guardian
              permission where required. Your existing saves have not been removed.
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: colors.text, fontSize: 22 }}>Before you start</Text>
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>
              Choose your age group and where you live. These answers stay on this device; we do not
              ask for your birthday.
            </Text>
            <Text style={{ color: colors.text }}>Where do you live?</Text>
            {choice('India', residence === 'india', () => setResidence('india'))}
            {choice('Outside India', residence === 'elsewhere', () => setResidence('elsewhere'))}
            <Text style={{ color: colors.text }}>Your age group</Text>
            {choice('Under 13', band === 'under13', () => setBand('under13'))}
            {choice('13–17', band === '13to17', () => setBand('13to17'))}
            {choice('18 or older', band === 'adult', () => setBand('adult'))}
            {residence === 'elsewhere' && band === '13to17' ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: guardianPermission }}
                disabled={busy}
                onPress={() => setGuardianPermission(!guardianPermission)}
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.text }}>
                  {guardianPermission ? '☑' : '☐'} I have parent or guardian permission to use the
                  game.
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !band || !residence || busy }}
              disabled={!band || !residence || busy}
              onPress={() => {
                void submit();
              }}
              style={{
                padding: 18,
                backgroundColor: colors.surfaceAlt,
                borderRadius: 12,
                opacity: !band || !residence || busy ? 0.5 : 1,
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 18 }}>
                {busy ? 'Saving…' : 'Continue'}
              </Text>
            </Pressable>
            {error ? (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {error}
              </Text>
            ) : null}
          </>
        )}
        {PUBLIC_RESOURCES.privacyPolicy ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => {
              void Linking.openURL(PUBLIC_RESOURCES.privacyPolicy!).catch(() =>
                setError('Could not open the Privacy Policy.'),
              );
            }}
          >
            <Text style={{ color: colors.accent, paddingVertical: 12 }}>Privacy Policy</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
