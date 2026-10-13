import fs from 'node:fs';
import path from 'node:path';
import { makeCareerSave } from '../src/game/__tests__/_depthHelpers';

// Opt-in, isolated fixtures for testing purchase ownership, not offer eligibility.
// Each starts at the existing post-first-match offer state without changing the
// runtime gates or the owner's careers. Billing must still use the real provider.
test('emit isolated Starter Pack reinstall fixtures only when requested', () => {
  const output = process.env.QA_STARTER_FIXTURE_DIR;
  if (!output) return;
  fs.mkdirSync(output, { recursive: true });
  for (const [index, name] of ['before', 'fresh-career', 'after'].entries()) {
    const save = makeCareerSave(99110 + index);
    save.id = `qa-starter-reinstall-${name}-20261011`;
    save.players[save.userPlayerId!].name = `QA Starter ${name}`;
    save.wallet.coins = 1000;
    save.wallet.gems = 0;
    save.firstPurchaseDone = false;
    save.experience = {
      ...save.experience,
      starterPackUnlockedAt: Date.now(),
      starterPackDismissedAt: Date.now(),
    };
    if (save.story) {
      save.story.pendingEventIds = [];
      save.story.seenEventIds.push('career_start');
    }
    expect(save.firstPurchaseDone).toBe(false);
    expect(save.wallet.coins).toBe(1000);
    fs.writeFileSync(path.join(output, `qa-starter-${name}.json`), JSON.stringify(save));
  }
});
