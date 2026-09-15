/**
 * Currency formatting. Amounts are plain numbers in major units (e.g. 12.50),
 * currency is an ISO 4217 code that comes from operator_settings / the booking
 * snapshot. Intl handles symbol, placement and minor-unit digits (JPY has none).
 */

export const DEFAULT_CURRENCY = "USD";

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (currency: string, locale?: string) => {
  const key = `${locale ?? ""}|${currency}`;
  let f = formatterCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { style: "currency", currency });
    } catch {
      // Unknown/invalid code: fall back to a plain number with the code appended.
      f = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    formatterCache.set(key, f);
  }
  return f;
};

export const formatMoney = (amount: number, currency = DEFAULT_CURRENCY, locale?: string): string => {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  const f = getFormatter(code, locale);
  const out = f.format(amount);
  return f.resolvedOptions().style === "currency" ? out : `${out} ${code}`;
};

/** Common currencies offered in the operator settings form. Any ISO code is accepted by the DB. */
export const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "ZAR", label: "ZAR — South African rand" },
  { code: "USD", label: "USD — US dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British pound" },
  { code: "KES", label: "KES — Kenyan shilling" },
  { code: "NGN", label: "NGN — Nigerian naira" },
  { code: "GHS", label: "GHS — Ghanaian cedi" },
  { code: "AED", label: "AED — UAE dirham" },
  { code: "INR", label: "INR — Indian rupee" },
  { code: "AUD", label: "AUD — Australian dollar" },
  { code: "CAD", label: "CAD — Canadian dollar" },
  { code: "JPY", label: "JPY — Japanese yen" },
];
