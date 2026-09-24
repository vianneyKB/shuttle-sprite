/**
 * Minor-unit conversion for payment providers.
 *
 * Amounts live in the database as major units (12.50). Every provider we
 * support charges integers in the currency's smallest unit — 1250 cents,
 * 1250 kobo — so the conversion has to know how many decimals a currency has.
 *
 * Mirrors public.to_minor_units() in the payments migration; the two must
 * agree or the webhook's amount check will reject good payments.
 */

/** ISO 4217 currencies with no minor unit. */
const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

/** ISO 4217 currencies with three decimals. */
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

/** Platform home market; also the fallback when a row has no currency. */
export const DEFAULT_CURRENCY = "ZAR";

/** Number of decimal places the currency is quoted in. */
export const currencyDecimals = (currency?: string | null): number => {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  if (ZERO_DECIMAL.has(code)) return 0;
  if (THREE_DECIMAL.has(code)) return 3;
  return 2;
};

/** 12.5 ZAR → 1250. Rounds: providers reject fractional minor units. */
export const toMinorUnits = (amount: number, currency?: string | null): number => {
  if (!Number.isFinite(amount)) throw new Error("Amount is not a number");
  return Math.round(amount * 10 ** currencyDecimals(currency));
};

/** 1250 ZAR-cents → 12.5. */
export const fromMinorUnits = (minor: number, currency?: string | null): number => {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round(minor) / factor;
};
