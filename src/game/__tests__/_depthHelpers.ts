import { SaveGame } from '../../domain/types';
import { buildUserPlayer, createCareerSave, createManagerSave } from '../createGame';
import { ensureManagerDepth } from '../manager';
import { ensureCareerDepth } from '../narrative';

const ATTRS = {
  batting: { technique: 62, timing: 62, power: 62, footwork: 62, temperament: 62, running: 62 },
  bowling: { paceOrSpin: 62, accuracy: 62, movement: 62, variations: 62, stamina: 62 },
  fielding: { catching: 60, throwing: 60, agility: 60, keeping: 45 },
  meta: { fitness: 62, confidence: 62, aggression: 55, discipline: 62 },
};

export function makeCareerSave(seed = 7): SaveGame {
  const player = buildUserPlayer({
    name: 'Test Star',
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    ...ATTRS,
  });
  const save = createCareerSave({ player, teamId: 'mumbai_sharks', difficulty: 'NORMAL', seed, format: 'T20' });
  ensureCareerDepth(save);
  return save;
}

export function makeManagerSave(seed = 9): SaveGame {
  const save = createManagerSave({ teamId: 'mumbai_sharks', difficulty: 'NORMAL', seed, format: 'T20' });
  ensureManagerDepth(save);
  return save;
}
