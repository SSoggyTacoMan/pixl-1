import { describe, expect, test } from "bun:test";
import { isPublicShellPath } from "./public-pages";

describe("isPublicShellPath", () => {
  test("the shop and its item pages are public", () => {
    expect(isPublicShellPath("/shop")).toBe(true);
    expect(isPublicShellPath("/shop?q=sticker")).toBe(true);
    expect(isPublicShellPath("/shop/42")).toBe(true);
    expect(isPublicShellPath("/shop/42?addr_verified_return=1")).toBe(true);
  });

  test("every other shell page stays behind the gate", () => {
    for (const p of ["/dashboard", "/orders", "/projects", "/account", "/shop/42/edit", "/shop/abc", "/shopping", "/"]) {
      expect(isPublicShellPath(p)).toBe(false);
    }
  });
});
