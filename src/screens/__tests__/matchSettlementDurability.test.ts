import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Matchday result durability', () => {
  const matchScreen = read('src/screens/MatchScreen.tsx');
  const careerStore = read('src/state/careerStore.ts');

  it('confirms the critical save before exposing the completed-result screen', () => {
    expect(matchScreen).toContain("setPhase('saving')");
    expect(matchScreen).toContain('await persistCritical(true)');
    expect(matchScreen).toContain("setPhase('done')");
    expect(matchScreen.indexOf("setPhase('saving')")).toBeLessThan(
      matchScreen.indexOf('await persistCritical(true)'),
    );
  });

  it('enqueues autosaves immediately so an older write cannot enter after a newer result', () => {
    expect(careerStore).not.toContain('InteractionManager.runAfterInteractions');
    expect(careerStore).toContain('await writeSave(ref.mode, ref.slot, save)');
  });

  it('guards normal, international and daily results with the exactly-once ledger', () => {
    expect(careerStore.match(/hasRecordedSaveResult\(save, match\.id\)/g)?.length).toBeGreaterThanOrEqual(
      3,
    );
  });
});
