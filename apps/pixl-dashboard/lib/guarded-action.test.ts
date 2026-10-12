import { describe, expect, mock, test } from "bun:test";
import { z } from "zod";
import { createGuardedAction, json, type ActionLogLine } from "./guarded-action-core";

const session = { userId: "u1", displayName: "Ada", slackId: "U123" };

function setup(opts: { auth?: boolean; response?: Response | (() => Response) } = {}) {
  const logs: ActionLogLine[] = [];
  const revalidated: string[] = [];
  const fetchImpl = mock(async (_url: string, _init?: RequestInit) => {
    const r = opts.response ?? new Response(JSON.stringify({ ok: true, id: 7 }), { status: 200 });
    return typeof r === "function" ? r() : r;
  });
  const guardedAction = createGuardedAction({
    getAuth: async () => (opts.auth === false ? null : { token: "tok-abc", session }),
    fetchImpl: fetchImpl as unknown as typeof fetch,
    log: (l) => logs.push(l),
    revalidate: (p) => revalidated.push(p),
    now: () => new Date("2026-10-11T00:00:00Z"),
  });
  return { guardedAction, logs, revalidated, fetchImpl };
}

const schema = z.object({ id: z.number().int().positive() });

describe("guardedAction", () => {
  test("requires a session and never calls the server without one", async () => {
    const { guardedAction, logs, fetchImpl } = setup({ auth: false });
    const act = guardedAction("shop.buy", schema, (i) => ({ method: "POST", path: `/api/shop/claim/${i.id}` }));
    expect(await act({ id: 1 })).toEqual({ ok: false, error: "unauthorized" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ action: "shop.buy", result: "denied", userId: null });
  });

  test("rejects invalid input before calling the server", async () => {
    const { guardedAction, logs, fetchImpl } = setup();
    const act = guardedAction("shop.buy", schema, (i) => ({ method: "POST", path: `/api/shop/claim/${i.id}` }));
    expect(await act({ id: -3 })).toEqual({ ok: false, error: "invalid_input" });
    expect(await act({ id: "1; drop" } as unknown as { id: number })).toEqual({ ok: false, error: "invalid_input" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logs.every((l) => l.result === "invalid" && l.userId === "u1")).toBe(true);
  });

  test("calls exactly one endpoint with a Bearer header and returns typed data", async () => {
    const { guardedAction, logs, revalidated, fetchImpl } = setup();
    const act = guardedAction(
      "shop.buy",
      schema,
      (i) => ({ method: "POST", path: `/api/shop/claim/${i.id}`, body: json({ qty: 1 }), target: `item:${i.id}` }),
      { revalidate: ["/shop"], pick: (d: { id: number }) => ({ id: d.id }) },
    );
    const res = await act({ id: 5 });
    expect(res).toEqual({ ok: true, data: { id: 7 } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://server.pixl.hackclub.com/api/shop/claim/5");
    expect(url).not.toContain("token=");
    const headers = new Headers(init!.headers);
    expect(headers.get("authorization")).toBe("Bearer tok-abc");
    expect(init!.method).toBe("POST");
    expect(init!.body).toBe(JSON.stringify({ qty: 1 }));
    expect(revalidated).toEqual(["/shop"]);
    expect(logs).toEqual([
      {
        app: "pixl-dashboard",
        action: "shop.buy",
        userId: "u1",
        slackId: "U123",
        target: "item:5",
        result: "ok",
        status: 200,
        error: null,
        at: "2026-10-11T00:00:00.000Z",
      },
    ]);
  });

  test("maps server errors to { ok:false, error } and logs them", async () => {
    const { guardedAction, logs, revalidated } = setup({
      response: () => new Response(JSON.stringify({ error: "out_of_stock" }), { status: 409 }),
    });
    const act = guardedAction("shop.buy", schema, (i) => ({ method: "POST", path: `/api/shop/claim/${i.id}` }), {
      revalidate: ["/shop"],
    });
    expect(await act({ id: 2 })).toEqual({ ok: false, error: "out_of_stock" });
    expect(revalidated).toEqual([]);
    expect(logs[0]).toMatchObject({ result: "error", status: 409, error: "out_of_stock" });
  });

  test("treats a 200 with ok:false as a failure", async () => {
    const { guardedAction } = setup({
      response: () => new Response(JSON.stringify({ ok: false, error: "not_eligible" }), { status: 200 }),
    });
    const act = guardedAction("x", schema, () => ({ method: "POST", path: "/api/x" }));
    expect(await act({ id: 1 })).toEqual({ ok: false, error: "not_eligible" });
  });

  test("a server 401 reads as unauthorized and is logged as denied", async () => {
    const { guardedAction, logs } = setup({ response: () => new Response("{}", { status: 401 }) });
    const act = guardedAction("x", schema, () => ({ method: "DELETE", path: "/api/x/1" }));
    expect(await act({ id: 1 })).toEqual({ ok: false, error: "unauthorized" });
    expect(logs[0].result).toBe("denied");
  });

  test("a handler producing a path traversal is refused without a request", async () => {
    const { guardedAction, fetchImpl } = setup();
    const act = guardedAction("x", z.object({ p: z.string() }), (i) => ({ method: "GET", path: `/api/${i.p}` }));
    const res = await act({ p: "../admin" });
    expect(res.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
