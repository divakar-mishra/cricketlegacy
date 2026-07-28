import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Text as SvgText } from 'react-native-svg';
import {
  AppText as Text,
  Button,
  Card,
  Icon,
  PlayerStatusBadges,
  Screen,
  ScreenHeader,
} from '../components';
import type { IconName } from '../components';
import { Player, Tactics } from '../domain/types';
import { BOWLER_PLAN_OPTIONS, FIELD_OPTIONS, TEAM_APPROACH_OPTIONS } from '../engine/intent';
import { formatClubCurrency } from '../game/finance';
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

const fmtMoney = formatClubCurrency;

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

  const team = save.teams[save.userTeamId];
  const tactics = save.tactics ?? DEFAULT_TACTICS;
  const squad = team.playerIds.map((id) => save.players[id]).filter(Boolean);
  const forceId = save.mode === 'career' ? save.userPlayerId : undefined;
  const xiIds = resolveXI(squad, team.xi, forceId).map((p) => p.id);
  const benchIds = team.playerIds.filter((id) => !xiIds.includes(id));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= xiIds.length) return;
    const next = [...xiIds];
    [next[i], next[j]] = [next[j], next[i]];
    setXI(next);
    setSelected(null);
  };

  const proposeSwap = (slot: number, benchId: string) => {
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
    if (!pendingSwap) return;
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
    if (selected == null) {
      setHint('Tap a player in your XI first, then a bench player to swap.');
      return;
    }
    proposeSwap(selected, benchId);
  };

  const swapBenchIntoSlot = (slot: number) => {
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
        title="Squad & Tactics"
        subtitle={team.name}
        onBack={() => navigation.goBack()}
      />

      <Card style={styles.finance}>
        <View>
          <Text style={styles.financeLabel}>Transfer budget</Text>
          <Text style={styles.financeValue}>{fmtMoney(team.budget)}</Text>
        </View>
        <Button
          label="Transfers"
          size="sm"
          fullWidth={false}
          onPress={() => navigation.navigate('Transfers')}
        />
      </Card>

      <Text style={styles.section}>Batting approach</Text>
      <View style={styles.chips}>
        {TEAM_APPROACH_OPTIONS.map((o) => {
          const sel = tactics.batting === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setTactics({ ...tactics, batting: o.value })}
              style={[styles.chip, sel && styles.chipActive]}
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
              onPress={() => setTactics({ ...tactics, bowling: o.value })}
              style={[styles.chip, sel && styles.chipActive]}
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
              onPress={() => setTactics({ ...tactics, field: o.value })}
              style={[styles.chip, sel && styles.chipActive]}
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
      <Text style={styles.hint}>
        Powerplays automatically use a legal two-outside field; your selected default takes over
        when the circle restriction allows it.
      </Text>

      {/* ── Field Diagram ──────────────────────────────────────────── */}
      <Text style={styles.section}>Batting Order Map</Text>
      <Card style={{ alignItems: 'center', paddingVertical: spacing.md }}>
        <FieldDiagram
          xi={xiIds.map((id) => save.players[id]).filter(Boolean) as Player[]}
          userPlayerId={save.userPlayerId}
          secondaryColor={team?.secondaryColor ?? '#E9B23B'}
        />
        <Text style={styles.hint}>
          Top order to tail · tap players in the list below to reorder
        </Text>
      </Card>

      <Text style={styles.section}>Playing XI &amp; batting order</Text>
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
          return (
            <Pressable
              key={id}
              onPress={() => swapBenchIntoSlot(i)}
              style={[styles.row, isSel && styles.rowSel]}
            >
              <Text style={styles.num}>{i + 1}</Text>
              <Text style={[styles.name, isUser && { color: colors.accent }]} numberOfLines={1}>
                {p.name}
              </Text>
              <PlayerStatusBadges
                captain={isUser && Boolean(save.captainClub)}
                injured={Boolean(p.injury)}
                fitness={save.managerCalendar ? p.condition : p.meta.fitness}
                mood={p.morale}
              />
              <Text style={styles.role}>{ROLE_ABBR[p.role] ?? p.role}</Text>
              <Text style={styles.ovr}>{p.overall}</Text>
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
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    if (selected != null) swapIn(id);
                    else {
                      setSelectedBenchId(isBenchSel ? null : id);
                      setHint(
                        isBenchSel ? null : 'Now tap any XI player to swap with this bench player.',
                      );
                    }
                  }}
                  style={[styles.row, isBenchSel && styles.rowSel]}
                >
                  <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <PlayerStatusBadges
                    injured={Boolean(p.injury)}
                    fitness={save.managerCalendar ? p.condition : p.meta.fitness}
                    mood={p.morale}
                  />
                  <Text style={styles.role}>{ROLE_ABBR[p.role] ?? p.role}</Text>
                  <Text style={styles.ovr}>{p.overall}</Text>
                  {selected != null || isBenchSel ? <Text style={styles.swapIn}>Swap</Text> : null}
                </Pressable>
              );
            })}
          </Card>
        </>
      ) : null}

      <Text style={styles.hint}>
        Tactics, XI and batting order save automatically for your next match.
      </Text>
    </Screen>
  );
}

