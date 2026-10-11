import { describe, expect, test } from "bun:test";
import { GAME_URL, loginUrl } from "./urls";

describe("loginUrl", () => {
  test("points at this app's own login route with a relative next", () => {
    expect(loginUrl("/shop?x=1")).toBe("/api/auth/login?next=%2Fshop%3Fx%3D1");
  });
  test("defaults to /dashboard", () => {
    expect(loginUrl("")).toBe("/api/auth/login?next=%2Fdashboard");
  });
});

describe("GAME_URL", () => {
  test("is the separate play host", () => {
    expect(GAME_URL).toBe("https://play.pixl.hackclub.com");
  });
});
