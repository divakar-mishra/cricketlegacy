import { Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MODAL_PRIORITY, useModalQueue } from '../context/ModalQueueContext';
import { useSettings } from '../state/settingsStore';
import { analytics } from '../services';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';

/** Offer contextual coaching, not a timed slideshow. */
export function Onboarding() {
  const done = useSettings((s) => s.hasOnboarded);
  const hydrated = useSettings((s) => s.hasHydrated);
  const setOnboarded = useSettings((s) => s.setOnboarded);
  const dismissTip = useSettings((s) => s.dismissTip);
  const visible = useModalQueue(!done && hydrated, MODAL_PRIORITY.prompt, 'onboarding');
  const styles = useThemedStyles(makeStyles);
  const complete = (guided: boolean) => {
    if (!guided)
      ['common', 'player', 'manager'].forEach((mode) => dismissTip(`coach-v1:skip:${mode}`));
    analytics.logEvent(analytics.EVT.ONBOARDING_COMPLETE, {
      reason: guided ? 'guided' : 'skipped',
      last_slide: 0,
    });
    setOnboarded(true);
  };
  if (!visible || done || !hydrated) return null;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => complete(false)}>
      <SafeAreaView style={styles.backdrop}>
        <ScrollView
          style={styles.card}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.kicker}>WELCOME TO YOUR CRICKET CAREER</Text>
          <Text style={styles.title}>Your coach is ready</Text>
          <Text style={styles.body}>
            Create your player or take charge of a club. Your coach will highlight the real controls
            as you reach them, at your pace.
          </Text>
          <Text style={styles.body}>
            Choose your own skills, learn training and prepare for cricket. You can skip any step or
            replay a screen guide later.
          </Text>
          <Button label="Guide me" variant="primary" onPress={() => complete(true)} />
          <Button label="Explore on my own" variant="ghost" onPress={() => complete(false)} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.75)',
    },
    card: {
      flexGrow: 0,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
      borderRadius: radius.lg,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    content: { padding: spacing.lg, gap: spacing.md },
    kicker: { fontSize: fontSize.xs, color: colors.accent, fontWeight: fontWeight.bold },
    title: { fontSize: fontSize.xxl, color: colors.text, fontWeight: fontWeight.heavy },
    body: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 23 },
  });