// ── Morale pill (Feature 3) ──────────────────────────────────────────────────

// ── Field Diagram — top-down cricket oval ────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  BATTER: '#4C9AFF',
  BOWLER: '#E5484D',
  ALLROUNDER: '#E9B23B',
  WK_BATTER: '#31A85A',
};

/** Positions for 11 players around/on a cricket field (normalized 0..1). */
const FIELD_POSITIONS: { x: number; y: number }[] = [
  { x: 0.5, y: 0.62 }, // 1. opener at crease
  { x: 0.5, y: 0.38 }, // 2. non-striker
  { x: 0.5, y: 0.82 }, // 3. no.3
  { x: 0.28, y: 0.72 }, // 4. mid-wicket area
  { x: 0.72, y: 0.72 }, // 5. cover area
  { x: 0.22, y: 0.5 }, // 6. square leg
  { x: 0.78, y: 0.5 }, // 7. cover point
  { x: 0.35, y: 0.3 }, // 8. mid-on
  { x: 0.65, y: 0.3 }, // 9. mid-off
  { x: 0.2, y: 0.22 }, // 10. fine leg
  { x: 0.8, y: 0.22 }, // 11. third man
];

function FieldDiagram({
  xi,
  userPlayerId,
  secondaryColor,
}: {
  xi: Player[];
  userPlayerId?: string;
  secondaryColor: string;
}) {
  const W = 280;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;
  const rx = W * 0.46;
  const ry = H * 0.46;

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Outer oval — pitch */}
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#0D2B1A" opacity={0.9} />
      {/* Inner 30-yard circle */}
      <Ellipse
        cx={cx}
        cy={cy}
        rx={rx * 0.55}
        ry={ry * 0.55}
        fill="none"
        stroke="#1A4A2A"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      {/* Pitch strip */}
      <Ellipse cx={cx} cy={cy} rx={10} ry={ry * 0.35} fill="#3A2800" opacity={0.7} />
      {/* Crease lines */}
      <Line
        x1={cx - 10}
        y1={cy + ry * 0.2}
        x2={cx + 10}
        y2={cy + ry * 0.2}
        stroke="#E9B23B"
        strokeWidth={1.5}
        opacity={0.8}
      />
      <Line
        x1={cx - 10}
        y1={cy - ry * 0.2}
        x2={cx + 10}
        y2={cy - ry * 0.2}
        stroke="#E9B23B"
        strokeWidth={1.5}
        opacity={0.8}
      />

      {xi.slice(0, 11).map((p, i) => {
        const pos = FIELD_POSITIONS[i];
        const px = pos.x * W;
        const py = pos.y * H;
        const isUser = p.id === userPlayerId;
        const color = isUser ? secondaryColor : (ROLE_COLOR[p.role] ?? '#4C9AFF');
        return (
          <React.Fragment key={p.id}>
            <Circle cx={px} cy={py} r={isUser ? 13 : 11} fill={color} opacity={isUser ? 1 : 0.85} />
            {isUser && (
              <Circle
                cx={px}
                cy={py}
                r={15}
                fill="none"
                stroke={secondaryColor}
                strokeWidth={1.5}
              />
            )}
            <SvgText
              x={px}
              y={py + 1}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize={isUser ? 7 : 6}
              fontWeight="bold"
              fill="#fff"
            >
              {i + 1}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    msg: { color: colors.textMuted, fontSize: fontSize.md, marginBottom: spacing.lg },
    finance: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    financeLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    financeValue: { color: colors.accent, fontSize: fontSize.xl, fontWeight: fontWeight.black },
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
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
    name: { color: colors.text, fontSize: fontSize.sm, flex: 1, fontWeight: fontWeight.medium },
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
