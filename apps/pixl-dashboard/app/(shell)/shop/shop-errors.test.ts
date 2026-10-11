import { describe, expect, test } from "bun:test";
import { shopError } from "./shop-errors";

describe("shopError", () => {
  test("uses price/balance for insufficient", () => {
    expect(shopError("insufficient", { price: 1200, balance: 350.4 })).toBe(
      "Not enough pixels for that: it costs 1,200 and you have 350.",
    );
    expect(shopError("insufficient")).toBe("Not enough pixels for that.");
  });
  test("trophy XP and region", () => {
    expect(shopError("not_eligible", { xp: 41.9, need: 100 })).toBe("Not yet, you're at 41 / 100 XP.");
    expect(shopError("wrong_region", { region: "eu" })).toContain("(EU)");
    expect(shopError("sold_out")).toBe("That option just sold out, pick another.");
  });
});
