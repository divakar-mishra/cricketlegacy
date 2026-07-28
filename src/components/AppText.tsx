import React, { useMemo } from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { fonts } from '../theme/fonts';

/**
 * Drop-in replacement for RN's <Text> that maps `fontWeight` to the correct
 * bundled font family (Inter for body/UI, Sora for the heaviest display sizes) —
 * because @expo-google-fonts registers each weight as its OWN family name, so a
 * bare `fontWeight: '700'` would otherwise silently fall back to the system font.
 * If a style already specifies `fontFamily`, that wins (e.g. explicit Sora).
 */
function familyForWeight(weight?: TextStyle['fontWeight']): string {
  const w =
    typeof weight === 'number'
      ? weight
      : weight === 'bold'
        ? 700
        : weight === 'normal'
          ? 400
          : parseInt(String(weight ?? '400'), 10) || 400;
  if (w >= 800) return fonts.display;
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.body;
}

export const AppText = React.memo(function AppText({
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const flat = useMemo(() => (StyleSheet.flatten(style) ?? {}) as TextStyle, [style]);
  const family = flat.fontFamily ?? familyForWeight(flat.fontWeight);
  const isSora =
    family === fonts.display || family === fonts.heading || family === fonts.headingSemi;
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (isSora ? 1.2 : undefined)}
      style={[style, { fontFamily: family }]}
    />
  );
});
