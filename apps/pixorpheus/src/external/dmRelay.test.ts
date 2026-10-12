import { describe, expect, test } from "bun:test";
import { DmRateLimiter, MAX_MESSAGE_LENGTH, apiKeyMatches, relayDm, validateDmRequest } from "./dmRelay.js";

// Ported from apps/pixo-dm/index.test.js when that relay was folded into Pixo.

describe("validateDmRequest", () => {
  test("accepts a user id and plain text, trimmed", () => {
    expect(validateDmRequest({ userId: " U0ABC12345 ", message: " hi there " })).toEqual({
      ok: true,
      target: "U0ABC12345",
      text: "hi there",
    });
    const w = validateDmRequest({ userId: "W0ABC12345", message: "hi" });
    expect(w.ok && w.target).toBe("W0ABC12345");
    expect(validateDmRequest({ userId: "U0ABC12345", message: "see https://pixl.hackclub.com" }).ok).toBe(true);
    expect(validateDmRequest({ userId: "U0ABC12345", message: "thanks <@U0ABC12345>, 3 < 4" }).ok).toBe(true);
  });

  test("rejects channel ids and malformed user ids", () => {
    for (const userId of ["C0ABC12345", "G0ABC12345", "D0ABC12345", "U123", "u0abc12345", "<@U0ABC12345>", 42, null]) {
      expect(validateDmRequest({ userId, message: "hi" }).ok).toBe(false);
    }
  });

  test("rejects Slack control syntax in the message", () => {
    for (const message of [
      "<!channel> hi",
      "<!here|here>",
      "<!everyone>",
      "< !here>",
      "<!subteam^S123|@team>",
      "click <https://evil.com|pixl.hackclub.com>",
      "<http://evil.com>",
      "<mailto:a@b.co|support>",
      "< https://evil.com>",
      "<slack://open>",
      "<HTTPS://evil.com>",
      "<tel:+15550100>",
      "<ftp://x>",
      "<javascript:alert(1)>",
      "<git+ssh://host/repo>",
    ]) {
      const r = validateDmRequest({ userId: "U0ABC12345", message });
      expect(r.ok ? 200 : r.status).toBe(400);
    }
  });

  test("rejects missing, non-string and oversized messages", () => {
    expect(validateDmRequest(null).ok).toBe(false);
    expect(validateDmRequest([]).ok).toBe(false);
    expect(validateDmRequest({ userId: "U0ABC12345", message: { toString: () => "x" } }).ok).toBe(false);
    expect(validateDmRequest({ userId: "U0ABC12345", message: "   " }).ok).toBe(false);
    expect(validateDmRequest({ userId: "U0ABC12345", message: "a".repeat(MAX_MESSAGE_LENGTH + 1) }).ok).toBe(false);
    expect(validateDmRequest({ userId: "U0ABC12345", message: "a".repeat(MAX_MESSAGE_LENGTH) }).ok).toBe(true);
  });
});

describe("apiKeyMatches", () => {
  test("exact match only", () => {
    expect(apiKeyMatches("test-key-123", "test-key-123")).toBe(true);
    expect(apiKeyMatches("test-key-12", "test-key-123")).toBe(false);
    expect(apiKeyMatches("wrong-key-12", "test-key-123")).toBe(false);
    expect(apiKeyMatches(undefined, "test-key-123")).toBe(false);
    expect(apiKeyMatches(["test-key-123"], "test-key-123")).toBe(false);
  });
});

