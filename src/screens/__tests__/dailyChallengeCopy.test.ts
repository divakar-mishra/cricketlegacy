import fs from 'fs';
import path from 'path';

const dailyChallengeSource = fs.readFileSync(path.join(__dirname, '..', 'DailyChallengeScreen.tsx'), 'utf8');

describe('Daily Challenge unavailable reward state', () => {
  it('explains locked rewards without rendering a no-op claim button', () => {
    expect(dailyChallengeSource).not.toContain('Claim Reward (Complete in Match first)');
    expect(dailyChallengeSource).not.toContain('onPress={() => undefined}');
    expect(dailyChallengeSource).toContain('Reward locked');
    expect(dailyChallengeSource).toContain('Complete the challenge in a match before a reward can be claimed.');
  });
});
