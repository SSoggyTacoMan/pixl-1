import { describe, expect, mock, test } from "bun:test";
import {
  decodeLoginState,
  encodeLoginState,
  newState,
  resolveCallback,
  safeNext,
  serverLoginUrl,
  statesMatch,
  type ExchangeResponse,
} from "./auth-flow";

const good: ExchangeResponse = {
  token: "jwt.token.here",
  user: { id: "u1", displayName: "Ada", slackId: "U1" },
  isNew: false,
  needsLegalName: false,
};

describe("safeNext", () => {
  test("keeps same-site relative paths", () => {
    expect(safeNext("/shop/12?tab=a#x")).toBe("/shop/12?tab=a#x");
  });
  for (const bad of [
    null,
    "",
    "shop",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example/",
    "javascript:alert(1)",
    "/api/auth/login",
    "/x\n",
  ]) {
    test(`falls back for ${JSON.stringify(bad)}`, () => {
      expect(safeNext(bad as string | null)).toBe("/dashboard");
    });
  }
});

describe("login state cookie", () => {
  test("round-trips state and next", () => {
    const s = newState();
    expect(decodeLoginState(encodeLoginState(s, "/orders"))).toEqual({ state: s, next: "/orders" });
  });
  test("rejects malformed values", () => {
    expect(decodeLoginState(undefined)).toBeNull();
    expect(decodeLoginState("short.x")).toBeNull();
    expect(decodeLoginState(".abc")).toBeNull();
  });
  test("an off-site next smuggled into the cookie is neutralized", () => {
    const s = newState();
    const raw = `${s}.${Buffer.from("//evil.example").toString("base64url")}`;
    expect(decodeLoginState(raw)?.next).toBe("/dashboard");
  });
});

describe("statesMatch", () => {
  test("equal strings match, everything else does not", () => {
    const s = newState();
    expect(statesMatch(s, s)).toBe(true);
    expect(statesMatch(s, s.slice(0, -1) + (s.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(statesMatch(s, s + "x")).toBe(false);
    expect(statesMatch("", "")).toBe(false);
  });
});

describe("serverLoginUrl", () => {
  test("sends an absolute https callback on the site origin, plus state", () => {
    const u = new URL(serverLoginUrl("st4te"));
    expect(u.origin).toBe("https://server.pixl.hackclub.com");
    expect(u.pathname).toBe("/auth/hackclub");
    expect(u.searchParams.get("redirect")).toBe("https://pixl.hackclub.com/api/auth/callback");
    expect(u.searchParams.get("state")).toBe("st4te");
  });
});

describe("resolveCallback", () => {
  const state = newState();
  const cookie = encodeLoginState(state, "/shop");

  test("matching state exchanges the code and returns the session + next", async () => {
    const exchange = mock(async (_c: string) => good);
    const out = await resolveCallback({ code: "c0de", state, cookie }, exchange);
    expect(out).toEqual({ kind: "session", token: good.token, next: "/shop", user: good.user, needsLegalName: false });
    expect(exchange).toHaveBeenCalledWith("c0de");
  });

  test("mismatched state never exchanges the code", async () => {
    const exchange = mock(async (_c: string) => good);
    const out = await resolveCallback({ code: "c0de", state: newState(), cookie }, exchange);
    expect(out).toEqual({ kind: "error", error: "state_mismatch" });
    expect(exchange).not.toHaveBeenCalled();
  });

  test("missing cookie (login started elsewhere / replay) is a mismatch", async () => {
    const exchange = mock(async (_c: string) => good);
    expect(await resolveCallback({ code: "c", state, cookie: undefined }, exchange)).toEqual({
      kind: "error",
      error: "state_mismatch",
    });
    expect(await resolveCallback({ code: "c", state: null, cookie }, exchange)).toEqual({
      kind: "error",
      error: "state_mismatch",
    });
    expect(exchange).not.toHaveBeenCalled();
  });

  test("missing code", async () => {
    const exchange = mock(async (_c: string) => good);
    expect(await resolveCallback({ code: null, state, cookie }, exchange)).toEqual({
      kind: "error",
      error: "missing_code",
    });
  });

  test("failed or malformed exchange", async () => {
    expect(await resolveCallback({ code: "c", state, cookie }, async () => null)).toEqual({
      kind: "error",
      error: "exchange_failed",
    });
    expect(
      await resolveCallback({ code: "c", state, cookie }, async () => ({ ...good, token: "" })),
    ).toEqual({ kind: "error", error: "exchange_failed" });
  });

  test("passes needsLegalName through", async () => {
    const out = await resolveCallback({ code: "c", state, cookie }, async () => ({ ...good, needsLegalName: true }));
    expect(out.kind === "session" && out.needsLegalName).toBe(true);
  });
});
