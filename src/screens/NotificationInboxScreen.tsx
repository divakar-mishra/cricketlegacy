/**
 * NotificationInboxScreen — in-game activity inbox.
 *
 * Shows all InboxMessage entries sorted newest-first. Unread messages have
 * a coloured left border. Category filter tabs at the top. Swipe left
 * (long-press) to delete individual messages.
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, SlideOutLeft } from 'react-native-reanimated';
import { GlassAlert as Alert } from '../components/GlassAlertModal';
import { Screen, ScreenHeader } from '../components';
import { AppText as Text } from '../components/AppText';
import { InboxMessage, InboxMessageKind } from '../domain/types';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fonts,
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

const KIND_META: Record<
  InboxMessageKind,
  { accent: string; ionicon: keyof typeof Ionicons.glyphMap }
> = {
  CALLUP: { accent: '#4CAF50', ionicon: 'shield-checkmark' },
  CONTRACT_EXPIRY: { accent: '#E9B23B', ionicon: 'document-text' },
  AUCTION_OFFER: { accent: '#4C9AFF', ionicon: 'cash' },
  INJURY: { accent: '#E5484D', ionicon: 'medkit' },
  BOARD_OBJECTIVE: { accent: '#FF9800', ionicon: 'clipboard' },
  ACHIEVEMENT: { accent: '#E9B23B', ionicon: 'trophy' },
  RIVAL_OVERTOOK: { accent: '#E5484D', ionicon: 'flash' },
  HOF_ENTRY: { accent: '#B4E4FF', ionicon: 'star' },
  SEASON_AWARDS: { accent: '#E9B23B', ionicon: 'trophy' },
  GENERAL: { accent: '#90A4AE', ionicon: 'notifications' },
};

type FilterKind = 'all' | 'unread' | InboxMessageKind;
const FILTER_TABS: { key: FilterKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'ACHIEVEMENT', label: 'Achievements' },
  { key: 'CALLUP', label: 'Call-ups' },
  { key: 'CONTRACT_EXPIRY', label: 'Contracts' },
  { key: 'INJURY', label: 'Injuries' },
];

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationInboxScreen({ navigation }: ScreenProps<'NotificationInbox'>) {
  const save = useCareer((s) => s.save);
  const markInboxRead = useCareer((s) => s.markInboxRead);
  const clearInbox = useCareer((s) => s.clearInbox);
  const deleteInboxMessage = useCareer((s) => s.deleteInboxMessage);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKind>('all');

  const allMessages: InboxMessage[] = [...(save?.inbox ?? [])].sort(
    (a, b) => b.timestamp - a.timestamp,
  );
  const messages = allMessages.filter((m) => {
    if (dismissed.has(m.id)) return false;
    if (filter === 'all') return true;
    if (filter === 'unread') return !m.read;
    return m.kind === filter;
  });
  const unreadCount = allMessages.filter((m) => !m.read && !dismissed.has(m.id)).length;

  const onRead = useCallback(
    (msg: InboxMessage) => {
      if (!msg.read) markInboxRead(msg.id);
      if (msg.actionScreen) {
        navigation.navigate(msg.actionScreen as any);
      }
    },
    [markInboxRead, navigation],
  );

  const onDelete = useCallback(
    (id: string) => {
      setDismissed((prev) => new Set(prev).add(id));
      setTimeout(() => deleteInboxMessage(id), 350);
    },
    [deleteInboxMessage],
  );

  const onClearAll = () => {
    Alert.alert('Clear Inbox', 'Remove all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => clearInbox(),
      },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Inbox"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        onBack={() => navigation.goBack()}
        right={
          allMessages.length > 0 ? (
            <Pressable onPress={onClearAll} style={{ padding: spacing.xs }}>
              <Text
                style={{
                  color: colors.danger,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                }}
              >
                Clear all
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {tab.label}
                {tab.key === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
        {messages.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.empty}>
            <Ionicons
              name="mail-open-outline"
              size={56}
              color={colors.textFaint}
              style={{ marginBottom: spacing.md }}
            />
            <Text style={styles.emptyTitle}>
              {filter === 'unread' ? 'All caught up!' : 'Nothing here yet'}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'unread' ? 'No unread messages.' : 'No messages yet.'}
            </Text>
          </Animated.View>
        ) : (
          messages.map((msg, idx) => {
            const meta = KIND_META[msg.kind] ?? KIND_META.GENERAL;
            return (
              <Animated.View
                key={msg.id}
                entering={FadeInRight.duration(280).delay(Math.min(idx, 6) * 40)}
                exiting={SlideOutLeft.duration(300)}
              >
                <Pressable
                  onPress={() => onRead(msg)}
                  onLongPress={() => onDelete(msg.id)}
                  style={[
                    styles.msgCard,
                    { borderLeftColor: meta.accent },
                    !msg.read && styles.msgCardUnread,
                  ]}
                >
                  <View style={[styles.msgIconWrap, { backgroundColor: `${meta.accent}22` }]}>
                    <Ionicons name={meta.ionicon} size={22} color={meta.accent} />
                  </View>
                  <View style={styles.msgBody}>
                    <View style={styles.msgTitleRow}>
                      <Text
                        style={[styles.msgTitle, !msg.read && styles.msgTitleUnread]}
                        numberOfLines={1}
                      >
                        {msg.title}
                      </Text>
                      <Text style={styles.msgTime}>{timeAgo(msg.timestamp)}</Text>
                    </View>
                    <Text style={styles.msgText} numberOfLines={2}>
                      {msg.body}
                    </Text>
                    {msg.actionScreen && (
                      <View
                        style={[
                          styles.actionTag,
                          { backgroundColor: `${meta.accent}22`, borderColor: meta.accent },
                        ]}
                      >
                        <Text style={[styles.actionTagText, { color: meta.accent }]}>
                          Tap to view →
                        </Text>
                      </View>
                    )}
                  </View>
                  {!msg.read && (
                    <View style={[styles.unreadDot, { backgroundColor: meta.accent }]} />
                  )}
                </Pressable>
              </Animated.View>
            );
          })
        )}

        <Text style={styles.hint}>Long-press to delete.</Text>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: { flex: 1 },
    filterScroll: { flexGrow: 0, marginBottom: spacing.sm },
    filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.xs },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryDark,
    },
    filterChipText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.semibold,
    },
    filterChipTextActive: {
      color: colors.white,
    },
    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.xxl },
    emptyTitle: {
      color: colors.text,
      fontSize: fontSize.xl,
      fontWeight: fontWeight.heavy,
      fontFamily: fonts.display,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 20,
    },
    msgCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    msgCardUnread: { backgroundColor: colors.surfaceAlt },
    msgIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    msgIcon: { fontSize: 20 },
    msgBody: { flex: 1 },
    msgTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    msgTitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      flex: 1,
    },
    msgTitleUnread: { color: colors.text, fontWeight: fontWeight.bold },
    msgTime: { color: colors.textFaint, fontSize: fontSize.xs },
    msgText: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 3, lineHeight: 16 },
    actionTag: {
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    actionTagText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0, marginTop: 2 },
    hint: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.xl,
      marginBottom: spacing.xxl,
    },
  });
