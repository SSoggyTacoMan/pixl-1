import { describe, expect, test } from "bun:test";
import { checkLoginRedirect, checkRedirect, CLIENT_STATE_RE, createLoginCodeStore, LOGIN_CODE_TTL_MS } from "./loginCodes.js";

const grant = { userId: "u1", displayName: "P", slackId: "U123", isNew: false, needsLegalName: false };

describe("login codes", () => {
  test("a code is 32 random bytes, base64url", () => {
    const store = createLoginCodeStore();
    const a = store.issue(grant);
    const b = store.issue(grant);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  test("a code works once", () => {
    const store = createLoginCodeStore();
    const code = store.issue(grant);
    expect(store.redeem(code)).toEqual(grant);
    expect(store.redeem(code)).toBeNull();
  });

  test("a code expires after 60 s, and an expired attempt still spends it", () => {
    let now = 1_000_000;
    const store = createLoginCodeStore(() => now);
    const fresh = store.issue(grant);
    now += LOGIN_CODE_TTL_MS - 1;
    expect(store.redeem(fresh)).toEqual(grant);
    const stale = store.issue(grant);
    now += LOGIN_CODE_TTL_MS;
    expect(store.redeem(stale)).toBeNull();
    expect(store.size()).toBe(0);
  });

  test("unknown codes are refused", () => {
    expect(createLoginCodeStore().redeem("nope")).toBeNull();
  });
});

describe("checkRedirect", () => {
  test("https URLs on the site or the game are accepted, fragment dropped", () => {
    expect(checkRedirect("https://play.pixl.hackclub.com/")).toBe("https://play.pixl.hackclub.com/");
    expect(checkRedirect("https://pixl.hackclub.com/api/auth/callback?x=1#frag")).toBe(
      "https://pixl.hackclub.com/api/auth/callback?x=1",
    );
  });

  test("everything else is refused", () => {
    for (const bad of [
      "http://localhost:7777/callback",
      "https://localhost/",
      "http://127.0.0.1/",
      "https://[::1]/",
      "http://pixl.hackclub.com/",
      "https://dash.pixl.hackclub.com/",
      "https://server.pixl.hackclub.com/",
      "https://evil.example/",
      "https://pixl.hackclub.com.evil.example/",
      "https://evil.example/?https://pixl.hackclub.com",
      "https://a@pixl.hackclub.com/",
      "javascript:alert(1)",
      "//pixl.hackclub.com/",
      "",
      42,
      undefined,
    ])
      expect(checkRedirect(bad)).toBeNull();
  });

  test("client state is opaque but bounded", () => {
    expect(CLIENT_STATE_RE.test("abcdEFGH1234-_.~")).toBe(true);
    expect(CLIENT_STATE_RE.test("short")).toBe(false);
    expect(CLIENT_STATE_RE.test("has space in it")).toBe(false);
    expect(CLIENT_STATE_RE.test("x".repeat(513))).toBe(false);
  });
});

describe("checkLoginRedirect", () => {
  test("only the dashboard callback and the game root, exactly", () => {
    expect(checkLoginRedirect("https://pixl.hackclub.com/api/auth/callback")).toBe("https://pixl.hackclub.com/api/auth/callback");
    expect(checkLoginRedirect("https://play.pixl.hackclub.com/")).toBe("https://play.pixl.hackclub.com/");
  });

  test("any other path, a query, a fragment or a look-alike is refused", () => {
    for (const bad of [
      "https://pixl.hackclub.com/",
      "https://pixl.hackclub.com/account",
      "https://pixl.hackclub.com/api/auth/callback?next=/x",
      "https://pixl.hackclub.com/api/auth/callback#x",
      "https://pixl.hackclub.com/api/auth/callback/",
      "https://pixl.hackclub.com/API/auth/callback",
      "https://play.pixl.hackclub.com",
      "https://play.pixl.hackclub.com/?x=1",
      "https://play.pixl.hackclub.com/some/page",
      "https://play.pixl.hackclub.com:443/",
      "http://play.pixl.hackclub.com/",
      "https://dash.pixl.hackclub.com/",
      "https://user@play.pixl.hackclub.com/",
      undefined,
      42,
    ])
      expect(checkLoginRedirect(bad)).toBeNull();
  });
});
