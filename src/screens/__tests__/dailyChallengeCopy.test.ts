import fs from 'fs';
import path from 'path';

const dailyChallengeSource = fs.readFileSync(
  path.join(__dirname, '..', 'DailyChallengeScreen.tsx'),
  'utf8',
);

describe('Daily Challenge unavailable reward state', () => {
  it('keeps the unclaimed state action-led without rendering a no-op claim button', () => {
    expect(dailyChallengeSource).not.toContain('Claim Reward (Complete in Match first)');
    expect(dailyChallengeSource).not.toContain('onPress={() => undefined}');
    expect(dailyChallengeSource).toContain('label="▶  Play Challenge"');
    expect(dailyChallengeSource).not.toContain('Complete the challenge to claim the reward.');
    expect(dailyChallengeSource).not.toContain('Reward locked');
    expect(dailyChallengeSource).not.toContain('challenge.description');
    expect(dailyChallengeSource).toContain('Reward claimed.');
  });
});
