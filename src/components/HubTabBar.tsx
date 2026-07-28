import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import { haptics } from '../audio';
import { fontWeight, radius, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { GlassSurface } from './GlassSurface';

export interface HubTab {
  key: string;
  /** Ionicons base name (the active state renders the filled variant). */
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}

/** A persistent bottom navigation bar for the career/manager hubs. */
export function HubTabBar({ tabs }: { tabs: HubTab[] }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const swipeStartX = useRef<number | null>(null);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.active),
  );

  const onTouchStart = (event: GestureResponderEvent) => {
    swipeStartX.current = event.nativeEvent.pageX;
  };

  const onTouchEnd = (event: GestureResponderEvent) => {
    if (swipeStartX.current == null) return;
    const delta = event.nativeEvent.pageX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 46) return;
    const nextIndex =
      delta < 0 ? Math.min(tabs.length - 1, activeIndex + 1) : Math.max(0, activeIndex - 1);
    if (nextIndex === activeIndex) return;
    haptics.selection();
    tabs[nextIndex]?.onPress();
  };

  return (
    <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <GlassSurface intensity={0.78} rounded={radius.lg} padded={false} style={styles.bar}>
        <View style={styles.tabs}>
          {tabs.map((t) => {
            const name = (
              t.active ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)
            ) as keyof typeof Ionicons.glyphMap;
            return (
              <Pressable
                key={t.key}
                onPress={() => {
                  haptics.selection();
                  t.onPress();
                }}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: Boolean(t.active) }}
                accessibilityLabel={t.label}
              >
                {t.active ? <View style={styles.indicator} /> : null}
                <Ionicons
                  name={name}
                  size={22}
                  color={t.active ? colors.accent : colors.textFaint}
                />
                <Text style={[styles.label, t.active && styles.labelActive]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bar: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
    },
    tabs: {
      flexDirection: 'row',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 2, gap: 2 },
    indicator: {
      position: 'absolute',
      top: -spacing.sm,
      width: 28,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    label: { color: colors.textFaint, fontSize: 10, fontWeight: fontWeight.semibold },
    labelActive: { color: colors.accent },
  });
