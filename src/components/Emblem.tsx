import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { shadow, ThemeColors, useTheme, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';

/** The game's logo mark: a gold badge with a cricket motif. */
export function Emblem({ size = 120 }: { size?: number }) {
  const { gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const inner = size - 14;
  return (
    <LinearGradient
      colors={gradients.gold}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, shadow.card]}
    >
      <View style={[styles.inner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
        <Text style={{ fontSize: size * 0.4 }}>🏏</Text>
      </View>
    </LinearGradient>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    ring: { alignItems: 'center', justifyContent: 'center' },
    inner: {
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.accentDark,
    },
  });
