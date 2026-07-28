import { StyleSheet, View } from 'react-native';
import { LeagueRow, Team } from '../domain/types';
import { fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';

interface Props {
  rows: LeagueRow[];
  teams: Record<string, Team>;
  highlightTeamId?: string;
}

export function LeagueTable({ rows, teams, highlightTeamId }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.pos, styles.headText]}>#</Text>
        <Text style={[styles.team, styles.headText]}>Team</Text>
        <Text style={[styles.num, styles.headText]}>P</Text>
        <Text style={[styles.num, styles.headText]}>W</Text>
        <Text style={[styles.num, styles.headText]}>L</Text>
        <Text style={[styles.num, styles.headText]}>T</Text>
        <Text style={[styles.num, styles.headText]}>NR</Text>
        <Text style={[styles.num, styles.headText]}>Pts</Text>
        <Text style={[styles.nrr, styles.headText]}>NRR</Text>
      </View>
      {rows.map((r, i) => {
        const active = r.teamId === highlightTeamId;
        return (
          <View key={r.teamId} style={[styles.row, active && styles.active]}>
            <Text style={[styles.pos, styles.cell]}>{i + 1}</Text>
            <Text style={[styles.team, styles.cell, active && styles.activeText]} numberOfLines={1}>
              {teams[r.teamId]?.shortName ?? r.teamId}
            </Text>
            <Text style={[styles.num, styles.cell]}>{r.played}</Text>
            <Text style={[styles.num, styles.cell]}>{r.won}</Text>
            <Text style={[styles.num, styles.cell]}>{r.lost}</Text>
            <Text style={[styles.num, styles.cell]}>{r.tied}</Text>
            <Text style={[styles.num, styles.cell]}>{r.noResult}</Text>
            <Text style={[styles.num, styles.cell, styles.pts]}>{r.points}</Text>
            <Text style={[styles.nrr, styles.cell]}>
              {r.netRunRate >= 0 ? '+' : ''}
              {r.netRunRate.toFixed(2)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    head: { borderBottomColor: colors.borderStrong },
    active: { backgroundColor: colors.surfaceAlt, borderRadius: 6 },
    headText: {
      color: colors.textFaint,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
    },
    cell: { color: colors.textMuted, fontSize: fontSize.sm },
    activeText: { color: colors.white, fontWeight: fontWeight.bold },
    pos: { width: 22, textAlign: 'center' },
    team: { flex: 1, paddingLeft: spacing.xs },
    num: { width: 26, textAlign: 'center' },
    nrr: { width: 52, textAlign: 'right' },
    pts: { color: colors.text, fontWeight: fontWeight.bold },
  });
