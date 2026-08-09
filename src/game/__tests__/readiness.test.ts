import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SaveGame } from '../../domain/types';
import { buildUserPlayer, createCareerSave } from '../createGame';
import { emptyStats } from '../stats';
import { franchiseAuctionGate, seniorProfessionalFeaturesUnlocked } from '../readiness';

function careerSave(): SaveGame {
  const player = buildUserPlayer({
    name: 'Gate Tester',
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: {
      technique: 72,
      timing: 72,
      power: 72,
      footwork: 72,
      temperament: 72,
      running: 72,
    },
    bowling: {
      paceOrSpin: 72,
      accuracy: 72,
      movement: 72,
      variations: 72,
      stamina: 72,
    },
    fielding: { catching: 70, throwing: 70, agility: 70, keeping: 35 },
    meta: { fitness: 74, confidence: 72, aggression: 55, discipline: 72 },
  });
  return createCareerSave({
    player,
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 101,
  });
}

describe('roadmap readiness gates', () => {
  it('explains auction eligibility using seasons, matches and star value', () => {
    const save = careerSave();
    const user = save.players.user;
    save.careerPathLevel = 'U19';
    expect(franchiseAuctionGate(save).reason).toContain('domestic');

    save.careerPathLevel = 'DOMESTIC';
    save.careerSeasons = 0;
    expect(franchiseAuctionGate(save).reason).toContain('2 domestic seasons');

    save.careerSeasons = 2;
    user.careerStats = { ...emptyStats(), matches: 4 };
    expect(franchiseAuctionGate(save).reason).toContain('10 career matches');

    user.careerStats = { ...emptyStats(), matches: 12 };
    save.brand = 80;
    expect(franchiseAuctionGate(save).unlocked).toBe(true);
  });

  it('keeps senior professional features hidden from youth careers', () => {
    const save = careerSave();
    const user = save.players.user;

    save.careerPathLevel = 'SCHOOL';
    user.age = 14;
    expect(seniorProfessionalFeaturesUnlocked(save)).toBe(false);

    save.careerPathLevel = 'U19';
    user.age = 25;
    expect(seniorProfessionalFeaturesUnlocked(save)).toBe(false);

    save.careerPathLevel = 'DOMESTIC';
    user.age = 17;
    expect(seniorProfessionalFeaturesUnlocked(save)).toBe(false);

    user.age = 20;
    expect(seniorProfessionalFeaturesUnlocked(save)).toBe(true);
  });
});
