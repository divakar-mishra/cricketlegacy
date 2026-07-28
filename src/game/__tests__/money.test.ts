import {
  addMoney,
  compareMoney,
  convertMoney,
  formatCompactMoney,
  formatMoney,
  isSufficientFunds,
  money,
  multiplyMoney,
  subtractMoney,
} from '../money';

describe('Money', () => {
  it('requires safe integer minor units and a currency code', () => {
    expect(money('50000000', 'INR')).toEqual({ amountMinor: '50000000', currencyCode: 'INR' });
    expect(() => money(0.5, 'INR')).toThrow('safe integer');
  });

  it('adds, subtracts and compares only matching currencies', () => {
    const balance = money('50000000', 'INR');
    const cost = money('12500000', 'INR');
    expect(addMoney(balance, cost).amountMinor).toBe('62500000');
    expect(subtractMoney(balance, cost).amountMinor).toBe('37500000');
    expect(compareMoney(balance, cost)).toBe(1);
    expect(isSufficientFunds(balance, cost)).toBe(true);
    expect(() => addMoney(balance, money('100', 'GBP'))).toThrow('Currency mismatch');
  });

  it('multiplies and explicitly converts with a supplied rate', () => {
    expect(multiplyMoney(money('10000', 'GBP'), 1.5)).toEqual({
      amountMinor: '15000',
      currencyCode: 'GBP',
    });
    expect(convertMoney(money('10000', 'GBP'), 'INR', 105)).toEqual({
      amountMinor: '1050000',
      currencyCode: 'INR',
    });
  });

  it('formats full and compact values from currency metadata', () => {
    expect(formatMoney(money('50000000', 'INR'))).toContain('5,00,000');
    expect(formatCompactMoney(money('200000000', 'GBP'))).toMatch(/2M|2m/);
  });
});

