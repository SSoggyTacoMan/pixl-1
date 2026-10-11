import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { pickDetails } from "./action-details";
import { createGuardedAction } from "./guarded-action-core";

describe("pickDetails", () => {
  test("copies only whitelisted primitive fields", () => {
    expect(
      pickDetails({
        ok: false,
        error: "trial_hours_below_minimum",
        need: 5,
        have: 1.2,
        message: "<b>raw server text</b>",
        hca_status: "pending",
        secret: "x",
        nested: { need: 9 },
      }),
    ).toEqual({ need: 5, have: 1.2, hcaStatus: "pending" });
  });

  test("drops wrong types, non-finite numbers and odd strings", () => {
    expect(
      pickDetails({ need: "5", have: Number.NaN, hours: Infinity, xp: 1e15, hca_status: "Pending<script>", region: "x".repeat(40) }),
    ).toBeUndefined();
    expect(pickDetails({ region: "US" })).toEqual({ region: "US" });
  });

  test("ignores non-object bodies", () => {
    expect(pickDetails(null)).toBeUndefined();
    expect(pickDetails("need")).toBeUndefined();
    expect(pickDetails([1, 2])).toBeUndefined();
    expect(pickDetails({ error: "x" })).toBeUndefined();
  });
});

describe("guardedAction details", () => {
  function act(body: unknown, status: number) {
    const guardedAction = createGuardedAction({
      getAuth: async () => ({ token: "t", session: { userId: "u1", displayName: "A", slackId: "U1" } }),
      fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch,
      log: () => {},
      revalidate: () => {},
    });
    return guardedAction("project.ship", z.object({ id: z.number() }), (i) => ({ method: "POST", path: `/api/projects/${i.id}/ship` }));
  }

  test("failure results carry the whitelisted details", async () => {
    const res = await act({ ok: false, error: "journal_too_short", need: 200, hours: 2, message: "hi" }, 400)({ id: 1 });
    expect(res).toEqual({ ok: false, error: "journal_too_short", details: { need: 200, hours: 2 } });
  });

  test("no details key when the body has none", async () => {
    const res = await act({ ok: false, error: "out_of_stock" }, 409)({ id: 1 });
    expect(res).toStrictEqual({ ok: false, error: "out_of_stock" });
  });

  test("401 never carries details", async () => {
    const res = await act({ error: "x", need: 1 }, 401)({ id: 1 });
    expect(res).toStrictEqual({ ok: false, error: "unauthorized" });
  });
});
