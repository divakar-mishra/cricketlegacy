import { TEAM_BLUEPRINTS } from '../../content/teams';
import { SaveGame } from '../../domain/types';
import { emptyStats } from '../stats';
import { buildUserPlayer, createCareerSave, createManagerSave } from '../createGame';
import {
  featureGate,
  nextObviousAction,
  seniorProfessionalFeaturesUnlocked,
  shouldShowAdvancedLiveOps,
  shouldShowSeasonPass,
} from '../readiness';

function careerSave(): SaveGame {
  const player = buildUserPlayer({
    name: 'Gate Tester',
    nationality: 'india',
    role: 'ALLROUNDER',
    battingStyle: 'RHB',
    bowlingStyle: 'PACE',
    batting: { technique: 72, timing: 72, power: 72, footwork: 72, temperament: 72, running: 72 },
    bowling: { paceOrSpin: 72, accuracy: 72, movement: 72, variations: 72, stamina: 72 },
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

function managerSave(): SaveGame {
  return createManagerSave({
    teamId: TEAM_BLUEPRINTS[0].id,
    difficulty: 'NORMAL',
    seed: 202,
  });
}

describe('roadmap readiness gates', () => {
  it('hides advanced liveops and season pass until two matches are played', () => {
    expect(shouldShowSeasonPass(0)).toBe(false);
    expect(shouldShowSeasonPass(1)).toBe(false);
    expect(shouldShowSeasonPass(2)).toBe(true);
    expect(shouldShowAdvancedLiveOps(1)).toBe(false);
    expect(shouldShowAdvancedLiveOps(2)).toBe(true);
  });

  it('explains national cup locks by career and manager level', () => {
    const career = careerSave();
    career.careerPathLevel = 'SCHOOL';
    expect(featureGate(career, 'NATIONAL_CUP').unlocked).toBe(false);
    expect(featureGate(career, 'NATIONAL_CUP').reason).toContain('domestic');
    career.careerPathLevel = 'DOMESTIC';
    expect(featureGate(career, 'NATIONAL_CUP').unlocked).toBe(true);

    const manager = managerSave();
    manager.managerCareerLevel = 'CLUB';
    expect(featureGate(manager, 'NATIONAL_CUP').unlocked).toBe(false);
    manager.managerCareerLevel = 'STATE';
    expect(featureGate(manager, 'NATIONAL_CUP').unlocked).toBe(true);
  });

  it('explains auction eligibility using seasons, matches and star value', () => {
    const save = careerSave();
    const user = save.players.user;
    save.careerPathLevel = 'U19';
    expect(featureGate(save, 'FRANCHISE_AUCTION').reason).toContain('domestic');

    save.careerPathLevel = 'DOMESTIC';
    save.careerSeasons = 0;
    expect(featureGate(save, 'FRANCHISE_AUCTION').reason).toContain('2 domestic seasons');

    save.careerSeasons = 2;
    user.careerStats = { ...emptyStats(), matches: 4 };
    expect(featureGate(save, 'FRANCHISE_AUCTION').reason).toContain('10 career matches');

    user.careerStats = { ...emptyStats(), matches: 12 };
    save.brand = 80;
    expect(featureGate(save, 'FRANCHISE_AUCTION').unlocked).toBe(true);
  });

  it('gates manager multi-format competitions behind state promotion', () => {
    const save = managerSave();
    save.managerCareerLevel = 'CLUB';
    expect(featureGate(save, 'MANAGER_MULTI_FORMAT').unlocked).toBe(false);
    expect(featureGate(save, 'MANAGER_MULTI_FORMAT').reason).toContain('Professional');
    save.managerCareerLevel = 'STATE';
    expect(featureGate(save, 'MANAGER_MULTI_FORMAT').unlocked).toBe(true);
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

  it('makes the first hub action one obvious match CTA', () => {
    const save = careerSave();
    const action = nextObviousAction(save, 0);
    expect(action.id).toBe('PLAY_NEXT_MATCH');
    expect(action.label).toBe('Play your first match');
  });
});
