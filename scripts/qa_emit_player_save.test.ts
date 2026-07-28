import fs from 'node:fs';
import path from 'node:path';

import { buildUserPlayer, createCareerSave } from '../src/game/createGame';
import { Role } from '../src/domain/types';
import { isReviewableDismissal } from '../src/game/drs';
import { ensureCareerDepth } from '../src/game/narrative';
import { createLiveMatch, nextUserFixtureId } from '../src/game/season';
import { emptyStats } from '../src/game/stats';

const ATTRS = {
  batting: { technique: 62, timing: 62, power: 62, footwork: 62, temperament: 62, running: 62 },
  bowling: { paceOrSpin: 62, accuracy: 62, movement: 62, variations: 62, stamina: 62 },
  fielding: { catching: 60, throwing: 60, agility: 60, keeping: 45 },
  meta: { fitness: 62, confidence: 62, aggression: 55, discipline: 62 },
};

function makeQaSave(params: {
  now: number;
  profile: string;
  age: number;
  role: Role;
  name: string;
  seed: number;
  saveId?: string;
}) {
  const player = buildUserPlayer({
    name: params.name,
    nationality: 'india',
    role: params.role,
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    age: params.age,
    ...ATTRS,
  });
  const save = createCareerSave({
    player,
    teamId: 'mumbai_sharks',
    difficulty: 'NORMAL',
    seed: params.seed,
    format: 'T20',
  });
  ensureCareerDepth(save);
  save.id = params.saveId ?? `qa-player-${params.profile}-${params.now}`;
  save.createdAt = params.now;
  save.updatedAt = params.now;
  save.flags = { ...save.flags, qaSeededPlayer: true };
  return save;
}

function firstUserDismissalIsReviewable(save: ReturnType<typeof makeQaSave>): boolean {
  const fixtureId = nextUserFixtureId(save);
  if (!fixtureId || !save.userPlayerId) return false;
  const live = createLiveMatch(save, fixtureId, save.userPlayerId);
  while (!live.matchDone) {
    const step = live.nextBall(live.needsIntent() ? 'ATTACK' : undefined);
    if (step.wicketOf === save.userPlayerId) {
      return (
        !step.inningsBreak &&
        !step.matchComplete &&
        isReviewableDismissal(step.event.dismissal?.type)
      );
    }
  }
  return false;
}

function findDrsEligibleSave(params: {
  now: number;
  profile: string;
  age: number;
  role: Role;
  name: string;
  seed: number;
}) {
  const max = Number(process.env.QA_PLAYER_DRS_SEARCH_LIMIT ?? 1000);
  for (let i = 0; i < max; i++) {
    const saveId = `qa-player-${params.profile}-${params.now}-${i}`;
    const save = makeQaSave({ ...params, saveId });
    if (firstUserDismissalIsReviewable(save)) {
      save.flags = { ...save.flags, qaDrsEligible: true };
      return save;
    }
  }
  throw new Error(`Unable to find a DRS-eligible QA save in ${max} candidates`);
}

test('emits a QA player save JSON when QA_PLAYER_SAVE_OUT is set', () => {
  const out = process.env.QA_PLAYER_SAVE_OUT;
  if (!out) return;

  const now = Number(process.env.QA_PLAYER_SAVE_NOW ?? Date.now());
  const profile = process.env.QA_PLAYER_PROFILE ?? 'weak-hof';
  const age = Number(process.env.QA_PLAYER_AGE ?? 21);
  const role = (process.env.QA_PLAYER_ROLE ?? 'ALLROUNDER') as Role;
  const seed = Number(process.env.QA_PLAYER_SEED ?? 69);
  const name = process.env.QA_PLAYER_NAME ?? 'Weak HOF Check';
  const save =
    profile === 'drs-eligible' || profile === 'drs-ineligible-u19'
      ? findDrsEligibleSave({ now, profile, age, role, name, seed })
      : makeQaSave({ now, profile, age, role, name, seed });

  const user = save.players[save.userPlayerId!];
  if (profile === 'weak-hof') {
    save.careerSeasons = 2;
    save.flags = { ...save.flags, qaWeakHof: true };
    user.careerStats = {
      ...emptyStats(),
      matches: 9,
      runs: 69,
      balls: 74,
      fours: 5,
      highScore: 32,
    };
    user.seasonStats = { ...user.careerStats };
  }
  if (profile === 'invalid-age33-youth') {
    save.schemaVersion = 12;
    save.careerPathLevel = 'U19';
    save.careerSeasons = 14;
    save.careerPathMatches = 4;
    save.careerPathRuns = 114;
    save.careerPathWickets = 3;
    save.careerPathRatingSum = 210;
    save.flags = { ...save.flags, qaInvalidAge33Youth: true };
  }
  if (profile === 'international-energy') {
    save.capped = true;
    save.userCaps = 12;
    save.nationalRep = 100;
    save.careerPathLevel = 'INTERNATIONAL';
    save.flags = { ...save.flags, qaInternationalEnergy: true };
  }
  if (profile === 'stale-overall') {
    save.schemaVersion = 11;
    user.overall = 12;
    save.flags = { ...save.flags, qaStaleOverall: true };
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(save, null, 2)}\n`, 'utf8');
});
