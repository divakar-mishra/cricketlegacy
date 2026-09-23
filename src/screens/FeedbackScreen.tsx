import { useMemo, useState } from 'react';
import { Linking, StyleSheet, TextInput } from 'react-native';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { AppText as Text, Button, Card, Screen, ScreenHeader, SegmentedControl } from '../components';
import { BUILD_INFO } from '../config/buildInfo';
import { PRIVACY_CONTACT_EMAIL } from '../content/privacyPolicy';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import { fontSize, spacing, ThemeColors, useThemedStyles } from '../theme';

type FeedbackKind = 'BUG' | 'GAMEPLAY' | 'UI' | 'OTHER';

const FEEDBACK_KINDS: readonly { value: FeedbackKind; label: string }[] = [
  { value: 'BUG', label: 'Bug' },
  { value: 'GAMEPLAY', label: 'Gameplay' },
  { value: 'UI', label: 'UI / UX' },
  { value: 'OTHER', label: 'Other' },
];

export function FeedbackScreen({ navigation }: ScreenProps<'Feedback'>) {
  const styles = useThemedStyles(makeStyles);
  const mode = useCareer((state) => state.save?.mode);
  const [kind, setKind] = useState<FeedbackKind>('BUG');
  const [message, setMessage] = useState('');
  const trimmed = message.trim();
  const diagnosticLine = useMemo(
    () =>
      `App ${BUILD_INFO.appVersion} (${BUILD_INFO.nativeBuildVersion}) · ${mode === 'manager' ? 'Manager Career' : mode === 'career' ? 'Player Career' : 'Main menu'}`,
    [mode],
  );

  const send = async () => {
    if (!trimmed) {
      Alert.alert('Add your feedback', 'Describe what happened or what you would like improved.');
      return;
    }
    const subject = `Cricket Legacy feedback — ${FEEDBACK_KINDS.find((item) => item.value === kind)?.label ?? kind}`;
    const body = `${trimmed}\n\n---\n${diagnosticLine}`;
    const url = `mailto:${PRIVACY_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'Email app unavailable',
        `Send your feedback to ${PRIVACY_CONTACT_EMAIL}. Your message has not been sent.`,
      );
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Send Feedback" onBack={() => navigation.goBack()} />
      <Card>
        <Text style={styles.heading}>What should we look at?</Text>
        <SegmentedControl
          value={kind}
          options={FEEDBACK_KINDS}
          onChange={setKind}
          accessibilityLabel="Feedback category"
          style={styles.categories}
        />
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Describe the screen, match or action involved…"
          placeholderTextColor={styles.placeholder.color}
          multiline
          maxLength={2000}
          textAlignVertical="top"
          accessibilityLabel="Feedback message"
          style={styles.input}
        />
        <Text style={styles.count}>{message.length}/2000</Text>
      </Card>
      <Card style={styles.infoCard}>
        <Text style={styles.info}>{diagnosticLine}</Text>
        <Text style={styles.info}>
          Tapping Send opens your email app. Nothing is submitted until you review and send it.
          Never include passwords, payment-card details or private store credentials.
        </Text>
      </Card>
      <Button label="Send via email" onPress={() => void send()} disabled={!trimmed} />
      <Text style={styles.address} selectable>
        Support: {PRIVACY_CONTACT_EMAIL}
      </Text>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    heading: { color: colors.text, fontSize: fontSize.md, marginBottom: spacing.md },
    categories: { marginBottom: spacing.lg },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text,
      fontSize: fontSize.md,
      lineHeight: 22,
      minHeight: 180,
      padding: spacing.md,
    },
    placeholder: { color: colors.textFaint },
    count: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.xs, textAlign: 'right' },
    infoCard: { gap: spacing.sm, marginVertical: spacing.md },
    info: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
    address: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.md, textAlign: 'center' },
  });
