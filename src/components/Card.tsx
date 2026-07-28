import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { haptics } from '../audio';
import { radius, shadow, spacing, ThemeColors, useThemedStyles } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  accessibilityLabel?: string;
};

export const Card = React.memo(function Card({ children, style, onPress, padded = true, accessibilityLabel }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const pad = compact ? styles.paddedCompact : styles.padded;
  const handlePress = useCallback(() => {
    if (onPress) { haptics.selection(); onPress(); }
  }, [onPress]);

  const content = (
    // overflow hidden clips children to the card's borderRadius on Android.
    <View style={[styles.card, padded && pad, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 0,
      alignSelf: 'stretch',
      // overflow hidden clips children to borderRadius (fixes background bleed on Android).
      overflow: 'hidden',
      // Android: elevation 1 is enough for visual depth.
      ...(Platform.OS === 'android'
        ? { elevation: 1 }
        : shadow.soft),
    },
    padded: { padding: spacing.lg },
    paddedCompact: { padding: spacing.md },
  });
