import { StyleSheet, View } from 'react-native';
import { SaveGame } from '../domain/types';
import { CUP_NAME, cupChampionId, userCupStatus, userCupTieInfo } from '../game/cup';
import { fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

interface Props {
  save: SaveGame;
  canPlay: boolean;
  onPlay: () => void;
}

/** Domestic-cup status card for the hubs. Renders nothing when there's no cup. */
export function CupCard({ save, canPlay, onPlay }: Props) {
  const styles = useThemedStyles(makeStyles);
  const status = userCupStatus(save);
  if (status === 'NONE') return null;

  const tie = userCupTieInfo(save);
  const champId = cupChampionId(save);
  const teamName = (id?: string) => (id ? (save.teams[id]?.name ?? 'Team pending') : '');

  return (
    <>
      <Text style={styles.section}>{CUP_NAME}</Text>
      <Card>
        {status === 'PLAYING' && tie ? (
          <>
            <Text style={styles.round}>{tie.round}</Text>
            <View style={styles.fixtureRow}>
              <Text style={styles.team} numberOfLines={2}>
                {teamName(save.userTeamId)}
              </Text>
              <Text style={styles.vs}>VS</Text>
              <Text style={styles.team} numberOfLines={2}>
                {teamName(tie.opponentId)}
              </Text>
            </View>
            <Button
              label={canPlay ? 'Play cup tie' : 'Not enough energy'}
              variant="gold"
              disabled={!canPlay}
              style={{ marginTop: spacing.md }}
              onPress={onPlay}
            />
          </>
        ) : status === 'WON' ? (
          <Text style={styles.won}>🏆 Champions of the {CUP_NAME}!</Text>
        ) : status === 'ELIMINATED' ? (
          <Text style={styles.out}>
            Knocked out.{champId ? ` ${teamName(champId)} lifted the cup.` : ''}
          </Text>
        ) : null}
      </Card>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    round: {
      color: colors.accent,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    fixtureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    team: {
      flex: 1,
      color: colors.text,
      fontSize: fontSize.lg,
      lineHeight: 24,
      fontWeight: fontWeight.heavy,
    },
    vs: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.black },
    won: { color: colors.accent, fontSize: fontSize.lg, fontWeight: fontWeight.heavy },
    out: { color: colors.textMuted, fontSize: fontSize.sm },
  });
