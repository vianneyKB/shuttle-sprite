import { describe, expect, it } from "vitest";
import { formatMoney } from "../money";

describe("formatMoney", () => {
  it("formats known currencies with their own symbol and minor units", () => {
    expect(formatMoney(1234.5, "USD", "en-US")).toBe("$1,234.50");
    expect(formatMoney(1234.5, "ZAR", "en-ZA")).toMatch(/^R\s?1\s?234,50$/);
    expect(formatMoney(1234.5, "EUR", "de-DE")).toMatch(/1\.234,50\s?€/);
  });

  it("drops minor units for zero-decimal currencies", () => {
    expect(formatMoney(1234.5, "JPY", "ja-JP")).toBe("￥1,235");
  });

  it("falls back to South African rand when no currency is given", () => {
    expect(formatMoney(10, undefined, "en-ZA")).toMatch(/^R\s?10,00$/);
    expect(formatMoney(10, undefined, "en-US")).toMatch(/^ZAR\s10\.00$/); // Intl uses a non-breaking space
  });

  it("is case-insensitive on the code and never throws on an unknown one", () => {
    expect(formatMoney(5, "gbp", "en-GB")).toBe("£5.00");
    expect(() => formatMoney(5, "NOPE", "en-US")).not.toThrow();
  });
});
