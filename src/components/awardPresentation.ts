import type { SaveGame } from '../domain/types';
import type { ThemeColors } from '../theme';
import { seasonAwards } from '../game/progression';
import { standings } from '../game/season';
import type { AwardArtworkKind } from './AwardArtwork';

export interface Award {
  id: string;
  artwork: AwardArtworkKind;
  playerId?: string;
  title: string;
  winner: string;
  stat: string;
  color: string;
}

export function buildAwardList(save: SaveGame, colors: ThemeColors): Award[] {
  const nameOf = (id?: string) => (id ? (save.players[id]?.name ?? '---') : '---');
  const awards = seasonAwards(save);
  const table = standings(save);
  const champion = table[0];
  const championName = champion ? (save.teams[champion.teamId]?.name ?? '---') : '---';
  const resultTeamId =
    save.mode === 'career' ? (save.franchiseTeamId ?? save.userTeamId) : save.userTeamId;
  const userTeam = resultTeamId ? save.teams[resultTeamId] : null;
  const userPos = table.findIndex((r) => r.teamId === resultTeamId) + 1;

  const awardList: Award[] = [
    {
      id: 'champion',
      artwork: 'cup',
      title: 'SEASON CHAMPIONS',
      winner: championName,
      stat: champion ? `${champion.won}W · ${champion.points} pts` : '---',
      color: colors.accent,
    },
  ];

  if (awards.topScorer?.playerId) {
    awardList.push({
      id: 'topScorer',
      artwork: 'bat',
      playerId: awards.topScorer.playerId,
      title: 'GOLDEN BAT',
      winner: nameOf(awards.topScorer.playerId),
      stat: `${awards.topScorer.runs} runs`,
      color: colors.primary,
    });
  }

  if (awards.topWicketTaker?.playerId) {
    awardList.push({
      id: 'topWickets',
      artwork: 'ball',
      playerId: awards.topWicketTaker.playerId,
      title: 'GOLDEN BALL',
      winner: nameOf(awards.topWicketTaker.playerId),
      stat: `${awards.topWicketTaker.wickets} wickets`,
      color: '#E5484D',
    });
  }

  if (userPos >= 1 && userPos <= 3) {
    awardList.push({
      id: 'userResult',
      artwork: userPos === 1 ? 'cup' : userPos === 2 ? 'silver' : 'bronze',
      title: userPos === 1 ? 'YOU ARE CHAMPIONS!' : userPos === 2 ? 'RUNNERS-UP' : 'THIRD PLACE',
      winner: userTeam?.name ?? '---',
      stat: `Finished ${userPos}${userPos === 1 ? 'st' : userPos === 2 ? 'nd' : 'rd'}`,
      color: userPos === 1 ? colors.accent : colors.primary,
    });
  }

  return awardList;
}
