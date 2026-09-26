import { describe, expect, it } from "vitest";
import { isValidPhone, profileChanges, profileFormSchema } from "../profile";

describe("isValidPhone", () => {
  it("accepts the ways a South African mobile number gets written", () => {
    expect(isValidPhone("0821234567")).toBe(true);
    expect(isValidPhone("082 123 4567")).toBe(true);
    expect(isValidPhone("+27 82 123 4567")).toBe(true);
    expect(isValidPhone("(082) 123-4567")).toBe(true);
    expect(isValidPhone("  082 123 4567  ")).toBe(true);
  });

  it("rejects blanks, letters and lengths no phone number has", () => {
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("   ")).toBe(false);
    expect(isValidPhone("call me")).toBe(false);
    expect(isValidPhone("082123")).toBe(false); // 6 digits
    expect(isValidPhone("0821234567890123456789")).toBe(false); // 22 chars
  });
});

describe("profileFormSchema", () => {
  it("trims and keeps a valid name and number", () => {
    const parsed = profileFormSchema.parse({ displayName: "  Ada Lovelace ", phone: " 082 123 4567 " });
    expect(parsed).toEqual({ displayName: "Ada Lovelace", phone: "082 123 4567" });
  });

  it("needs a name of at least two characters", () => {
    const result = profileFormSchema.safeParse({ displayName: "A", phone: "0821234567" });
    expect(result.success).toBe(false);
  });

  it("does not let a stored number be cleared", () => {
    const result = profileFormSchema.safeParse({ displayName: "Ada", phone: "" });
    expect(result.success).toBe(false);
  });
});

describe("profileChanges", () => {
  const current = { displayName: "Ada", phone: "082 123 4567" };

  it("returns nothing when the form matches the stored row", () => {
    expect(profileChanges(current, { displayName: "Ada", phone: "082 123 4567" })).toEqual({});
  });

  it("ignores whitespace-only edits", () => {
    expect(profileChanges(current, { displayName: " Ada ", phone: " 082 123 4567 " })).toEqual({});
  });

  it("sends only the field that changed, trimmed", () => {
    expect(profileChanges(current, { displayName: "Ada L ", phone: "082 123 4567" })).toEqual({
      displayName: "Ada L",
    });
    expect(profileChanges(current, { displayName: "Ada", phone: "071 000 0000" })).toEqual({
      phone: "071 000 0000",
    });
  });

  it("sends both when both changed", () => {
    expect(profileChanges(current, { displayName: "Grace", phone: "071 000 0000" })).toEqual({
      displayName: "Grace",
      phone: "071 000 0000",
    });
  });

  it("treats a blank stored value as a change once filled in", () => {
    expect(profileChanges({ displayName: "", phone: "" }, { displayName: "Ada", phone: "0821234567" })).toEqual({
      displayName: "Ada",
      phone: "0821234567",
    });
  });
});
