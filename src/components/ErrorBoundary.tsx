import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { crash } from '../services';
import { fontSize, fontWeight, radius, spacing, ThemeColors, useThemedStyles } from '../theme';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

/**
 * App-wide safety net. Any render/runtime error in the tree is caught here and
 * reported through the local crash facade, showing a recoverable fallback
 * instead of a white screen. Production-critical for store review + reviews.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    try {
      crash.captureException(error, { componentStack: info.componentStack ?? '' });
    } catch {
      /* never let reporting throw */
    }
  }

  private reset = (): void => this.setState({ hasError: false, message: undefined });

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback message={this.state.message} onReset={this.reset} />;
  }
}

/** Themed fallback UI (a functional child so it can read the active palette). */
function ErrorFallback({ message, onReset }: { message?: string; onReset: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>🏏</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        Something went wrong. Your progress is saved.
      </Text>
      {__DEV__ && message ? <Text style={styles.diagnostic}>{message}</Text> : null}
      <Pressable style={styles.button} onPress={onReset} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emoji: { fontSize: 48, marginBottom: spacing.md },
    title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.black, marginBottom: spacing.sm },
    body: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
    diagnostic: {
      color: colors.warning,
      fontSize: fontSize.xs,
      lineHeight: 18,
      marginBottom: spacing.lg,
      maxWidth: 720,
      textAlign: 'center',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    buttonText: { color: colors.white, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  });
