import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText as Text, Card, Icon, Screen, ScreenHeader } from '../components';
import {
  GuidanceTopicId,
  HANDBOOK_CATEGORIES,
  HandbookCategoryId,
  searchGuidanceTopics,
} from '../guidance/mechanics';
import { ScreenProps } from '../navigation';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useThemedStyles,
} from '../theme';

export function CricketAcademyScreen({ navigation }: ScreenProps<'CricketAcademy'>) {
  const styles = useThemedStyles(makeStyles);
  const [category, setCategory] = useState<HandbookCategoryId>('career');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<GuidanceTopicId | null>(null);
  const topics = useMemo(
    () => searchGuidanceTopics(query, query.trim() ? undefined : category),
    [category, query],
  );

  return (
    <Screen scroll>
      <ScreenHeader
        title="Cricket Academy"
        subtitle="Handbook"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.search}>
        <Icon name="search" size={19} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search rules and mechanics"
          placeholderTextColor={styles.placeholder.color}
          accessibilityLabel="Search the Cricket Academy"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear handbook search"
            style={styles.clear}
          >
            <Icon name="close-circle" size={19} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {HANDBOOK_CATEGORIES.map((item) => {
          const active = !query.trim() && category === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => {
                setQuery('');
                setCategory(item.id);
                setExpanded(null);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                pressed && styles.pressed,
              ]}
            >
              <Icon name={item.icon} size={17} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.resultLabel}>
        {query.trim()
          ? `${topics.length} SEARCH RESULT${topics.length === 1 ? '' : 'S'}`
          : 'TOPICS'}
      </Text>

      <View style={styles.topicList}>
        {topics.map((topic, index) => {
          const isExpanded = expanded === topic.id;
          return (
            <Animated.View key={topic.id} entering={FadeInDown.duration(180).delay(index * 24)}>
              <Card
                onPress={() => setExpanded(isExpanded ? null : topic.id)}
                accessibilityLabel={`${topic.title}. ${isExpanded ? 'Collapse' : 'Expand'} details`}
              >
                <View style={styles.topicHeader}>
                  <View style={styles.topicCopy}>
                    <Text style={styles.topicTitle}>{topic.title}</Text>
                    <Text style={styles.topicSummary}>{topic.summary}</Text>
                  </View>
                  <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={19} />
                </View>
                {isExpanded ? (
                  <View style={styles.details}>
                    {topic.bullets.map((bullet) => (
                      <View key={bullet} style={styles.bulletRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            </Animated.View>
          );
        })}
      </View>

      {!topics.length ? (
        <View style={styles.empty}>
          <Icon name="search-outline" size={24} />
          <Text style={styles.emptyTitle}>No matching rule</Text>
          <Text style={styles.emptyBody}>
            Try a shorter term such as selection, scout or stamina.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    search: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    input: {
      flex: 1,
      minWidth: 0,
      color: colors.text,
      fontSize: fontSize.md,
      fontFamily: fonts.medium,
      paddingVertical: spacing.sm,
    },
    placeholder: { color: colors.textFaint },
    clear: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabs: {
      flexDirection: 'row',
      minHeight: 50,
      marginTop: spacing.md,
      padding: 3,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 2,
      borderRadius: radius.sm,
    },
    tabActive: { backgroundColor: colors.surfaceAlt },
    tabLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    tabLabelActive: { color: colors.text, fontWeight: fontWeight.bold },
    resultLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    topicList: { gap: spacing.sm },
    topicHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    topicCopy: { flex: 1, minWidth: 0 },
    topicTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    topicSummary: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 18,
      marginTop: 3,
    },
    details: {
      gap: spacing.sm,
      paddingTop: spacing.md,
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    bullet: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primaryLight,
      marginTop: 7,
      flexShrink: 0,
    },
    bulletText: {
      flex: 1,
      minWidth: 0,
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.bold,
      marginTop: spacing.sm,
    },
    emptyBody: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 4,
    },
    pressed: { opacity: 0.65 },
  });
