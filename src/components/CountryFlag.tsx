import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { AppText as Text } from './AppText';

export function CountryFlag({
  countryId,
  flag,
  size = 24,
  style,
}: {
  countryId: string;
  flag: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (countryId === 'england') {
    const width = Math.round(size * 1.45);
    const bar = Math.max(3, Math.round(size * 0.2));
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel="England flag"
        style={[styles.england, { width, height: size }, style]}
      >
        <View style={[styles.horizontalCross, { height: bar, top: (size - bar) / 2 }]} />
        <View style={[styles.verticalCross, { width: bar, left: (width - bar) / 2 }]} />
      </View>
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${countryId} flag`}
      style={[styles.emojiWrap, { minWidth: Math.round(size * 1.35), height: size }, style]}
    >
      <Text style={{ fontSize: size, lineHeight: size }}>{flag}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  england: {
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#B8BEC5',
    backgroundColor: '#FFFFFF',
  },
  horizontalCross: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#CE1124',
  },
  verticalCross: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#CE1124',
  },
  emojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
