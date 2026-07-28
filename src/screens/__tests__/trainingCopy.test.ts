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
});
