import { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MONETIZATION } from '../config/monetization';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import * as ads from '../services/ads';
import { adAudience, ageToAdBand, AdAgeChoice, readAdAgeChoice, saveAdAgeChoice } from '../services/adAgeChoice';
import { useSettings } from '../state/settingsStore';
import { fontSize, radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

/** One on-device, age-only choice before any ad SDK initialization. */
export function AdAgePrompt() {
  const { colors } = useTheme();
  const onboarded = useSettings((state) => state.hasOnboarded);
  const settingsReady = useSettings((state) => state.hasHydrated);
  const [state, setState] = useState<'loading' | 'prompt' | 'saving' | 'done'>('loading');
  const [choice, setChoice] = useState<AdAgeChoice | null>(null);
  const [ageText, setAgeText] = useState('');
  const [step, setStep] = useState<'age' | 'residence' | 'permission'>('age');
  const [error, setError] = useState('');
  const visible = useModalQueue((state === 'prompt' || state === 'saving') && onboarded && settingsReady, MODAL_PRIORITY.prompt, 'ad-age');

  useEffect(() => {
    let active = true;
    void readAdAgeChoice()
      .then((choice) => {
        if (!active) return;
        if (choice) {
          setChoice(choice);
          setState('done');
        } else {
          setState('prompt');
        }
      })
      .catch(() => {
        if (active) setState('prompt');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (state !== 'done' || !choice) return undefined;
    // Let the age modal finish closing before UMP displays a consent form.
    const timer = setTimeout(() => {
      void ads.configureAds(MONETIZATION.admob, adAudience(choice));
    }, 300);
    return () => clearTimeout(timer);
  }, [choice, state]);

  const persist = useCallback(async (selected: AdAgeChoice) => {
    setState('saving');
    setError('');
    try {
      await saveAdAgeChoice(selected);
      setChoice(selected);
      setState('done');
    } catch {
      setError('Could not save your choice on this device. Please try again.');
      setState('prompt');
    }
  }, []);

  const choose = useCallback(() => {
    if (state !== 'prompt') return;
    const band = ageToAdBand(ageText.trim());
    if (!band) {
      setError('Enter your age as a number.');
      return;
    }
    if (band === 'teen') {
      setStep('residence');
      return;
    }
    void persist({ band, residence: null, guardianPermission: false });
  }, [ageText, persist, state]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={() => undefined}>
      <SafeAreaView style={styles.backdrop} edges={['top', 'right', 'bottom', 'left']}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {step === 'age' ? 'Your age' : step === 'residence' ? 'Where do you live?' : 'Parent or guardian permission'}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {step === 'age'
              ? 'Enter your age to continue. We save only an age group on this device.'
              : step === 'residence'
                ? 'Choose your country of residence to apply the right age rules.'
                : 'Do you have permission from a parent or guardian to play?'}
          </Text>
          {step === 'age' ? (
            <>
              <TextInput
                accessibilityLabel="Your age"
                value={ageText}
                onChangeText={(value) => { setAgeText(value.replace(/[^0-9]/g, '')); setError(''); }}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="Age"
                placeholderTextColor={colors.textMuted}
                editable={state !== 'saving'}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              />
              <Button label="Continue" variant="secondary" disabled={state === 'saving'} onPress={choose} />
            </>
          ) : step === 'residence' ? (
            <>
              <Button label="India" variant="secondary" disabled={state === 'saving'} onPress={() => void persist({ band: 'teen', residence: 'india', guardianPermission: false })} />
              <Button label="Outside India" variant="secondary" disabled={state === 'saving'} onPress={() => setStep('permission')} />
            </>
          ) : (
            <>
              <Button label="Yes, I have permission" variant="secondary" disabled={state === 'saving'} onPress={() => void persist({ band: 'teen', residence: 'elsewhere', guardianPermission: true })} />
              <Button label="No" variant="secondary" disabled={state === 'saving'} onPress={() => void persist({ band: 'teen', residence: 'elsewhere', guardianPermission: false })} />
            </>
          )}
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.74)',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700' },
  body: { fontSize: fontSize.md, lineHeight: 23, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.lg,
  },
});
