export type CurrencyCode =
  | 'INR'
  | 'GBP'
  | 'AUD'
  | 'NZD'
  | 'ZAR'
  | 'PKR'
  | 'BDT'
  | 'LKR'
  | 'AED'
  | 'USD'
  | 'CAD';

export interface Money {
  /** Integer minor units stored as a string to avoid JSON precision drift. */
  amountMinor: string;
  currencyCode: CurrencyCode;
}

export interface CurrencyConfig {
  currencyCode: CurrencyCode;
  defaultLocale: string;
  fractionDigits: number;
  compactStyle: 'indian' | 'western';
}

export const CURRENCY_REGISTRY: Record<CurrencyCode, CurrencyConfig> = {
  INR: { currencyCode: 'INR', defaultLocale: 'en-IN', fractionDigits: 2, compactStyle: 'indian' },
  GBP: { currencyCode: 'GBP', defaultLocale: 'en-GB', fractionDigits: 2, compactStyle: 'western' },
  AUD: { currencyCode: 'AUD', defaultLocale: 'en-AU', fractionDigits: 2, compactStyle: 'western' },
  NZD: { currencyCode: 'NZD', defaultLocale: 'en-NZ', fractionDigits: 2, compactStyle: 'western' },
  ZAR: { currencyCode: 'ZAR', defaultLocale: 'en-ZA', fractionDigits: 2, compactStyle: 'western' },
  PKR: { currencyCode: 'PKR', defaultLocale: 'en-PK', fractionDigits: 2, compactStyle: 'western' },
  BDT: { currencyCode: 'BDT', defaultLocale: 'en-BD', fractionDigits: 2, compactStyle: 'western' },
  LKR: { currencyCode: 'LKR', defaultLocale: 'en-LK', fractionDigits: 2, compactStyle: 'western' },
  AED: { currencyCode: 'AED', defaultLocale: 'en-AE', fractionDigits: 2, compactStyle: 'western' },
  USD: { currencyCode: 'USD', defaultLocale: 'en-US', fractionDigits: 2, compactStyle: 'western' },
  CAD: { currencyCode: 'CAD', defaultLocale: 'en-CA', fractionDigits: 2, compactStyle: 'western' },
};

function minorAmount(money: Money): number {
  const n = Number(money.amountMinor);
  if (!Number.isSafeInteger(n)) throw new Error(`Unsafe money amount: ${money.amountMinor}`);
  return n;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currencyCode !== b.currencyCode) {
    throw new Error(`Currency mismatch: ${a.currencyCode} vs ${b.currencyCode}`);
  }
}

export function money(amountMinor: number | string, currencyCode: CurrencyCode): Money {
  const amount = typeof amountMinor === 'number' ? amountMinor : Number(amountMinor);
  if (!Number.isSafeInteger(amount)) throw new Error(`Money minor amount must be a safe integer: ${amountMinor}`);
  return { amountMinor: String(amount), currencyCode };
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(minorAmount(a) + minorAmount(b), a.currencyCode);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(minorAmount(a) - minorAmount(b), a.currencyCode);
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return Math.sign(minorAmount(a) - minorAmount(b));
}

export function isSufficientFunds(balance: Money, cost: Money): boolean {
  return compareMoney(balance, cost) >= 0;
}

export function multiplyMoney(value: Money, multiplier: number): Money {
  if (!Number.isFinite(multiplier)) throw new Error('Money multiplier must be finite.');
  return money(Math.round(minorAmount(value) * multiplier), value.currencyCode);
}

export function convertMoney(
  value: Money,
  targetCurrencyCode: CurrencyCode,
  rate: number,
): Money {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Conversion rate must be positive.');
  return money(Math.round(minorAmount(value) * rate), targetCurrencyCode);
}

export function formatMoney(value: Money, locale?: string): string {
  const config = CURRENCY_REGISTRY[value.currencyCode];
  return new Intl.NumberFormat(locale ?? config.defaultLocale, {
    style: 'currency',
    currency: value.currencyCode,
    minimumFractionDigits: config.fractionDigits,
    maximumFractionDigits: config.fractionDigits,
  }).format(minorAmount(value) / 10 ** config.fractionDigits);
}

export function formatCompactMoney(value: Money, locale?: string): string {
  const config = CURRENCY_REGISTRY[value.currencyCode];
  return new Intl.NumberFormat(locale ?? config.defaultLocale, {
    style: 'currency',
    currency: value.currencyCode,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(minorAmount(value) / 10 ** config.fractionDigits);
}

