import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native';
import { haptics } from '../audio';
import { fontWeight, radius, spacing, ThemeColors, useTheme, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { GlassSurface } from './GlassSurface';
import { GuideTarget } from './CareerGuide';

interface HubTab {
  key: string;
  /** Ionicons base name (the active state renders the filled variant). */
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
}

/** Persistent section navigation for career hubs and their ordinary detail screens. */
export function HubTabBar({ tabs }: { tabs: HubTab[] }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const gesture = useRef<{ x: number; y: number; handled: boolean } | null>(null);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.active),
  );

  const onTouchStart = (event: GestureResponderEvent) => {
    gesture.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, handled: false };
  };

  const activate = (tab: HubTab) => {
    haptics.selection();
    tab.onPress();
  };

  /** Returns true when this gesture has consumed the release (including vertical drags). */
  const finishGesture = (event: GestureResponderEvent): boolean => {
    const start = gesture.current;
    if (!start) return false;
    if (start.handled) return true;
    const delta = event.nativeEvent.pageX - start.x;
    const vertical = event.nativeEvent.pageY - start.y;
    if (Math.abs(delta) < 46 && Math.abs(vertical) < 46) return false;
    start.handled = true;
    if (Math.abs(delta) < 46 || Math.abs(delta) <= Math.abs(vertical)) return true;
    const nextIndex =
      delta < 0 ? Math.min(tabs.length - 1, activeIndex + 1) : Math.max(0, activeIndex - 1);
    if (nextIndex !== activeIndex && tabs[nextIndex]) activate(tabs[nextIndex]);
    return true;
  };

  return (
    <View
      onTouchStart={onTouchStart}
      onTouchEnd={finishGesture}
      onTouchCancel={() => {
        if (gesture.current) gesture.current.handled = true;
      }}
    >
      <GlassSurface intensity={0.78} rounded={radius.lg} padded={false} style={styles.bar}>
        <View style={styles.tabs}>
          {tabs.map((t) => {
            const name = (
              t.active ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)
            ) as keyof typeof Ionicons.glyphMap;
            return (
              <GuideTarget key={t.key} id={`tab-${t.key}`} style={{ flex: 1 }}><Pressable
                onPress={(event) => {
                  // Both release callback orders are possible. Resolve a real
                  // touch here too, so a swipe never also activates its origin.
                  if (
                    event?.nativeEvent &&
                    Number.isFinite(event.nativeEvent.pageX) &&
                    Number.isFinite(event.nativeEvent.pageY) &&
                    (event.nativeEvent.pageX !== 0 || event.nativeEvent.pageY !== 0)
                  ) {
                    if (finishGesture(event)) return;
                    if (gesture.current) gesture.current.handled = true;
                  }
                  activate(t);
                }}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: Boolean(t.active) }}
                accessibilityLabel={t.label}
              >
                {t.active ? <View style={styles.indicator} /> : null}
                <Ionicons name={name} size={22} color={t.active ? colors.text : colors.textMuted} />
                <Text style={[styles.label, t.active && styles.labelActive]} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable></GuideTarget>
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
    tab: {
      flex: 1,
      minWidth: 0,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
      gap: 2,
    },
    indicator: {
      position: 'absolute',
      top: -spacing.sm,
      width: 28,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    label: { color: colors.textMuted, fontSize: 10, fontWeight: fontWeight.semibold },
    labelActive: { color: colors.text },
  });
