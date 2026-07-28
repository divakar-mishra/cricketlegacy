/**
 * FluidText — a buttery, "flowing" text reveal.
 *
 * Each word (or character) fades and rises into place with a small stagger, so
 * a line of dialogue pours in like fluid rather than snapping in as a rigid
 * block. The animation is driven entirely by Reanimated layout `entering`
 * animations, which run on the native UI thread — there is no per-frame JS work
 * and no setState-per-character (unlike a classic typewriter), so it holds
 * 60/120 FPS on both platforms.
 *
 * For very long passages it falls back to a single fade-rise block to keep the
 * view count bounded.
 */
import { useMemo } from 'react';
import { StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from './AppText';

interface FluidTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Reveal granularity. */
  by?: 'word' | 'char';
  /** ms between successive tokens. */
  stagger?: number;
  /** ms before the first token appears. */
  delay?: number;
  /** per-token fade/rise duration. */
  duration?: number;
  /** Cap the total reveal time so long passages still finish promptly. */
  maxRevealMs?: number;
  numberOfLines?: number;
}

const MAX_TOKENS = 90;

export function FluidText({
  text,
  style,
  by = 'word',
  stagger = 34,
  delay = 0,
  duration = 380,
  maxRevealMs = 1400,
  numberOfLines,
}: FluidTextProps) {
  const tokens = useMemo(() => {
    if (by === 'char') return Array.from(text);
    return text.split(/(\s+)/).filter((t) => t.length > 0);
  }, [text, by]);

  // Long passage or explicit line clamp → one smooth block (bounded view count).
  if (tokens.length > MAX_TOKENS || numberOfLines != null) {
    return (
      <Animated.View entering={FadeInDown.duration(duration).delay(delay)}>
        <AppText style={style} numberOfLines={numberOfLines}>
          {text}
        </AppText>
      </Animated.View>
    );
  }

  return (
    <View style={styles.row}>
      {tokens.map((tok, i) => {
        const isSpace = /^\s+$/.test(tok);
        if (isSpace && by === 'word') {
          return (
            <AppText key={`sp-${i}`} style={style}>
              {tok}
            </AppText>
          );
        }
        const d = delay + Math.min(i * stagger, maxRevealMs);
        return (
          <Animated.View
            // key includes text length so a new passage remounts and re-reveals
            key={`${text.length}-${i}`}
            entering={FadeInDown.duration(duration).delay(d)}
          >
            <AppText style={style}>{tok}</AppText>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
});
