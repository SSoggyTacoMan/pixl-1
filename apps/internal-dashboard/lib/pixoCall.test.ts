import { afterEach, describe, expect, test } from "bun:test";
import { callPixo, pixoStatus, type PixoCallDeps } from "./pixoCall";
import { dmViaPixorpheus } from "./slack";
import { PIXO_OFFLINE_RESOLVE_NOTICE, resolveViaPixorpheus } from "./tickets";

// Pixo is stopped at relaunch: every dashboard -> Pixo call must time out
// fast, never throw, and report the failure instead of failing the action.

function deps(fetchImpl: PixoCallDeps["fetchImpl"], reports: string[] = []): PixoCallDeps {
  return { fetchImpl, report: (label, reason) => void reports.push(`${label}: ${reason}`), timeoutMs: 50 };
}
const refused: PixoCallDeps["fetchImpl"] = async () => {
  throw new TypeError("fetch failed: ECONNREFUSED");
};
// Never answers; only the AbortSignal ends it.
const hangs: PixoCallDeps["fetchImpl"] = (_u, init) =>
  new Promise((_, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });
const answer = (status: number, body: unknown = {}): PixoCallDeps["fetchImpl"] => async () =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("callPixo", () => {
  test("a refused connection is offline, reported, not thrown", async () => {
    const reports: string[] = [];
    const r = await callPixo("dm", "http://pixo/x", {}, deps(refused, reports));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.offline).toBe(true);
    expect(reports).toEqual(["dm: unreachable: fetch failed: ECONNREFUSED"]);
  });

  test("a hung Pixo is cut off by the timeout", async () => {
    const reports: string[] = [];
    const started = Date.now();
    const r = await callPixo("dm", "http://pixo/x", {}, deps(hangs, reports));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(!r.ok && r.offline).toBe(true);
    expect(reports).toEqual(["dm: timeout"]);
  });

  test("5xx is offline, 4xx is a rejection, 2xx is ok", async () => {
    const r5 = await callPixo("x", "u", {}, deps(answer(503)));
    expect(!r5.ok && r5.offline).toBe(true);
    const r4 = await callPixo("x", "u", {}, deps(answer(400)));
    expect(!r4.ok && !r4.offline).toBe(true);
    expect((await callPixo("x", "u", {}, deps(answer(200)))).ok).toBe(true);
  });

  test("a throwing reporter still doesn't throw", async () => {
    const r = await callPixo("x", "u", {}, { fetchImpl: refused, report: () => { throw new Error("audit down"); }, timeoutMs: 50 });
    expect(r.ok).toBe(false);
  });
});

describe("pixoStatus", () => {
  const saved = process.env.EXTERNAL_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.EXTERNAL_API_KEY;
    else process.env.EXTERNAL_API_KEY = saved;
  });
  test("not_configured without the key, offline when down, online when up", async () => {
    delete process.env.EXTERNAL_API_KEY;
    expect(await pixoStatus("http://pixo", deps(refused))).toBe("not_configured");
    process.env.EXTERNAL_API_KEY = "k";
    expect(await pixoStatus("http://pixo", deps(refused))).toBe("offline");
    expect(await pixoStatus("http://pixo", deps(hangs))).toBe("offline");
    expect(await pixoStatus("http://pixo", deps(answer(200, { ok: true })))).toBe("online");
  });
});

describe("dmViaPixorpheus", () => {
  test("offline / rejected / sent, never throws", async () => {
    expect(await dmViaPixorpheus("http://pixo/dm", "k", "U0ABC12345", "hi", deps(refused))).toBe("offline");
    expect(await dmViaPixorpheus("http://pixo/dm", "k", "U0ABC12345", "hi", deps(hangs))).toBe("offline");
    expect(await dmViaPixorpheus("http://pixo/dm", "k", "U0ABC12345", "hi", deps(answer(400, { error: "x" })))).toBe("rejected");
    expect(await dmViaPixorpheus("http://pixo/dm", "k", "U0ABC12345", "hi", deps(answer(200, { ok: true })))).toBe("sent");
  });
});

describe("resolveViaPixorpheus", () => {
  const actor = { slackId: "U0ABC12345", username: "Helper" };
  const ts = "1700000000.123456";
  test("an unreachable or timed-out Pixo is 'offline' so the dashboard can resolve on its own", async () => {
    expect(await resolveViaPixorpheus("http://pixo/t", "k", ts, actor, deps(refused))).toBe("offline");
    expect(await resolveViaPixorpheus("http://pixo/t", "k", ts, actor, deps(hangs))).toBe("offline");
    expect(await resolveViaPixorpheus("http://pixo/t", "k", ts, actor, deps(answer(502)))).toBe("offline");
  });
  test("Pixo's own answers are passed through", async () => {
    expect(await resolveViaPixorpheus("http://pixo/t", "k", ts, actor, deps(answer(200, { ok: true })))).toEqual({ ok: true });
    expect(await resolveViaPixorpheus("http://pixo/t", "k", ts, actor, deps(answer(400, { error: "Ticket already resolved" })))).toEqual({
      ok: true,
      alreadyClosed: true,
    });
    expect(await resolveViaPixorpheus("http://pixo/t", "k", ts, actor, deps(answer(404)))).toEqual({
      ok: false,
      error: "No ticket found for this message.",
    });
  });
  test("the offline notice tells staff what happened", () => {
    expect(PIXO_OFFLINE_RESOLVE_NOTICE).toContain("Pixo is offline");
  });
});
