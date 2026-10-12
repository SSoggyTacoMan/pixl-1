import { describe, expect, test } from "bun:test";
import { lockReason, type ShopItem } from "./shop-lib";

const item = (over: Partial<ShopItem>) => ({ id: 1, name: "x", price: 10, ...over }) as ShopItem;

describe("lockReason", () => {
  test("trial-gated items unlock on approval, not on ship", () => {
    const r = lockReason(item({ unlock_trials: ["Lighthouse"] }));
    expect(r).toBe('Get "Lighthouse" approved to unlock this.');
    expect(r).not.toMatch(/^Ship /);
    expect(lockReason(item({}))).toBe("Get the required Trial approved to unlock this.");
  });
  test("lock notes and beacon locks still win", () => {
    expect(lockReason(item({ lock_note: "Soon" }))).toBe("Soon");
    expect(lockReason(item({ beacon_locked: true }))).toContain("Beacon");
  });
});
