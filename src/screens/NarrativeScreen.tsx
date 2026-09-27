import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  AppText as Text,
  Button,
  FluidChoice,
  FluidText,
  GlassSurface,
  Screen,
  ScreenHeader,
} from '../components';
import { nextPendingEvent } from '../game/careerEvents';
import { advisorVisitKey, nextPlayerAdvice } from '../game/playerAdvisor';
import { AppliedEffect } from '../game/narrative';
import { nextUserFixtureId } from '../game/season';
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

export function NarrativeScreen({ navigation, route }: ScreenProps<'Narrative'>) {
  const save = useCareer((s) => s.save);
  const resolveStory = useCareer((s) => s.resolveStory);
  const markFlagSeen = useCareer((s) => s.markFlagSeen);
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [result, setResult] = React.useState<ResultView | null>(null);

  const rendered = save ? nextPendingEvent(save) : null;
  const adviserAdvice = save && route.params?.adviser
    ? nextPlayerAdvice(save, nextUserFixtureId(save))
    : undefined;

  const onAdviserChoice = (action: 'decline' | 'accept' | 'recovery') => {
    if (!save || !adviserAdvice) return;
    markFlagSeen(adviserAdvice.key);
    markFlagSeen(advisorVisitKey(save));
    if (action === 'decline') {
      navigation.goBack();
      return;
    }
    if (action === 'recovery' || adviserAdvice.kind === 'INJURY' && adviserAdvice.action === 'View recovery') {
      const player = save.userPlayerId ? save.players[save.userPlayerId] : undefined;
      if (!player?.injury) return navigation.goBack();
      navigation.replace('InjuryReport', {
        playerId: player.id,
        playerName: player.name,
        weeksOut: player.injury.matchesOut,
        matchesMissed: player.injury.matchesOut,
      });
    } else if (adviserAdvice.kind === 'INVEST') {
      markFlagSeen('playerHomePortfolioVisited');
      navigation.replace('InvestmentScreen');
    } else if (adviserAdvice.kind === 'VENTURE') {
      navigation.replace('PlayerLife', { initialTab: 'finance' });
    } else {
      navigation.replace('Training', { initialDevelopment: true });
    }
  };

  const onChoose = (choiceId: string) => {
    if (!rendered) return;
    const res = resolveStory(rendered.event.id, choiceId);
    if (res.ok) setResult({ text: res.resultText ?? '', applied: res.applied ?? [] });
  };

  const onContinue = () => setResult(null);

  if (!save) {
    return (
      <Screen gradient={gradients.pitch}>
        <ScreenHeader title="Career" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>No active career.</Text>
      </Screen>
    );
  }

  if (adviserAdvice) {
    return (
      <Screen scroll gradient={gradients.pitch}>
        <ScreenHeader title="Your Story" onBack={() => navigation.goBack()} />
        <Text style={styles.speaker}>Your free career adviser</Text>
        <Text style={styles.title}>{adviserAdvice.title}</Text>
        <GlassSurface style={styles.bodyCard} intensity={0.95} blur={false}>
          <Text style={styles.body}>{adviserAdvice.message}</Text>
        </GlassSurface>
        <Text style={styles.prompt}>What do you do?</Text>
        <FluidChoice
          label={adviserAdvice.action}
          desc="Open the relevant screen; no purchase is made"
          index={0}
          style={styles.choice}
          onPress={() => onAdviserChoice('accept')}
        />
        {adviserAdvice.kind === 'INJURY' && adviserAdvice.action === 'View physio' ? (
          <FluidChoice
            label="Review recovery options"
            desc="Rest for free or see the optional gem fast-track"
            index={1}
            style={styles.choice}
            onPress={() => onAdviserChoice('recovery')}
          />
        ) : null}
        <FluidChoice
          label="Carry on for now"
          desc="Decline the advice and return to your career"
          index={2}
          style={styles.choice}
          onPress={() => onAdviserChoice('decline')}
        />
      </Screen>
    );
  }

  // Showing the consequence of the choice just made.
  if (result) {
    return (
      <Screen
        gradient={gradients.pitch}
        footer={<Button label="Continue" variant="gold" onPress={onContinue} />}
      >
        <ScreenHeader title="Your Decision" onBack={() => navigation.goBack()} />
        <GlassSurface style={styles.bodyCard} intensity={0.95} blur={false}>
          <FluidText text={result.text} style={styles.resultText} stagger={26} />
        </GlassSurface>
        {result.applied.length ? (
          <View style={styles.chips}>
            {result.applied.map((e, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.duration(360).delay(200 + i * 90)}
                style={[styles.chip, { borderColor: toneColor(e.tone, colors) }]}
              >
                <Text style={[styles.chipText, { color: toneColor(e.tone, colors) }]}>
                  {e.label}
                </Text>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(400).delay(300)}>
            <Text style={styles.noEffect}>The moment passes. Its weight, you&apos;ll carry.</Text>
          </Animated.View>
        )}
      </Screen>
    );
  }

  // Inbox empty.
  if (!rendered) {
    return (
      <Screen
        gradient={gradients.pitch}
        footer={<Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />}
      >
        <ScreenHeader title="Your Story" onBack={() => navigation.goBack()} />
        <GlassSurface style={styles.bodyCard}>
          <Text style={styles.emptyTitle}>Nothing on your mind right now.</Text>
          <Text style={styles.emptyBody}>No story moments yet.</Text>
        </GlassSurface>
      </Screen>
    );
  }

  const count = save.story?.pendingEventIds.length ?? 0;

  return (
    <Screen scroll gradient={gradients.pitch}>
      <ScreenHeader
        title="Your Story"
        subtitle={count > 1 ? `${count} moments waiting` : undefined}
        onBack={() => navigation.goBack()}
      />
      {/* key by event id so each new beat re-triggers the fluid reveal */}
      <View key={rendered.event.id}>
        {rendered.speaker ? (
          <Animated.View entering={FadeInDown.duration(360)}>
            <Text style={styles.speaker}>{rendered.speaker}</Text>
          </Animated.View>
        ) : null}
        <Animated.View entering={FadeInDown.duration(400).delay(60)}>
          <Text style={styles.title}>{rendered.title}</Text>
        </Animated.View>
        <GlassSurface style={styles.bodyCard} intensity={0.95} blur={false}>
          <FluidText text={rendered.body} style={styles.body} stagger={30} delay={180} />
        </GlassSurface>

        <Animated.View entering={FadeIn.duration(400).delay(240)}>
          <Text style={styles.prompt}>What do you do?</Text>
        </Animated.View>
        {rendered.choices.map((c, i) => (
          <FluidChoice
            key={c.id}
            label={c.label}
            desc={c.desc}
            index={i}
            style={styles.choice}
            onPress={() => onChoose(c.id)}
          />
        ))}
      </View>
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
    bodyCard: {
      marginTop: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderColor: colors.borderStrong,
    },
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
    choice: { marginBottom: spacing.sm },
    resultText: { color: colors.text, fontSize: fontSize.md, lineHeight: 24, fontStyle: 'italic' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
    chip: {
      borderWidth: 1.5,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    noEffect: {
      color: colors.textFaint,
      fontSize: fontSize.sm,
      fontStyle: 'italic',
      marginTop: spacing.lg,
      textAlign: 'center',
    },
  });
