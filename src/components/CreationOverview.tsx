import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CAREER_GUIDES } from '../content/careerGuides';
import { fontSize, fontWeight, radius, spacing, useTheme } from '../theme';
import { AppText as Text } from './AppText';

export type CreationChapter = 'player.identity' | 'player.attributes' | 'player.club' |
  'player.review' | 'manager.creation';

/** One inline explanation per form page. Never measures, dims or locks its controls. */
export function CreationOverview({ chapter }: { chapter: CreationChapter }) {
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const guide = CAREER_GUIDES[chapter][0];
  return (
    <View testID="creation-overview" style={[styles.card, { backgroundColor: colors.surface,
      borderColor: colors.border, borderLeftColor: colors.accent }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${collapsed ? 'Show' : 'Hide'} guide: ${guide.title}`}
        accessibilityState={{ expanded: !collapsed }}
        onPress={() => setCollapsed(value => !value)}
        style={styles.heading}
      >
        <Text style={[styles.title, { color: colors.accent }]}>{guide.title}</Text>
        <Text style={[styles.toggle, { color: colors.textMuted }]}>{collapsed ? 'Show guide' : 'Hide'}</Text>
      </Pressable>
      {!collapsed ? <Text style={[styles.body, { color: colors.textMuted }]}>{guide.body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderLeftWidth: 3, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm, marginBottom: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  title: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, flex: 1 },
  toggle: { fontSize: fontSize.xs, flexShrink: 0 },
  body: { fontSize: fontSize.sm, lineHeight: 20 },
});
