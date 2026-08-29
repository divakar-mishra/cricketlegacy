import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('internal QA tools', () => {
  const qaConfig = read('src/config/qa.ts');
  const settings = read('src/screens/SettingsScreen.tsx');
  const settingsStore = read('src/state/settingsStore.ts');
  const careerStore = read('src/state/careerStore.ts');
  const eas = read('eas.json');

  it('ships the whale controls only behind the QA build flag', () => {
    expect(qaConfig).toContain("process.env.EXPO_PUBLIC_QA_TOOLS === 'true'");
    expect(settings).toContain('{QA_TOOLS_ENABLED ? (');
    expect(settings).toContain('Unlimited energy');
    expect(settings).toContain('+10M coins');
    expect(eas).toContain('"EXPO_PUBLIC_QA_TOOLS": "true"');
  });

  it('persists the unlimited-energy choice and applies it to every match path', () => {
    expect(settingsStore).toContain('qaUnlimitedEnergy: s.qaUnlimitedEnergy');
    expect(careerStore).toContain('function qaUnlimitedEnergyEnabled()');
    expect(careerStore).not.toMatch(/save\.wallet\s*=\s*spendEnergy/);
    expect(careerStore.match(/spendSaveEnergy\(/g)?.length).toBe(4);
  });

  it('credits ten million coins to every Player and Manager save', () => {
    expect(qaConfig).toContain('QA_WHALE_COINS = 10_000_000');
    expect(careerStore).toContain('qaGrantWhaleCoins: () =>');
    expect(careerStore).toContain('await listAllSaves()');
    expect(careerStore).toContain(
      'entry.save.wallet = addCoins(entry.save.wallet, QA_WHALE_COINS)',
    );
    expect(settings).toContain('All save balances ready');
  });
});
