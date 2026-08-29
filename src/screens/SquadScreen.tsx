import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  AppText as Text,
  Button,
  Card,
  Icon,
  MechanicInfoButton,
  PlayerStatusBadges,
  Screen,
  ScreenHeader,
} from '../components';
import type { IconName } from '../components';
import { Tactics } from '../domain/types';
import { BOWLER_PLAN_OPTIONS, FIELD_OPTIONS, TEAM_APPROACH_OPTIONS } from '../engine/intent';
import { activeManagerClub } from '../game/managerClubState';
import { managerControlledTeamId } from '../game/managerCalendar';
import { matchDecisionAuthority } from '../game/matchAuthority';
import { nextUserFixtureId } from '../game/season';
import { careerPlayingTeamId } from '../game/youthFixtures';
import { resolveXI, validateXI } from '../game/squad';
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

const ROLE_ABBR: Record<string, string> = {
  BATTER: 'BAT',
  BOWLER: 'BOWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};
const DEFAULT_TACTICS: Tactics = { batting: 'BALANCED', bowling: 'CONTAIN' };
const BOWLER_ICONS: Record<string, IconName> = {
  ATTACK: 'flash',
  CONTAIN: 'shield-half',
  VARY: 'shuffle',
};
const FIELD_ICONS: Record<string, IconName> = {
  CATCHING: 'locate',
  ATTACKING: 'aperture',
  BALANCED: 'options',
  DEFENSIVE: 'shield-checkmark',
  SWEEPER: 'scan',
};

export function SquadScreen({ navigation }: ScreenProps<'Squad'>) {
  const save = useCareer((s) => s.save);
  const setXI = useCareer((s) => s.setXI);
  const setTactics = useCareer((s) => s.setTactics);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedBenchId, setSelectedBenchId] = useState<string | null>(null);
  const [pendingSwap, setPendingSwap] = useState<{
    slot: number;
    outId: string;
    inId: string;
    nextXi: string[];
  } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  if (!save || !save.userTeamId) {
    return (
      <Screen>
        <ScreenHeader title="Squad & Tactics" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active team.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const nextFixtureId = nextUserFixtureId(save);
  const nextFixture = nextFixtureId ? save.fixtures[nextFixtureId] : undefined;
  const authority = matchDecisionAuthority(save, nextFixture);
  const canEdit = authority.canControlTeam;
  const controlledTeamId =
    save.mode === 'manager'
      ? managerControlledTeamId(save)
      : careerPlayingTeamId(save, nextFixtureId);
  const team = controlledTeamId ? save.teams[controlledTeamId] : undefined;
  if (!team) {
    return (
      <Screen>
        <ScreenHeader title="Squad & Tactics" onBack={() => navigation.goBack()} />
        <Text style={styles.msg}>No active squad for this calendar phase.</Text>
        <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }
  const tactics = save.tactics ?? DEFAULT_TACTICS;
  const leadershipClub =
    save.mode === 'manager' && save.managerCareerLevel !== 'NATIONAL' && team.id === save.userTeamId
      ? activeManagerClub(save)
      : undefined;
  const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean);
  const forceId = save.mode === 'career' && canEdit ? save.userPlayerId : undefined;
  const xiIds = resolveXI(squad, team.xi, forceId).map((p) => p.id);
  const benchIds = team.playerIds.filter((id) => !xiIds.includes(id));

  const move = (i: number, dir: -1 | 1) => {
    if (!canEdit) return;
    const j = i + dir;
    if (j < 0 || j >= xiIds.length) return;
    const next = [...xiIds];
    [next[i], next[j]] = [next[j], next[i]];
    setXI(next);
    setSelected(null);
  };

  const proposeSwap = (slot: number, benchId: string) => {
    if (!canEdit) return;
    if (xiIds[slot] === save.userPlayerId) {
      setHint('You cannot drop yourself from the XI.');
      return;
    }
    const next = [...xiIds];
    next[slot] = benchId;
    const valid = validateXI(squad, next, forceId);
    if (!valid.ok) {
      setHint(valid.reason ?? 'That swap is not valid for this XI.');
      return;
    }
    setPendingSwap({ slot, outId: xiIds[slot], inId: benchId, nextXi: next });
    setHint(null);
  };

  const confirmSwap = () => {
    if (!pendingSwap || !canEdit) return;
    setXI(pendingSwap.nextXi);
    setSelected(null);
    setSelectedBenchId(null);
    setPendingSwap(null);
    setHint(null);
  };

  const cancelSwap = () => {
    setPendingSwap(null);
  };

  const swapIn = (benchId: string) => {
    if (!canEdit) return;
    if (selected == null) {
      setHint('Tap an XI player, then a bench player.');
      return;
    }
    proposeSwap(selected, benchId);
  };

  const swapBenchIntoSlot = (slot: number) => {
    if (!canEdit) return;
    if (!selectedBenchId) {
      setSelected((cur) => (cur === slot ? null : slot));
      setHint(null);
      return;
    }
    proposeSwap(slot, selectedBenchId);
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title={save.mode === 'manager' ? 'Squad & Tactics' : 'Team & Selection'}
        subtitle={team.name}
        onBack={() => navigation.goBack()}
      />

      {save.mode === 'manager' ? (
        save.managerCareerLevel !== 'NATIONAL' ? (
          <Card style={styles.leadershipEntry}>
            <View style={styles.leadershipCopy}>
              <Text style={styles.leadershipTitle}>Captain & vice-captain</Text>
              <Text style={styles.leadershipMeta}>Set the leaders for your selected XI.</Text>
            </View>
            <Button
              label="Leadership"
              size="sm"
              variant="secondary"
              fullWidth={false}
              style={styles.managerAction}
              onPress={() => navigation.navigate('ManagerLeadership')}
            />
          </Card>
        ) : null
      ) : (
        <View style={[styles.authorityBand, canEdit && styles.authorityBandActive]}>
          <Icon
            name={canEdit ? 'shield-checkmark' : 'shirt-outline'}
            size={18}
            color={canEdit ? colors.accent : colors.textMuted}
          />
          <View style={styles.authorityCopy}>
            <Text style={[styles.authorityTitle, canEdit && { color: colors.accent }]}>
              {authority.title}
            </Text>
            <Text style={styles.authorityDetail}>{authority.detail}</Text>
          </View>
        </View>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionInline}>Batting approach</Text>
        <MechanicInfoButton topicId="tactical-modifiers" />
      </View>
      <View style={styles.chips}>
        {TEAM_APPROACH_OPTIONS.map((o) => {
          const sel = tactics.batting === o.value;
          return (
            <Pressable
              key={o.value}
              disabled={!canEdit}
              accessibilityState={{ selected: sel, disabled: !canEdit }}
              onPress={() => setTactics({ ...tactics, batting: o.value })}
              style={[styles.chip, sel && styles.chipActive, !canEdit && styles.chipDisabled]}
            >
              <Text style={[styles.chipText, sel && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Bowling plan</Text>
      <View style={styles.chips}>
        {BOWLER_PLAN_OPTIONS.map((o) => {
          const sel = tactics.bowling === o.value;
          return (
            <Pressable
              key={o.value}
              disabled={!canEdit}
              accessibilityState={{ selected: sel, disabled: !canEdit }}
              onPress={() => setTactics({ ...tactics, bowling: o.value })}
              style={[styles.chip, sel && styles.chipActive, !canEdit && styles.chipDisabled]}
            >
              <Icon
                name={BOWLER_ICONS[o.value] ?? 'ellipse'}
                size={15}
                color={sel ? colors.white : colors.textMuted}
              />
              <Text style={[styles.chipText, sel && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Field setting</Text>
      <View style={styles.chips}>
        {FIELD_OPTIONS.map((o) => {
          const sel = (tactics.field ?? 'BALANCED') === o.value;
          return (
            <Pressable
              key={o.value}
              disabled={!canEdit}
              accessibilityState={{ selected: sel, disabled: !canEdit }}
              onPress={() => setTactics({ ...tactics, field: o.value })}
              style={[styles.chip, sel && styles.chipActive, !canEdit && styles.chipDisabled]}
            >
              <Icon
                name={FIELD_ICONS[o.value] ?? 'ellipse'}
                size={15}
                color={sel ? colors.white : colors.textMuted}
              />
              <Text style={[styles.chipText, sel && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {FIELD_OPTIONS.find((o) => o.value === (tactics.field ?? 'BALANCED'))?.desc}
      </Text>
      <Text style={styles.hint}>Powerplay · max 2 outside</Text>

      {/* ── Field Diagram ──────────────────────────────────────────── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionInline}>Playing XI &amp; batting order</Text>
        {save.managerCalendar?.phase === 'FIRST_CLASS' ? (
          <MechanicInfoButton topicId="first-class-over-rate" />
        ) : save.mode === 'manager' ? (
          <MechanicInfoButton topicId="condition-and-morale" />
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {pendingSwap ? (
        <Card style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Confirm swap</Text>
          <Text style={styles.confirmText}>
            {save.players[pendingSwap.inId]?.name ?? 'Bench player'} replaces{' '}
            {save.players[pendingSwap.outId]?.name ?? 'XI player'} at position{' '}
            {pendingSwap.slot + 1}.
          </Text>
          <View style={styles.confirmActions}>
            <Button label="Confirm" size="sm" fullWidth={false} onPress={confirmSwap} />
            <Button
              label="Cancel"
              size="sm"
              variant="ghost"
              fullWidth={false}
              onPress={cancelSwap}
            />
          </View>
        </Card>
      ) : null}
      <Card>
        {xiIds.map((id, i) => {
          const p = save.players[id];
          if (!p) return null;
          const isSel = selected === i;
          const isUser = id === save.userPlayerId;
          const isCaptain = leadershipClub?.captainId === id;
          const isViceCaptain = leadershipClub?.viceCaptainId === id;
          return (
            <Pressable
              key={id}
              disabled={!canEdit}
              accessibilityState={{ selected: isSel, disabled: !canEdit }}
              onPress={() => swapBenchIntoSlot(i)}
              style={[styles.row, isSel && styles.rowSel]}
            >
              <Text style={styles.num}>{i + 1}</Text>
              <View style={styles.nameCell}>
                <Text style={[styles.name, isUser && { color: colors.accent }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {isCaptain ? <Text style={styles.leaderBadge}>C</Text> : null}
                {isViceCaptain ? <Text style={styles.leaderBadge}>VC</Text> : null}
              </View>
              <PlayerStatusBadges
                captain={save.mode !== 'manager' && isUser && canEdit}
                injured={Boolean(p.injury)}
                fitness={save.managerCalendar ? p.condition : p.meta.fitness}
                mood={p.morale}
              />
              <Text style={styles.role}>{ROLE_ABBR[p.role] ?? p.role}</Text>
              <Text style={styles.ovr}>{p.overall}</Text>
              {canEdit ? (
                <View style={styles.moveBtns}>
                  <Pressable
                    onPress={() => move(i, -1)}
                    style={[styles.moveBtn, i === 0 && styles.moveDisabled]}
                    disabled={i === 0}
                  >
                    <Icon name="chevron-up" size={16} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => move(i, 1)}
                    style={[styles.moveBtn, i === xiIds.length - 1 && styles.moveDisabled]}
                    disabled={i === xiIds.length - 1}
                  >
                    <Icon name="chevron-down" size={16} color={colors.text} />
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Card>

      {benchIds.length ? (
        <>
          <Text style={styles.section}>Bench {selected != null ? '· tap to swap in' : ''}</Text>
          <Card>
            {benchIds.map((id) => {
              const p = save.players[id];
              if (!p) return null;
              const isBenchSel = selectedBenchId === id;
              const isCaptain = leadershipClub?.captainId === id;
              const isViceCaptain = leadershipClub?.viceCaptainId === id;
              return (
                <Pressable
                  key={id}
                  disabled={!canEdit}
                  accessibilityState={{ selected: isBenchSel, disabled: !canEdit }}
                  onPress={() => {
                    if (selected != null) swapIn(id);
                    else {
                      setSelectedBenchId(isBenchSel ? null : id);
                      setHint(isBenchSel ? null : 'Now tap an XI player to swap.');
                    }
                  }}
                  style={[styles.row, isBenchSel && styles.rowSel]}
                >
                  <View style={styles.nameCell}>
                    <Text style={styles.name} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {isCaptain ? <Text style={styles.leaderBadge}>C</Text> : null}
                    {isViceCaptain ? <Text style={styles.leaderBadge}>VC</Text> : null}
                  </View>
                  <PlayerStatusBadges
                    injured={Boolean(p.injury)}
                    fitness={save.managerCalendar ? p.condition : p.meta.fitness}
                    mood={p.morale}
                  />
                  <Text style={styles.role}>{ROLE_ABBR[p.role] ?? p.role}</Text>
                  <Text style={styles.ovr}>{p.overall}</Text>
                  {canEdit && (selected != null || isBenchSel) ? (
                    <Text style={styles.swapIn}>Swap</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : null}

      <Text style={styles.hint}>
        {canEdit ? 'Saved automatically' : 'Captain-selected XI'}
      </Text>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    leadershipEntry: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    leadershipCopy: { flex: 1, minWidth: 0 },
    leadershipTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: fontWeight.heavy,
    },
    leadershipMeta: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    managerAction: { minWidth: 112 },
    authorityBand: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceMuted,
    },
    authorityBandActive: {
      borderColor: colors.accent + '66',
      backgroundColor: colors.accent + '0D',
    },
    authorityCopy: { flex: 1, minWidth: 0 },
    authorityTitle: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
    },
    authorityDetail: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      lineHeight: 16,
      marginTop: 2,
    },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    sectionRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    sectionInline: {
      flex: 1,
      minWidth: 0,
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
    chipDisabled: { opacity: 0.62 },
    chipText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    chipTextActive: { color: colors.white },
    hint: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.sm, lineHeight: 16 },
    confirmCard: {
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    confirmTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    confirmText: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4, lineHeight: 18 },
    confirmActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing.sm,
      borderRadius: radius.sm,
    },
    rowSel: { backgroundColor: colors.surfaceAlt },
    num: { color: colors.textFaint, fontSize: fontSize.sm, width: 20 },
    nameCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: { color: colors.text, fontSize: fontSize.sm, flex: 1, fontWeight: fontWeight.medium },
    leaderBadge: {
      color: colors.bg,
      backgroundColor: colors.accent,
      fontSize: 9,
      fontWeight: fontWeight.black,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    role: { color: colors.textMuted, fontSize: fontSize.xs, width: 40, textAlign: 'right' },
    ovr: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      width: 28,
      textAlign: 'right',
    },
    swapIn: {
      color: colors.primaryLight,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      width: 56,
      textAlign: 'right',
    },
    moveBtns: { flexDirection: 'row', gap: 4 },
    moveBtn: {
      width: 30,
      height: 30,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moveDisabled: { opacity: 0.35 },
  });
