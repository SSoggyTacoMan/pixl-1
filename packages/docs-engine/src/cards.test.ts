import { describe, expect, test } from "bun:test";
import { renderCard } from "./og";
import { renderPlayerCard } from "./playerOg";
import { renderItemCard } from "./shopOg";

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const isPng = (b: Uint8Array) => SIG.every((v, i) => b[i] === v);

describe("preview cards", () => {
  test("text card, item card and player card all encode to PNG", () => {
    expect(isPng(renderCard({ title: "Shipping", eyebrow: "Docs", url: "pixl.hackclub.com/docs" }))).toBe(true);
    expect(isPng(renderItemCard({ name: "Soldering iron", price: 1200, imageBytes: null, footer: "pixl.hackclub.com/shop" }))).toBe(true);
    expect(
      isPng(
        renderPlayerCard({ name: "TheBlueReverberationIsLong", level: 3, hours: 41.6, projects: 2, joined: "2026-08-20T00:00:00Z", siteHost: "pixl.hackclub.com", avatarBytes: null }),
      ),
    ).toBe(true);
  });

  test("undecodable image bytes fall back instead of throwing", () => {
    const junk = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]); // a JPEG header
    expect(isPng(renderItemCard({ name: "X", price: 1, imageBytes: junk }))).toBe(true);
    expect(isPng(renderPlayerCard({ name: "", level: NaN, hours: NaN, projects: 0, joined: "nope", siteHost: "x", avatarBytes: junk }))).toBe(true);
  });
});
