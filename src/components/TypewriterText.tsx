/**
 * TypewriterText — renders text character by character when speed is 1×.
 * At higher speeds (2×/4×/instant), renders immediately without animation.
 * Uses a simple interval-based approach that's reliable on React Native.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

interface TypewriterTextProps {
  text: string;
  speed?: 1 | 2 | 4;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** ms per character — only used at speed 1 */
  charDelay?: number;
}

export function TypewriterText({
  text,
  speed = 1,
  style,
  numberOfLines,
  charDelay = 18,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState(speed > 1 ? text : '');
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (speed > 1) {
      setDisplayed(text);
      return;
    }

    // Reset for new text
    indexRef.current = 0;
    setDisplayed('');

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
      }
    }, charDelay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, speed, charDelay]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {displayed}
      {speed === 1 && displayed.length < text.length ? (
        <Text style={{ opacity: 0.6 }}>▌</Text>
      ) : null}
    </Text>
  );
}
