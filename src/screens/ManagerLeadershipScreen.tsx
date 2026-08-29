import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, Button, Card, Icon, Screen, ScreenHeader } from '../components';
import { activeManagerClub } from '../game/managerClubState';
import {
  ensureManagerLeadership,
  leadershipReviewFlag,
  leadershipScore,
  ManagerLeadershipRole,
} from '../game/leadership';
import { ScreenProps } from '../navigation';
import { useCareer } from '../state/careerStore';
import {
  fontSize,
  fontWeight,
  radius,
  spacing,
  ThemeColors,
  useTheme,
  useThemedStyles,
} from '../theme';

const ROLE_LABEL: Record<string, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALLROUNDER: 'All-rounder',
  WK_BATTER: 'Wicketkeeper',
};

export function ManagerLeadershipScreen({ navigation }: ScreenProps<'ManagerLeadership'>) {
  const save = useCareer((state) => state.save);
  const appoint = useCareer((state) => state.appointManagerLeader);
  const [role, setRole] = useState<ManagerLeadershipRole>('CAPTAIN');
  const [message, setMessage] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!save || save.mode !== 'manager' || !save.userTeamId) {
    return (
      <Screen>
        <ScreenHeader title="Team Leadership" onBack={() => navigation.goBack()} />
        <Text style={styles.muted}>Available in Manager Career.</Text>
      </Screen>
    );
  }

  if (save.managerCareerLevel === 'NATIONAL') {
    return (
      <Screen>
        <ScreenHeader title="Team Leadership" onBack={() => navigation.goBack()} />
        <Card style={styles.unavailableCard}>
          <Icon name="flag-outline" size={24} color={colors.textMuted} />
          <Text style={styles.unavailableTitle}>National leadership is not configured</Text>
        </Card>
      </Screen>
    );
  }

  ensureManagerLeadership(save);
  const team = save.teams[save.userTeamId];
  const club = activeManagerClub(save);
  if (!team || !club) {
    return (
      <Screen>
        <ScreenHeader title="Team Leadership" onBack={() => navigation.goBack()} />
        <Card style={styles.unavailableCard}>
          <Icon name="alert-circle-outline" size={24} color={colors.warning} />
          <Text style={styles.unavailableTitle}>Leadership data is unavailable</Text>
          <Button
            label="Return to Manager Home"
            variant="secondary"
            style={{ marginTop: spacing.md }}
            onPress={() => navigation.replace('ManagerHub')}
          />
        </Card>
      </Screen>
    );
  }
  const captain = club.captainId ? save.players[club.captainId] : undefined;
  const vice = club.viceCaptainId ? save.players[club.viceCaptainId] : undefined;
  const reviewRequired = Boolean(save.flags?.[leadershipReviewFlag(team.id)]);
  const candidates = team.playerIds
    .map((id) => save.players[id])
    .filter(Boolean)
    .sort((left, right) => leadershipScore(right) - leadershipScore(left));

  const select = (playerId: string) => {
    const result = appoint(role, playerId);
    setMessage(
      result.ok
        ? `${role === 'CAPTAIN' ? 'Captain' : 'Vice-captain'} appointed.`
        : (result.reason ?? 'Unavailable.'),
    );
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title="Team Leadership"
        subtitle={team.name}
        onBack={() => navigation.goBack()}
      />

      {reviewRequired ? (
        <Card style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <Icon name="clipboard-outline" size={22} color={colors.accent} />
            <View style={styles.reviewCopy}>
              <Text style={styles.reviewTitle}>Review initial appointments</Text>
            </View>
          </View>
          {captain ? (
            <Button
              label="Keep appointments"
              size="sm"
              variant="secondary"
              onPress={() => appoint('CAPTAIN', captain.id)}
            />
          ) : null}
        </Card>
      ) : null}

      <View style={styles.appointmentGrid}>
        <Card style={styles.appointmentCard}>
          <Text style={styles.kicker}>CAPTAIN</Text>
          <Text style={styles.appointmentName} numberOfLines={1}>
            {captain?.name ?? 'Not appointed'}
          </Text>
          <Text style={styles.appointmentMeta}>
            {captain ? `Leadership ${leadershipScore(captain)}` : 'Choose below'}
          </Text>
        </Card>
        <Card style={styles.appointmentCard}>
          <Text style={styles.kicker}>VICE-CAPTAIN</Text>
          <Text style={styles.appointmentName} numberOfLines={1}>
            {vice?.name ?? 'Not appointed'}
          </Text>
          <Text style={styles.appointmentMeta}>
            {vice ? `Leadership ${leadershipScore(vice)}` : 'Choose below'}
          </Text>
        </Card>
      </View>

      <View style={styles.roleTabs}>
        {(['CAPTAIN', 'VICE_CAPTAIN'] as ManagerLeadershipRole[]).map((option) => {
          const selected = role === option;
          return (
            <Pressable
              key={option}
              onPress={() => setRole(option)}
              style={[styles.roleTab, selected && styles.roleTabSelected]}
            >
              <Text style={[styles.roleTabText, selected && styles.roleTabTextSelected]}>
                {option === 'CAPTAIN' ? 'Choose captain' : 'Choose vice-captain'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <Card padded={false}>
        {candidates.map((player, index) => {
          const score = leadershipScore(player);
          const selected =
            role === 'CAPTAIN' ? club.captainId === player.id : club.viceCaptainId === player.id;
          const otherRole =
            role === 'CAPTAIN' ? club.viceCaptainId === player.id : club.captainId === player.id;
          return (
            <View key={player.id} style={[styles.playerRow, index > 0 && styles.divider]}>
              <View style={styles.scoreBadge}>
                <Text style={styles.score}>{score}</Text>
                <Text style={styles.scoreLabel}>LEAD</Text>
              </View>
              <View style={styles.playerCopy}>
                <View style={styles.nameLine}>
                  <Text style={styles.playerName} numberOfLines={1}>
                    {player.name}
                  </Text>
                  {club.captainId === player.id ? <Text style={styles.roleBadge}>C</Text> : null}
                  {club.viceCaptainId === player.id ? (
                    <Text style={styles.roleBadge}>VC</Text>
                  ) : null}
                </View>
                <Text style={styles.playerMeta}>
                  {ROLE_LABEL[player.role] ?? player.role} · Age {player.age} · OVR {player.overall}
                </Text>
              </View>
              <Button
                label={selected ? 'Selected' : otherRole ? 'Swap role' : 'Appoint'}
                size="sm"
                variant={selected ? 'ghost' : 'secondary'}
                fullWidth={false}
                disabled={selected}
                onPress={() => select(player.id)}
                style={styles.appointButton}
              />
            </View>
          );
        })}
      </Card>

    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    muted: { color: colors.textMuted, fontSize: fontSize.md },
    unavailableCard: { marginTop: spacing.md, gap: spacing.sm },
    unavailableTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    reviewCard: { marginTop: spacing.md, borderColor: colors.accent + '77' },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    reviewCopy: { flex: 1, minWidth: 0 },
    reviewTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.heavy },
    reviewText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18, marginTop: 3 },
    appointmentGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    appointmentCard: { flex: 1, minWidth: 0, padding: spacing.md },
    kicker: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      letterSpacing: 1,
    },
    appointmentName: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
      marginTop: spacing.sm,
    },
    appointmentMeta: { color: colors.primaryLight, fontSize: fontSize.xs, marginTop: 3 },
    roleTabs: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.lg },
    roleTab: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    roleTabSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
    roleTabText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
    roleTabTextSelected: { color: colors.primaryLight },
    message: {
      color: colors.success,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      marginBottom: spacing.sm,
    },
    playerRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    scoreBadge: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    score: { color: colors.accent, fontSize: fontSize.md, fontWeight: fontWeight.black },
    scoreLabel: { color: colors.textFaint, fontSize: 8, letterSpacing: 0.8 },
    playerCopy: { flex: 1, minWidth: 0 },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    playerName: {
      flexShrink: 1,
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.semibold,
    },
    playerMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
    roleBadge: {
      color: colors.bg,
      backgroundColor: colors.accent,
      fontSize: 9,
      fontWeight: fontWeight.black,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    appointButton: { width: 88 },
    footerNote: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      lineHeight: 17,
      textAlign: 'center',
      marginVertical: spacing.xl,
      paddingHorizontal: spacing.md,
    },
  });
