import { StyleSheet, View } from 'react-native';
import type { Player, SaveGame } from '../domain/types';
import { useColors } from '../theme';
import { AppText } from './AppText';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerStatusBadges } from './PlayerStatusBadges';

const ROLES: Record<Player['role'], string> = {
  BATTER: 'BAT',
  BOWLER: 'BOWL',
  ALLROUNDER: 'AR',
  WK_BATTER: 'WK',
};
export function SquadPlayerIdentity({
  player,
  save,
  captain,
  viceCaptain,
}: {
  player: Player;
  save: SaveGame;
  captain: boolean;
  viceCaptain: boolean;
}) {
  const colors = useColors();
  const own = save.mode === 'career' && player.id === save.userPlayerId;
  return (
    <View style={styles.identity}>
      <PlayerAvatar
        name={player.name}
        role={player.role}
        size="sm"
        config={own ? save.cosmetics?.avatarConfig : undefined}
        kitId={own ? save.cosmetics?.kit : undefined}
        profileFrame={own ? save.cosmetics?.profileFrame : undefined}
      />
      <View style={styles.copy}>
        <AppText
          numberOfLines={1}
          style={{ color: own ? colors.accent : colors.text, fontWeight: '600', fontSize: 14 }}
        >
          {player.name}
        </AppText>
        <View style={styles.meta}>
          <AppText style={[styles.role, { color: colors.textMuted, borderColor: colors.border }]}>
            {ROLES[player.role]}
          </AppText>
          {captain || viceCaptain ? (
            <AppText
              accessibilityLabel={captain ? 'Captain' : 'Vice-captain'}
              style={[styles.leader, { backgroundColor: colors.accent, color: colors.bg }]}
            >
              {captain ? 'C' : 'VC'}
            </AppText>
          ) : null}
          <PlayerStatusBadges
            injured={Boolean(player.injury)}
            fitness={save.managerCalendar ? player.condition : player.meta.fitness}
            mood={player.morale}
          />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0, gap: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  role: {
    fontSize: 9,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  leader: {
    fontSize: 9,
    fontWeight: '900',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
