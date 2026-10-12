import { describe, expect, test } from "bun:test";
import { accountAddressLine, cityCountry } from "./address-summary";

describe("address summary", () => {
  test("city and country only", () => {
    expect(cityCountry({ addressCity: "Burlington", addressCountry: "US" })).toBe("Burlington, US");
    expect(cityCountry({ addressCity: " ", addressCountry: "US" })).toBe("US");
    expect(cityCountry(null)).toBe("");
  });
  test("account line", () => {
    expect(accountAddressLine({ hasAddress: true, addressCity: "Burlington", addressCountry: "US" })).toBe(
      "Burlington, US — street address on file",
    );
    expect(accountAddressLine({ hasAddress: true })).toBe("Street address on file");
    expect(accountAddressLine({ hasAddress: false, addressCity: "Burlington" })).toBeNull();
    expect(accountAddressLine(null)).toBeNull();
  });
  test("ignores street fields even if an old server still sent them", () => {
    const old = { hasAddress: true, addressCity: "B", addressCountry: "US", addressLine1: "1 Main St", addressPostal: "05401" };
    expect(accountAddressLine(old)).not.toContain("Main");
    expect(cityCountry(old)).toBe("B, US");
  });
});
