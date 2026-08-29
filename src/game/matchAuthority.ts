import { Fixture, SaveGame } from '../domain/types';
import { isInternationalFixture } from './intlCalendar';

export type MatchAuthorityKind = 'MANAGER' | 'CLUB_CAPTAIN' | 'NATIONAL_CAPTAIN' | 'PLAYER';

export interface MatchAuthority {
  kind: MatchAuthorityKind;
  canControlTeam: boolean;
  title: string;
  detail: string;
}

/**
 * Team-wide decisions belong to managers and captains. A Player Career user
 * still controls their own batting/bowling choices, but cannot pick the XI,
 * alter team tactics, or make the toss election before earning the armband.
 */
export function matchDecisionAuthority(
  save: Pick<SaveGame, 'mode' | 'captainClub' | 'captainCountry'>,
  fixture?: Pick<Fixture, 'competition'>,
): MatchAuthority {
  if (save.mode === 'manager') {
    return {
      kind: 'MANAGER',
      canControlTeam: true,
      title: 'Head coach control',
      detail: 'You control the XI, batting order, team tactics, and toss election.',
    };
  }

  if (fixture?.competition === 'U19_WORLDCUP') {
    return {
      kind: 'PLAYER',
      canControlTeam: false,
      title: 'Under-19 national squad role',
      detail: 'The captain controls the XI and toss. You control your own match decisions.',
    };
  }

  if (isInternationalFixture(fixture)) {
    if (save.captainCountry) {
      return {
        kind: 'NATIONAL_CAPTAIN',
        canControlTeam: true,
        title: 'National captain control',
        detail: 'You control the national XI, batting order, team tactics, and toss election.',
      };
    }
    return {
      kind: 'PLAYER',
      canControlTeam: false,
      title: 'National squad role',
      detail:
        'The national captain controls the XI and toss. You control your own match decisions.',
    };
  }

  if (save.captainClub) {
    return {
      kind: 'CLUB_CAPTAIN',
      canControlTeam: true,
      title: 'Club captain control',
      detail: 'You control the club XI, batting order, team tactics, and toss election.',
    };
  }

  return {
    kind: 'PLAYER',
    canControlTeam: false,
    title: 'Player role',
    detail: 'Your captain controls the XI and toss. You control your own match decisions.',
  };
}
