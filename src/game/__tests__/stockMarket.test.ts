import { STOCK_COMPANIES, STOCK_SECTORS } from '../../data/stockCompanies';
import {
  companySeasonReturnPct,
  investInStockCompany,
  sellStockCompany,
  STOCK_RISK_RANGES,
  tickStockMarket,
} from '../stockMarket';
import { makeCareerSave } from './_depthHelpers';

describe('fictional company market', () => {
  it('provides 24 companies across all eight approved sectors', () => {
    expect(STOCK_COMPANIES).toHaveLength(24);
    expect(new Set(STOCK_COMPANIES.map((company) => company.id)).size).toBe(24);
    expect(new Set(STOCK_COMPANIES.map((company) => company.sector))).toEqual(
      new Set(STOCK_SECTORS),
    );
  });

  it('keeps deterministic annual moves inside each approved risk range', () => {
    for (const company of STOCK_COMPANIES) {
      const movement = companySeasonReturnPct('save-a', 2032, company);
      const range = STOCK_RISK_RANGES[company.risk];
      expect(movement).toBeGreaterThanOrEqual(range.min);
      expect(movement).toBeLessThanOrEqual(range.max);
      expect(companySeasonReturnPct('save-a', 2032, company)).toBe(movement);
    }
  });

  it('supports multiple holdings, adding funds and a proportional partial sale', () => {
    const save = makeCareerSave();
    save.wallet.coins = 100_000;
    const first = STOCK_COMPANIES[0];
    const second = STOCK_COMPANIES[1];

    expect(investInStockCompany(save, first.id, 10_000).ok).toBe(true);
    expect(investInStockCompany(save, second.id, 5_000).ok).toBe(true);
    expect(investInStockCompany(save, first.id, 2_000).ok).toBe(true);
    expect(Object.keys(save.stockPortfolio?.holdings ?? {})).toHaveLength(2);
    expect(save.stockPortfolio?.holdings[first.id].costBasis).toBe(12_000);

    expect(sellStockCompany(save, first.id, 3_000)).toMatchObject({ ok: true, coins: 3_000 });
    expect(save.stockPortfolio?.holdings[first.id].currentValue).toBe(9_000);
    expect(save.stockPortfolio?.holdings[first.id].costBasis).toBe(9_000);
    expect(save.wallet.coins).toBe(86_000);
  });

  it('updates a company once per season and never reads cricket results', () => {
    const save = makeCareerSave();
    save.wallet.coins = 20_000;
    const company = STOCK_COMPANIES[5];
    investInStockCompany(save, company.id, 10_000);

    tickStockMarket(save, 2030);
    const once = save.stockPortfolio!.holdings[company.id].currentValue;
    for (const fixture of Object.values(save.fixtures)) {
      fixture.played = true;
      fixture.winnerTeamId = fixture.awayTeamId;
    }
    tickStockMarket(save, 2030);
    expect(save.stockPortfolio!.holdings[company.id].currentValue).toBe(once);
  });
});
