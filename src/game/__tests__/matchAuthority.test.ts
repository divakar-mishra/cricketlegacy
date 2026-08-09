import { matchDecisionAuthority } from '../matchAuthority';

describe('match decision authority', () => {
  test('a non-captain player cannot control team-wide decisions', () => {
    expect(
      matchDecisionAuthority({
        mode: 'career',
        captainClub: false,
        captainCountry: false,
      }),
    ).toMatchObject({ kind: 'PLAYER', canControlTeam: false });
  });

  test('club and national captaincy apply only to their own fixture level', () => {
    const clubCaptain = {
      mode: 'career' as const,
      captainClub: true,
      captainCountry: false,
    };
    const international = { competition: 'BILATERAL_SERIES' as const };

    expect(matchDecisionAuthority(clubCaptain).canControlTeam).toBe(true);
    expect(matchDecisionAuthority(clubCaptain, international).canControlTeam).toBe(false);

    expect(
      matchDecisionAuthority(
        { ...clubCaptain, captainCountry: true },
        international,
      ),
    ).toMatchObject({ kind: 'NATIONAL_CAPTAIN', canControlTeam: true });
  });

  test('a manager always has team authority', () => {
    expect(
      matchDecisionAuthority({
        mode: 'manager',
        captainClub: false,
        captainCountry: false,
      }),
    ).toMatchObject({ kind: 'MANAGER', canControlTeam: true });
  });
});
