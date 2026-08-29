import { SAVE_SCHEMA_VERSION } from '../../domain/types';
import { makeCareerSave } from '../../game/__tests__/_depthHelpers';
import { LEGACY_MARKET_INDEX_ID } from '../../game/stockMarket';
import { runMigrations } from '../migrate';
import { synchronizeSchema42Portfolio } from '../schema42';

describe('schema 42 company portfolio', () => {
  it('preserves the anonymous holding and refunds removed tokens at the protective value', () => {
    const legacy = makeCareerSave();
    legacy.schemaVersion = 41;
    legacy.wallet.coins = 1_000;
    legacy.stockInvestment = {
      invested: 8_000,
      currentValue: 7_440,
      totalWithdrawn: 600,
      history: [8_000, 7_800, 7_440],
    };
    legacy.playerLife!.legacyTokenUnits = 2;
    legacy.playerLife!.legacyTokenCostBasis = 50_000;

    const migrated = runMigrations(legacy)!;
    const holding = migrated.stockPortfolio?.holdings[LEGACY_MARKET_INDEX_ID];

    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(holding).toMatchObject({
      costBasis: 8_000,
      currentValue: 7_440,
      totalWithdrawn: 600,
      history: [8_000, 7_800, 7_440],
      sellOnly: true,
    });
    expect(migrated.stockInvestment).toBeUndefined();
    expect(migrated.wallet.coins).toBe(51_000);
    expect(migrated.stockPortfolio?.legacyTokenRefundCoins).toBe(50_000);
    expect(migrated.playerLife?.legacyTokenUnits).toBeUndefined();
    expect(migrated.playerLife?.legacyTokenCostBasis).toBeUndefined();
  });

  it('cannot pay the token refund twice', () => {
    const save = makeCareerSave();
    save.stockPortfolio = undefined;
    save.playerLife!.legacyTokenUnits = 10;
    save.playerLife!.legacyTokenCostBasis = 4_000;
    const before = save.wallet.coins;

    synchronizeSchema42Portfolio(save);
    const afterFirst = save.wallet.coins;
    synchronizeSchema42Portfolio(save);

    expect(afterFirst).toBe(before + 4_000);
    expect(save.wallet.coins).toBe(afterFirst);
  });
});
