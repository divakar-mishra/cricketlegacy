import {
  emptyHallOfFame,
  managerLegacyScore,
  mergeSaveIntoHallOfFame,
  playerLegacyScore,
  qualifiesForPlayerHall,
  summarizeManager,
  summarizePlayer,
  upsertPlayer,
} from '../hallOfFame';
import { emptyStats } from '../stats';
import { makeCareerSave, makeManagerSave } from './_depthHelpers';

describe('Hall of Fame (cross-career)', () => {
  it('summarises a player career (and not in manager mode)', () => {
    const cs = makeCareerSave();
    const entry = summarizePlayer(cs);
    expect(entry).not.toBeNull();
    expect(entry!.saveId).toBe(cs.id);
    expect(entry!.name).toBe('Test Star');
    expect(summarizeManager(cs)).toBeNull();
  });

  it('summarises a manager career (and not in career mode)', () => {
    const ms = makeManagerSave();
    const entry = summarizeManager(ms);
    expect(entry).not.toBeNull();
    expect(entry!.saveId).toBe(ms.id);
    expect(summarizePlayer(ms)).toBeNull();
  });

  it('keeps the best scores across DIFFERENT careers (durable board)', () => {
    const a = makeCareerSave(1);
    a.id = 'career-A';
    a.players[a.userPlayerId!].careerStats = { ...emptyStats(), runs: 8000, wickets: 100, highScore: 150, hundreds: 22 };

    const b = makeCareerSave(2);
    b.id = 'career-B';
    b.players[b.userPlayerId!].careerStats = { ...emptyStats(), runs: 12000, wickets: 20, highScore: 264, hundreds: 30 };

    let hof = emptyHallOfFame();
    hof = mergeSaveIntoHallOfFame(hof, a);
    hof = mergeSaveIntoHallOfFame(hof, b);

    // Both careers persist on the board, ranked by legacy (B is greater).
    expect(hof.players).toHaveLength(2);
    expect(hof.players[0].saveId).toBe('career-B');
    expect(hof.players[0].highScore).toBe(264);
    expect(hof.players[1].saveId).toBe('career-A');
  });

  it('does not induct tiny unfinished careers', () => {
    const save = makeCareerSave(9);
    save.id = 'tiny-career';
    save.players[save.userPlayerId!].careerStats = { ...emptyStats(), runs: 69, highScore: 32 };

    const entry = summarizePlayer(save)!;
    expect(qualifiesForPlayerHall(entry)).toBe(false);
    expect(mergeSaveIntoHallOfFame(emptyHallOfFame(), save).players).toHaveLength(0);
  });

  it('reserves the Hall of Fame for all-time greats only', () => {
    const base = {
      saveId: 's',
      name: 'P',
      team: 'X',
      nationality: 'india',
      overall: 80,
      hundreds: 0,
      fifties: 0,
      highScore: 100,
      bestBowling: '5/20',
      caps: 40,
      titles: 1,
      seasons: 8,
      retired: true,
      updatedAt: 0,
    };
    // A solid but ordinary career must NOT qualify.
    expect(qualifiesForPlayerHall({ ...base, runs: 4000, wickets: 60 })).toBe(false);
    // ~10k runs qualifies.
    expect(qualifiesForPlayerHall({ ...base, runs: 10000, wickets: 0 })).toBe(true);
    // ~400 wickets qualifies.
    expect(qualifiesForPlayerHall({ ...base, runs: 500, wickets: 400 })).toBe(true);
  });

  it('upserts the same save in place (no duplicates as a career progresses)', () => {
    const a = makeCareerSave(3);
    a.id = 'career-A';
    a.players[a.userPlayerId!].careerStats = { ...emptyStats(), runs: 10000, highScore: 80 };
    let hof = mergeSaveIntoHallOfFame(emptyHallOfFame(), a);
    // Same career, later — a bigger score should replace the earlier entry.
    a.players[a.userPlayerId!].careerStats = { ...emptyStats(), runs: 12000, highScore: 199 };
    hof = mergeSaveIntoHallOfFame(hof, a);
    expect(hof.players).toHaveLength(1);
    expect(hof.players[0].highScore).toBe(199);
  });

  it('tracks manager trophies separately from players', () => {
    const m = makeManagerSave(4);
    m.id = 'mgr-A';
    m.leagueTitles = 3;
    m.cupWins = 2;
    m.promotions = 1;
    m.bestLeaguePos = 1;
    const team = m.teams[m.userTeamId!];
    const [legendId] = team.playerIds;
    m.players[legendId].legendary = true;
    const [win, loss, draw] = Object.values(m.fixtures).filter(
      (fixture) => fixture.homeTeamId === m.userTeamId || fixture.awayTeamId === m.userTeamId,
    );
    win!.played = true;
    win!.winnerTeamId = m.userTeamId;
    loss!.played = true;
    loss!.winnerTeamId = loss!.homeTeamId === m.userTeamId ? loss!.awayTeamId : loss!.homeTeamId;
    draw!.played = true;
    draw!.winnerTeamId = undefined;
    const hof = mergeSaveIntoHallOfFame(emptyHallOfFame(), m);
    expect(hof.managers).toHaveLength(1);
    expect(hof.players).toHaveLength(0);
    expect(hof.managers[0].trophies).toBe(5);
    expect(hof.managers[0]).toMatchObject({
      wins: 1,
      losses: 1,
      draws: 1,
      winRate: 33,
      legendsProduced: 1,
    });
    expect(managerLegacyScore(hof.managers[0])).toBeGreaterThan(0);
  });

  it('legacy scores reward run-scorers and wicket-takers', () => {
    const batter = { runs: 5000, wickets: 0, highScore: 200, hundreds: 20, caps: 50, titles: 2 } as never;
    const bowler = { runs: 500, wickets: 300, highScore: 40, hundreds: 0, caps: 50, titles: 2 } as never;
    expect(playerLegacyScore(batter)).toBeGreaterThan(0);
    expect(playerLegacyScore(bowler)).toBeGreaterThan(0);
  });

  it('caps and sorts via upsert', () => {
    let hof = emptyHallOfFame();
    for (let i = 0; i < 30; i++) {
      hof = upsertPlayer(hof, {
        saveId: `s${i}`,
        name: `P${i}`,
        team: 'X',
        nationality: 'india',
        overall: 70,
        runs: i * 100,
        wickets: 0,
        hundreds: 0,
        fifties: 0,
        highScore: i,
        bestBowling: '—',
        caps: 0,
        titles: 0,
        seasons: 1,
        retired: false,
        updatedAt: 0,
      });
    }
    expect(hof.players.length).toBeLessThanOrEqual(25);
    expect(hof.players[0].runs).toBe(2900); // highest runs first
  });
});
