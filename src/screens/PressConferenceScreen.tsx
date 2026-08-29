import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Screen, ScreenHeader, AppText as Text } from '../components';
import { resolveNextCareerStep } from '../game/careerStep';
import { AppliedEffect } from '../game/narrative';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

interface ResultView {
  text: string;
  applied: AppliedEffect[];
}

export function PressConferenceScreen({ navigation }: ScreenProps<'Press'>) {
  const save = useCareer((s) => s.save);
  const resolvePress = useCareer((s) => s.resolvePress);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [result, setResult] = useState<ResultView | null>(null);
  const [fade] = useState(() => new Animated.Value(0));

  const rendered = save ? useCareer.getState().pendingPress() : null;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [rendered?.id, result, fade]);

  const onChoose = (choiceId: string) => {
    if (!rendered) return;
    const res = resolvePress(rendered.id, choiceId);
    if (res.ok) setResult({ text: res.resultText ?? '', applied: res.applied ?? [] });
  };

  if (!save) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Press" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>No active club.</Text>
      </Screen>
    );
  }

  if (result) {
    const nextStep = resolveNextCareerStep(save);
    const nextIsPress = nextStep.action === 'OPEN_PRESS';
    const nextIsMatchday = nextStep.action === 'PLAY_MATCH';
    const nextLabel = nextIsPress
      ? 'NEXT PRESS DUTY'
      : nextIsMatchday
        ? 'ENTER MATCHDAY'
        : 'RETURN TO MANAGER HOME';
    const continueFromResult = () => {
      if (nextIsPress) {
        setResult(null);
        return;
      }
      if (nextIsMatchday) {
        navigation.replace('Match');
        return;
      }
      navigation.replace('ManagerHub');
    };
    return (
      <Screen
        gradient={gradients.pitch}
        footer={
          <View style={styles.resultActions}>
            <Button label={nextLabel} variant="gold" onPress={continueFromResult} />
            {nextIsPress || nextIsMatchday ? (
              <Button
                label="Return to Home"
                variant="ghost"
                size="sm"
                onPress={() => navigation.replace('ManagerHub')}
              />
            ) : null}
          </View>
        }
      >
        <ScreenHeader title="On the Record" onBack={() => navigation.goBack()} />
        <Animated.View style={{ opacity: fade }}>
          <Card style={styles.bodyCard}>
            <Text style={styles.resultText}>{result.text}</Text>
          </Card>
          {result.applied.length ? (
            <View style={styles.chips}>
              {result.applied.map((e, i) => (
                <View key={i} style={[styles.chip, { borderColor: toneColor(e.tone, colors) }]}>
                  <Text style={[styles.chipText, { color: toneColor(e.tone, colors) }]}>
                    {e.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.nextActionBand}>
            <Text style={styles.nextActionKicker}>NEXT</Text>
            <Text style={styles.nextActionTitle}>{nextStep.title}</Text>
          </View>
        </Animated.View>
      </Screen>
    );
  }

  if (!rendered) {
    return (
      <Screen
        gradient={gradients.pitch}
        footer={<Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />}
      >
        <ScreenHeader title="Press Room" onBack={() => navigation.goBack()} />
        <Card style={styles.bodyCard}>
          <Text style={styles.emptyTitle}>No media duties right now.</Text>
        </Card>
      </Screen>
    );
  }

  const count = save.managerStory?.pendingEventIds.length ?? 0;

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Press Room"
        subtitle={count > 1 ? `${count} waiting` : undefined}
        onBack={() => navigation.goBack()}
      />
      <Animated.View style={{ opacity: fade }}>
        {rendered.speaker ? <Text style={styles.speaker}>{rendered.speaker}</Text> : null}
        <Text style={styles.title}>{rendered.title}</Text>
        <Card style={styles.bodyCard}>
          <Text style={styles.body}>{rendered.body}</Text>
        </Card>
        <Text style={styles.prompt}>Your response</Text>
        {rendered.choices.map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
            onPress={() => onChoose(c.id)}
            accessibilityRole="button"
            accessibilityLabel={c.label}
          >
            <Text style={styles.choiceLabel}>{c.label}</Text>
            {c.desc ? <Text style={styles.choiceDesc}>{c.desc}</Text> : null}
          </Pressable>
        ))}
      </Animated.View>
    </Screen>
  );
}

function toneColor(tone: AppliedEffect['tone'], colors: ThemeColors): string {
  return tone === 'good' ? colors.success : tone === 'bad' ? colors.danger : colors.textMuted;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    empty: { color: colors.textMuted, fontSize: fontSize.md },
    emptyTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    emptyBody: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    speaker: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.xxl,
      fontWeight: fontWeight.black,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    bodyCard: { marginTop: spacing.sm },
    body: { color: colors.text, fontSize: fontSize.md, lineHeight: 24 },
    prompt: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    choice: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    choicePressed: { opacity: 0.8, borderColor: colors.accent },
    choiceLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    choiceDesc: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
    resultText: { color: colors.text, fontSize: fontSize.md, lineHeight: 24, fontStyle: 'italic' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
    chip: {
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    nextActionBand: {
      marginTop: spacing.xl,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
    },
    nextActionKicker: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 1,
    },
    nextActionTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: 3,
    },
    resultActions: { gap: spacing.sm },
  });