describe("DmRateLimiter", () => {
  test("per-user limit, then the window rolls over", () => {
    const l = new DmRateLimiter({ globalPerMinute: 100, perUserPerMinute: 5, dailyGlobal: 1000 });
    for (let i = 0; i < 5; i++) expect(l.isRateLimited("U1", 1_000)).toBe(false);
    expect(l.isRateLimited("U1", 1_000)).toBe(true);
    expect(l.isRateLimited("U2", 1_000)).toBe(false);
    expect(l.isRateLimited("U1", 62_000)).toBe(false);
  });

  test("global per-minute limit across users", () => {
    const l = new DmRateLimiter({ globalPerMinute: 3, perUserPerMinute: 5, dailyGlobal: 1000 });
    expect(l.isRateLimited("U1", 0)).toBe(false);
    expect(l.isRateLimited("U2", 0)).toBe(false);
    expect(l.isRateLimited("U3", 0)).toBe(false);
    expect(l.isRateLimited("U4", 0)).toBe(true);
    expect(l.isRateLimited("U4", 61_000)).toBe(false);
  });

  test("daily ceiling holds after the minute windows reset", () => {
    const l = new DmRateLimiter({ globalPerMinute: 100, perUserPerMinute: 100, dailyGlobal: 2 });
    expect(l.isRateLimited("U1", 0)).toBe(false);
    expect(l.isRateLimited("U2", 120_000)).toBe(false);
    expect(l.isRateLimited("U3", 240_000)).toBe(true);
    expect(l.isRateLimited("U3", 24 * 60 * 60 * 1000 + 1)).toBe(false);
  });

  test("rejected attempts are not counted", () => {
    const l = new DmRateLimiter({ globalPerMinute: 100, perUserPerMinute: 1, dailyGlobal: 2 });
    expect(l.isRateLimited("U1", 0)).toBe(false);
    expect(l.isRateLimited("U1", 0)).toBe(true);
    expect(l.isRateLimited("U1", 0)).toBe(true);
    expect(l.isRateLimited("U2", 0)).toBe(false);
  });

  test("sweep forgets idle users", () => {
    const l = new DmRateLimiter({ globalPerMinute: 100, perUserPerMinute: 5, dailyGlobal: 1000 });
    l.isRateLimited("U1", 0);
    l.isRateLimited("U2", 50_000);
    l.sweep(70_000);
    expect(l.trackedUsers).toBe(1);
  });
});

describe("relayDm (the endpoint without Express)", () => {
  const limits = { globalPerMinute: 60, perUserPerMinute: 5, dailyGlobal: 1000 };
  const ok = { apiKey: "test-key-123", botToken: "xoxb-test" };

  test("fails closed when the key or bot token is unset", async () => {
    let sends = 0;
    const send = async () => void sends++;
    const body = { userId: "U0ABC12345", message: "hi" };
    const l = new DmRateLimiter(limits);
    expect((await relayDm({ apiKey: undefined, botToken: "x", providedKey: "", body }, l, send)).status).toBe(503);
    expect((await relayDm({ apiKey: "", botToken: "x", providedKey: "", body }, l, send)).status).toBe(503);
    expect((await relayDm({ apiKey: "k", botToken: undefined, providedKey: "k", body }, l, send)).status).toBe(503);
    expect(sends).toBe(0);
  });

  test("wrong key is 401, bad body is 400, all before any Slack call", async () => {
    const sent: [string, string][] = [];
    const send = async (c: string, t: string) => void sent.push([c, t]);
    const l = new DmRateLimiter(limits);
    const call = (providedKey: unknown, body: unknown) => relayDm({ ...ok, providedKey, body }, l, send);
    expect((await call("wrong-key-12", { userId: "U0ABC12345", message: "hi" })).status).toBe(401);
    expect((await call(undefined, { userId: "U0ABC12345", message: "hi" })).status).toBe(401);
    expect((await call("test-key-123", { userId: "C0ABC12345", message: "hi" })).status).toBe(400);
    expect((await call("test-key-123", { userId: "U0ABC12345", message: "<!channel>" })).status).toBe(400);
    expect(sent).toEqual([]);
    const good = await call("test-key-123", { userId: " U0ABC12345 ", message: " hi " });
    expect(good).toEqual({ status: 200, body: { ok: true } });
    expect(sent).toEqual([["U0ABC12345", "hi"]]);
  });

  test("rate limited is 429 without a Slack call", async () => {
    let sends = 0;
    const l = new DmRateLimiter({ ...limits, perUserPerMinute: 1 });
    const call = () => relayDm({ ...ok, providedKey: "test-key-123", body: { userId: "U0ABC12345", message: "hi" } }, l, async () => void sends++);
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(429);
    expect(sends).toBe(1);
  });

  test("a Slack failure is 502 delivery_failed", async () => {
    const l = new DmRateLimiter(limits);
    const r = await relayDm({ ...ok, providedKey: "test-key-123", body: { userId: "U0ABC12345", message: "hi" } }, l, async () => {
      throw new Error("channel_not_found");
    });
    expect(r).toEqual({ status: 502, body: { error: "delivery_failed" } });
  });
});
