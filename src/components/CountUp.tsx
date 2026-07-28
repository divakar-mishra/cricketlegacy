import { useEffect, useRef, useState } from 'react';
import { TextProps } from 'react-native';
import { AppText } from './AppText';

interface Props extends TextProps {
  value: number;
  duration?: number;
  /** Text rendered before/after the number. */
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
}

/**
 * Tweens a displayed integer from its previous value to `value` using a JS
 * animation frame loop (works for arbitrary text, unlike Animated numbers).
 */
export function CountUp({
  value,
  duration = 350,
  prefix = '',
  suffix = '',
  format,
  style,
  ...rest
}: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const n = Math.round(from + (value - from) * eased);
      setDisplay(n);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  const text = format ? format(display) : String(display);
  return (
    <AppText style={style} {...rest}>
      {prefix}
      {text}
      {suffix}
    </AppText>
  );
}
