import { STOCK_COMPANIES, stockCompany } from '../data/stockCompanies';
import type {
  SaveGame,
  StockCompany,
  StockHolding,
  StockPortfolio,
  StockRisk,
} from '../domain/types';

export const STOCK_MIN_INVEST = 500;
export const STOCK_MAX_INVEST = 50_000;
export const LEGACY_MARKET_INDEX_ID = 'legacy_market_index';

export const STOCK_RISK_RANGES: Record<StockRisk, { min: number; max: number }> = {
  STABLE: { min: -4, max: 7 },
  BALANCED: { min: -8, max: 12 },
  VOLATILE: { min: -16, max: 20 },
};

export interface StockActionOutcome {
  ok: boolean;
  reason?: string;
  coins?: number;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashUnit(value: string): number {
  return stableHash(value) / 0xffffffff;
}

export function currentStockYear(save: SaveGame): number {
  return save.currentSeasonId ? (save.seasons[save.currentSeasonId]?.year ?? 2026) : 2026;
}

export function ensureStockPortfolio(save: SaveGame): StockPortfolio {
  const hasLegacyTokens =
    (save.playerLife?.legacyTokenUnits ?? 0) > 0 ||
    (save.playerLife?.legacyTokenCostBasis ?? 0) > 0;
  save.stockPortfolio ??= {
    holdings: {},
    totalWithdrawn: 0,
    lastReturns: {},
    legacyTokenRefunded: !hasLegacyTokens,
  };
  const portfolio = save.stockPortfolio;
  portfolio.holdings ??= {};
  portfolio.lastReturns ??= {};
  portfolio.totalWithdrawn = count(portfolio.totalWithdrawn);
  portfolio.legacyTokenRefunded = Boolean(portfolio.legacyTokenRefunded);
  for (const [id, holding] of Object.entries(portfolio.holdings)) {
    if (!holding) {
      delete portfolio.holdings[id];
      continue;
    }
    holding.companyId = holding.companyId || id;
    holding.costBasis = count(holding.costBasis);
    holding.currentValue = count(holding.currentValue);
    holding.totalWithdrawn = count(holding.totalWithdrawn);
    holding.history = (holding.history ?? []).map(count).slice(-8);
  }
  return portfolio;
}

/** Deterministic company move for one save-year. Cricket results are deliberately irrelevant. */
export function companySeasonReturnPct(
  saveId: string,
  year: number,
  company: StockCompany,
): number {
  const range = STOCK_RISK_RANGES[company.risk];
  const sectorMove = hashUnit(`${saveId}:${year}:${company.sector}:sector`);
  const companyMove = hashUnit(`${saveId}:${year}:${company.id}:company`);
  const blended = sectorMove * 0.55 + companyMove * 0.45;
  const raw = range.min + (range.max - range.min) * blended;
  return Math.round(raw * 10) / 10;
}

export function investInStockCompany(
  save: SaveGame,
  companyId: string,
  coins: number,
): StockActionOutcome {
  if (save.mode !== 'career') return { ok: false, reason: 'Portfolio is for Player Career.' };
  const company = stockCompany(companyId);
  if (!company) return { ok: false, reason: 'That company is not available.' };
  const amount = Math.round(coins);
  if (amount < STOCK_MIN_INVEST) {
    return { ok: false, reason: `Minimum investment is ${STOCK_MIN_INVEST} coins.` };
  }
  if (amount > STOCK_MAX_INVEST) {
    return { ok: false, reason: `Maximum per investment is ${STOCK_MAX_INVEST} coins.` };
  }
  if (save.wallet.coins < amount) return { ok: false, reason: 'Not enough Wallet Coins.' };

  const portfolio = ensureStockPortfolio(save);
  const holding = portfolio.holdings[companyId];
  save.wallet.coins -= amount;
  if (holding) {
    holding.costBasis += amount;
    holding.currentValue += amount;
  } else {
    portfolio.holdings[companyId] = {
      companyId,
      costBasis: amount,
      currentValue: amount,
      totalWithdrawn: 0,
      history: [amount],
    };
  }
  return { ok: true, coins: amount };
}

/** Sell a coin-value slice from one holding. Omitting coins sells the entire position. */
export function sellStockCompany(
  save: SaveGame,
  companyId: string,
  coins?: number,
): StockActionOutcome {
  if (save.mode !== 'career') return { ok: false, reason: 'Portfolio is for Player Career.' };
  const portfolio = ensureStockPortfolio(save);
  const holding = portfolio.holdings[companyId];
  if (!holding || holding.currentValue < 1) return { ok: false, reason: 'No active holding.' };

  const requested = coins === undefined ? holding.currentValue : Math.round(coins);
  if (requested < 1) return { ok: false, reason: 'Enter an amount to sell.' };
  if (requested > holding.currentValue) {
    return { ok: false, reason: 'The sale exceeds the current holding value.' };
  }

  const valueBefore = holding.currentValue;
  const fractionSold = requested / valueBefore;
  const basisSold =
    requested === valueBefore ? holding.costBasis : Math.round(holding.costBasis * fractionSold);
  holding.currentValue -= requested;
  holding.costBasis = Math.max(0, holding.costBasis - basisSold);
  holding.totalWithdrawn += requested;
  portfolio.totalWithdrawn += requested;
  save.wallet.coins += requested;

  if (holding.currentValue === 0) {
    delete portfolio.holdings[companyId];
  } else {
    const remainingFraction = holding.currentValue / valueBefore;
    holding.history = holding.history.map((value) => Math.round(value * remainingFraction));
  }
  return { ok: true, coins: requested };
}

/** Apply one independent, persisted market move to every company at season end. */
export function tickStockMarket(save: SaveGame, year = currentStockYear(save)): void {
  if (save.mode !== 'career') return;
  const portfolio = ensureStockPortfolio(save);
  if (portfolio.lastUpdatedYear === year) return;

  const returns: Record<string, number> = {};
  for (const company of STOCK_COMPANIES) {
    returns[company.id] = companySeasonReturnPct(save.id, year, company);
  }
  portfolio.lastReturns = returns;
  portfolio.lastUpdatedYear = year;

  for (const holding of Object.values(portfolio.holdings)) {
    if (holding.sellOnly) continue;
    const movement = returns[holding.companyId];
    if (movement === undefined) continue;
    holding.currentValue = Math.max(0, Math.round(holding.currentValue * (1 + movement / 100)));
    holding.lastReturnPct = movement;
    holding.history.push(holding.currentValue);
    if (holding.history.length > 8) holding.history = holding.history.slice(-8);
  }
}

export function stockPortfolioTotals(portfolio?: StockPortfolio): {
  costBasis: number;
  currentValue: number;
  profitLoss: number;
} {
  const holdings = Object.values(portfolio?.holdings ?? {});
  const costBasis = holdings.reduce((total, holding) => total + count(holding.costBasis), 0);
  const currentValue = holdings.reduce((total, holding) => total + count(holding.currentValue), 0);
  return { costBasis, currentValue, profitLoss: currentValue - costBasis };
}

export function holdingDisplayName(holding: StockHolding): string {
  if (holding.companyId === LEGACY_MARKET_INDEX_ID) return 'Legacy Market Index';
  return stockCompany(holding.companyId)?.name ?? 'Retired Market Holding';
}
