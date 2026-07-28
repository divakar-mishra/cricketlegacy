import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CommentaryArchiveView,
  commentaryEntriesForView,
  CommentaryEntry,
  CommentaryTone,
} from '../game/commentaryArchive';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';
import { AppText as Text } from './AppText';
import { Icon } from './Icon';

export type { CommentaryEntry, CommentaryTone } from '../game/commentaryArchive';

interface Props {
  visible: boolean;
  entries: CommentaryEntry[];
  currentInningsIndex: number;
  toneColors: Record<CommentaryTone, string>;
  onClose: () => void;
}

const outcomeLabel = (entry: CommentaryEntry): string => {
  if (entry.tone === 'wicket') return 'WICKET';
  if (entry.outcome === 'DOT') return 'DOT';
  if (entry.outcome === 'WD') return 'WIDE';
  if (entry.outcome === 'NB') return 'NO BALL';
  if (entry.outcome === 'BYE') return 'BYE';
  if (entry.outcome === 'LB') return 'LEG BYE';
  return entry.outcome;
};

export function CommentaryArchive({
  visible,
  entries,
  currentInningsIndex,
  toneColors,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [view, setView] = useState<CommentaryArchiveView>('current');

  const inningsEntries = useMemo(
    () => entries.filter((entry) => entry.inningsIndex === currentInningsIndex),
    [currentInningsIndex, entries],
  );
  const currentOver = inningsEntries.reduce((max, entry) => Math.max(max, entry.over), -1);
  const previousOver = inningsEntries.reduce(
    (max, entry) => (entry.over < currentOver ? Math.max(max, entry.over) : max),
    -1,
  );
  const filtered = useMemo(() => {
    return commentaryEntriesForView(entries, currentInningsIndex, view);
  }, [currentInningsIndex, entries, view]);
  const latest = inningsEntries[0];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>MATCH CENTRE</Text>
            <Text style={styles.title}>Ball-by-ball</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close ball-by-ball commentary"
            hitSlop={12}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} />
          </Pressable>
        </View>

        {latest ? (
          <Animated.View entering={FadeIn.duration(220)} style={styles.lastBall}>
            <View style={styles.lastBallTop}>
              <Text style={styles.lastBallLabel}>LAST BALL</Text>
              <Text style={styles.lastBallNumber}>{latest.label}</Text>
            </View>
            <Text style={styles.matchup} numberOfLines={1}>
              {latest.bowlerName} to {latest.strikerName}
            </Text>
            <Text style={[styles.lastBallText, { color: toneColors[latest.tone] }]}>
              {latest.text}
            </Text>
          </Animated.View>
        ) : null}

        <View style={styles.tabs} accessibilityRole="tablist">
          {(
            [
              ['current', 'This over'],
              ['previous', 'Previous'],
              ['innings', 'Innings'],
            ] as const
          ).map(([value, label]) => {
            const selected = view === value;
            const disabled = value === 'previous' && previousOver < 0;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => setView(value)}
                style={[styles.tab, selected && styles.tabActive, disabled && styles.tabDisabled]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          style={styles.list}
          contentContainerStyle={filtered.length ? styles.listContent : styles.emptyContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={16}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="radio-outline" size={28} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptyText}>This view will fill as the innings develops.</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.duration(180).delay(Math.min(index * 20, 180))}>
              <View style={styles.row}>
                <View style={styles.ballColumn}>
                  <Text style={styles.ballNumber}>{item.label}</Text>
                  <View style={[styles.outcome, { borderColor: toneColors[item.tone] }]}>
                    <Text style={[styles.outcomeText, { color: toneColors[item.tone] }]}>
                      {outcomeLabel(item)}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowMatchup} numberOfLines={1}>
                    {item.bowlerName} to {item.strikerName}
                  </Text>
                  <Text style={styles.rowText}>{item.text}</Text>
                </View>
              </View>
            </Animated.View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      minHeight: 72,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    eyebrow: {
      color: colors.primaryLight,
      fontSize: 10,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
    },
    title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.black },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
    },
    lastBall: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 2,
      borderTopColor: colors.accent,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastBallTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    lastBallLabel: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.black,
      letterSpacing: 0,
    },
    lastBallNumber: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    matchup: { marginTop: spacing.xs, color: colors.textMuted, fontSize: fontSize.sm },
    lastBallText: {
      marginTop: spacing.sm,
      fontSize: fontSize.lg,
      lineHeight: 25,
      fontWeight: fontWeight.bold,
    },
    tabs: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: colors.transparent,
    },
    tabActive: { borderBottomColor: colors.primary },
    tabDisabled: { opacity: 0.35 },
    tabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    tabTextActive: { color: colors.text, fontWeight: fontWeight.black },
    list: { flex: 1, marginTop: spacing.sm },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    emptyContent: { flexGrow: 1 },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    ballColumn: { width: 58, alignItems: 'flex-start', gap: 5 },
    ballNumber: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.black },
    outcome: {
      minHeight: 20,
      maxWidth: 58,
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outcomeText: { fontSize: 8, fontWeight: fontWeight.black, letterSpacing: 0 },
    rowBody: { flex: 1, minWidth: 0 },
    rowMatchup: { color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 },
    rowText: { color: colors.text, fontSize: fontSize.sm, lineHeight: 19 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyTitle: {
      marginTop: spacing.md,
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
    },
    emptyText: {
      marginTop: spacing.xs,
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
    },
  });
