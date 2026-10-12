import { afterEach, describe, expect, test } from "bun:test";
import { callPixo, type PixoCallDeps } from "./pixoCall.js";
import { requestPixlChannelEnrollment } from "./pixlSlack.js";
import { dmReviewerOfResubmit } from "./shipNotify.js";
import { sendModerationDm } from "./moderation.js";

// Pixo is stopped at relaunch: every server -> Pixo call must time out fast,
// never throw and report the failure, so no player action stalls on it.

const refused: PixoCallDeps["fetchImpl"] = async () => {
  throw new TypeError("fetch failed: ECONNREFUSED");
};
const hangs: PixoCallDeps["fetchImpl"] = (_u, init) =>
  new Promise((_, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });
const status = (code: number): PixoCallDeps["fetchImpl"] => async () => new Response("{}", { status: code });

describe("callPixo", () => {
  test("refused, timed out and 5xx are offline and reported; 4xx is not offline", async () => {
    const reports: string[] = [];
    const report = (label: string, reason: string) => void reports.push(`${label}: ${reason}`);
    const a = await callPixo("dm", "http://pixo/x", {}, { fetchImpl: refused, report, timeoutMs: 50 });
    const started = Date.now();
    const b = await callPixo("dm", "http://pixo/x", {}, { fetchImpl: hangs, report, timeoutMs: 50 });
    expect(Date.now() - started).toBeLessThan(2000);
    const c = await callPixo("dm", "http://pixo/x", {}, { fetchImpl: status(503), report, timeoutMs: 50 });
    const d = await callPixo("dm", "http://pixo/x", {}, { fetchImpl: status(400), report, timeoutMs: 50 });
    expect([a, b, c].every((r) => !r.ok && r.offline)).toBe(true);
    expect(!d.ok && !d.offline).toBe(true);
    expect(reports).toEqual(["dm: unreachable: fetch failed: ECONNREFUSED", "dm: timeout", "dm: http 503", "dm: http 400"]);
    expect((await callPixo("dm", "u", {}, { fetchImpl: status(200), report })).ok).toBe(true);
  });

  test("a throwing reporter doesn't escape", async () => {
    const r = await callPixo("x", "u", {}, { fetchImpl: refused, report: () => { throw new Error("no"); }, timeoutMs: 50 });
    expect(r.ok).toBe(false);
  });
});

describe("call sites survive a dead Pixo", () => {
  const saved = process.env.EXTERNAL_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.EXTERNAL_API_KEY;
    else process.env.EXTERNAL_API_KEY = saved;
  });
  const quiet = { report: () => {}, timeoutMs: 50 };

  test("channel enrollment reports failed, never throws, on refused or hung Pixo", async () => {
    const settings = { apiKey: "k", url: "http://pixo" };
    expect(await requestPixlChannelEnrollment("U0123456789", settings, refused!, undefined, quiet)).toEqual({ kind: "failed" });
    expect(await requestPixlChannelEnrollment("U0123456789", settings, hangs!, undefined, quiet)).toEqual({ kind: "failed" });
  });

  test("moderation DM resolves false instead of throwing", async () => {
    process.env.EXTERNAL_API_KEY = "k";
    expect(await sendModerationDm("U0123456789", "warned", { fetchImpl: refused, ...quiet })).toBe(false);
    expect(await sendModerationDm("U0123456789", "warned", { fetchImpl: hangs, ...quiet })).toBe(false);
    expect(await sendModerationDm("U0123456789", "warned", { fetchImpl: status(200), ...quiet })).toBe(true);
  });

  test("resubmit DM to the reviewer completes when Pixo is down", async () => {
    process.env.EXTERNAL_API_KEY = "k";
    await expect(dmReviewerOfResubmit("U0123456789", { id: 1, name: "x" }, { fetchImpl: refused, ...quiet })).resolves.toBeUndefined();
    await expect(dmReviewerOfResubmit("U0123456789", { id: 1, name: "x" }, { fetchImpl: hangs, ...quiet })).resolves.toBeUndefined();
  });
});
