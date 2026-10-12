import { describe, expect, test } from "bun:test";
import { withAgeOverride } from "./ageOverrides";

const overrides = { u1: "Shipped before turning 19." };
const sections = { "AGE JUSTIFICATION": "", NOTES: "n" };

describe("withAgeOverride", () => {
  test("fills the age justification for an overridden player", () => {
    expect(withAgeOverride("u1", sections, overrides)["AGE JUSTIFICATION"]).toBe("Shipped before turning 19.");
  });
  test("keeps what the reviewer already wrote", () => {
    const written = { ...sections, "AGE JUSTIFICATION": "Reviewer text" };
    expect(withAgeOverride("u1", written, overrides)).toBe(written);
  });
  test("leaves everyone else alone", () => {
    expect(withAgeOverride("u2", sections, overrides)).toBe(sections);
  });
});
