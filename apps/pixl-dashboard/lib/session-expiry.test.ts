import { describe, expect, test } from "bun:test";
import { safeNext } from "./auth-flow";
import { decideExpiry, expiredUrl, sessionRejected } from "./session-expiry";

describe("decideExpiry", () => {
  test("a server 401 (revoked/banned) clears the cookie and returns to the page, which shows the Gate", () => {
    expect(decideExpiry(true, 401)).toEqual({ clear: true, dest: "next" });
  });
  test("a banned player (403 banned) is signed out too", () => {
    expect(decideExpiry(true, 403, "banned")).toEqual({ clear: true, dest: "next" });
  });
  test("a cookie that no longer verifies locally is cleared too", () => {
    expect(decideExpiry(false, 0)).toEqual({ clear: true, dest: "next" });
  });
  test("a server that accepts the session again keeps it", () => {
    expect(decideExpiry(true, 200)).toEqual({ clear: false, dest: "next" });
  });
  test("an outage never signs anyone out and never loops back into the shell", () => {
    expect(decideExpiry(true, 503)).toEqual({ clear: false, dest: "home" });
    expect(decideExpiry(true, 0)).toEqual({ clear: false, dest: "home" });
    expect(decideExpiry(true, 403, "forbidden")).toEqual({ clear: false, dest: "home" });
    expect(decideExpiry(true, 503, "session_check_unavailable")).toEqual({ clear: false, dest: "home" });
  });
});

describe("expiredUrl", () => {
  test("carries the page back through safeNext", () => {
    const u = new URL(expiredUrl("/projects/3?tab=journal"), "https://pixl.hackclub.com");
    expect(u.pathname).toBe("/api/auth/expired");
    expect(safeNext(u.searchParams.get("next"))).toBe("/projects/3?tab=journal");
  });
  test("an attacker-supplied next still can't leave the site", () => {
    const u = new URL(expiredUrl("/.//evil.com"), "https://pixl.hackclub.com");
    expect(safeNext(u.searchParams.get("next"))).toBe("/dashboard");
  });
});

describe("sessionRejected", () => {
  test("only 401 and 403 banned", () => {
    expect(sessionRejected(401, "session_revoked")).toBe(true);
    expect(sessionRejected(403, "banned")).toBe(true);
    expect(sessionRejected(403, "not_owner")).toBe(false);
    expect(sessionRejected(200, null)).toBe(false);
    expect(sessionRejected(503, "ban_check_unavailable")).toBe(false);
  });
});
