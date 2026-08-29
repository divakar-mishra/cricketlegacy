import type { SaveGame, StockPortfolio } from '../domain/types';
import { LEGACY_MARKET_INDEX_ID } from '../game/stockMarket';

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

function legacyTokenPrice(save: SaveGame): number {
  const year = save.currentSeasonId ? (save.seasons?.[save.currentSeasonId]?.year ?? 2026) : 2026;
  const seed = stableHash(`${save.id}:${year}:legacy-exchange`);
  return 280 + ((seed % 11) - 5) * 16;
}

function migrationPortfolio(save: SaveGame): StockPortfolio {
  save.stockPortfolio ??= {
    holdings: {},
    totalWithdrawn: 0,
    lastReturns: {},
    legacyTokenRefunded: false,
  };
  save.stockPortfolio.holdings ??= {};
  save.stockPortfolio.lastReturns ??= {};
  save.stockPortfolio.totalWithdrawn = count(save.stockPortfolio.totalWithdrawn);
  return save.stockPortfolio;
}

/**
 * Replace the anonymous stock balance with a multi-company portfolio while
 * preserving it as a sell-only index. Remove Legacy Tokens with the approved
 * higher-of-cost-or-market refund, paid exactly once.
 */
export function synchronizeSchema42Portfolio(save: SaveGame): void {
  if (save.mode !== 'career') return;
  const portfolio = migrationPortfolio(save);
  const legacyStock = save.stockInvestment;

  if (legacyStock) {
    const costBasis = count(legacyStock.invested);
    const currentValue = count(legacyStock.currentValue);
    const withdrawn = count(legacyStock.totalWithdrawn);
    if ((costBasis > 0 || currentValue > 0) && !portfolio.holdings[LEGACY_MARKET_INDEX_ID]) {
      portfolio.holdings[LEGACY_MARKET_INDEX_ID] = {
        companyId: LEGACY_MARKET_INDEX_ID,
        costBasis,
        currentValue,
        totalWithdrawn: withdrawn,
        history: (legacyStock.history ?? []).map(count).slice(-8),
        sellOnly: true,
      };
    }
    portfolio.totalWithdrawn = Math.max(portfolio.totalWithdrawn, withdrawn);
    delete save.stockInvestment;
  }

  if (!portfolio.legacyTokenRefunded) {
    const units = count(save.playerLife?.legacyTokenUnits);
    const costBasis = count(save.playerLife?.legacyTokenCostBasis);
    const marketValue = units * legacyTokenPrice(save);
    const refund = Math.max(costBasis, marketValue);
    if (refund > 0) {
      save.wallet.coins = count(save.wallet.coins) + refund;
      portfolio.legacyTokenRefundCoins = count(portfolio.legacyTokenRefundCoins) + refund;
    }
    if (save.playerLife) {
      delete save.playerLife.legacyTokenUnits;
      delete save.playerLife.legacyTokenCostBasis;
    }
    portfolio.legacyTokenRefunded = true;
  }
}
