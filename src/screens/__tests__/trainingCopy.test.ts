import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, '..', 'TrainingScreen.tsx'), 'utf8');

describe('training clarity copy', () => {
  it('explains caps, possible gain, cost, and unlock requirements', () => {
    expect(source).toContain('Possible gain: {possibleGain}');
    expect(source).not.toContain('Potential increase');
    expect(source).toContain('Current cap: {cap}');
    expect(source).toContain('School-level coaching cap');
    expect(source).toContain('Earn an Under-19 call-up to raise this cap.');
    expect(source).toContain('Earn a domestic contract to raise this cap.');
  });

  it('offers the accelerator only while training sessions remain', () => {
    expect(source).toContain('left > 0 ?');
    expect(source).toContain('Three sessions at 3x gains. Training limits still apply.');
    expect(source).toContain("navigation.navigate('Purchase')");
  });

  it('shows the shared six-session price curve and an actionable analyst focus', () => {
    expect(source).toContain(
      'School, Under-19, Domestic and International careers use the same seasonal price curve:',
    );
    expect(source).toContain('250, 400, 550, 700, 850 and 1,000 coins');
    expect(source).toContain('Analyst focus:');
    expect(source).toContain('Analyst recommendation');
    expect(source).toContain('activeAnalysis?.recommendedTrainingGroup === group.id');
  });
});
