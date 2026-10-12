import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { issueSessionToken } from "../auth/session.js";
import { db } from "../db/pgCompat.js";
import { bearer, testAuthGate } from "../http/testkit.js";
import showNTellRouter from "./showNTell.js";

async function vote(upsertError: { code: string } | null) {
  const ops: { table: string; op: string; payload?: unknown; opts?: unknown }[] = [];
  const realFrom = db.from;
  db.from = ((table: string) => {
    const data: Record<string, unknown> = {
      show_n_tell_entries: { id: 9, round_id: 4, project_id: null },
      show_n_tell_rounds: { is_open: true },
    };
    let result: { data: unknown; error: unknown } = { data: data[table] ?? null, error: null };
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "single"]) c[m] = () => c;
    // A list query (no maybeSingle) gets the row wrapped in an array.
    if (table === "show_n_tell_entries") result = { data: [data[table]], error: null };
    c.maybeSingle = () => {
      result = { data: data[table] ?? null, error: null };
      return c;
    };
    c.upsert = (payload: unknown, opts: unknown) => {
      ops.push({ table, op: "upsert", payload, opts });
      result = { data: null, error: upsertError };
      return c;
    };
    for (const m of ["insert", "delete"])
      c[m] = (payload?: unknown) => {
        ops.push({ table, op: m, payload });
        result = { data: null, error: null };
        return c;
      };
    c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return c;
  }) as unknown as typeof db.from;
  const app = express();
  app.use(express.json());
  app.use(testAuthGate());
  app.use(showNTellRouter);
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  try {
    const token = issueSessionToken({ client: "web", userId: "voter", displayName: "V" });
    const res = await fetch(`http://127.0.0.1:${port}/api/show-n-tell/entries/9/vote`, {
      method: "POST",
      headers: { "content-type": "application/json", ...bearer(token) },
      body: "{}",
    });
    return { status: res.status, ops: ops.filter((o) => o.table === "show_n_tell_votes") };
  } finally {
    db.from = realFrom;
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe("show-n-tell vote", () => {
  test("one atomic upsert on (round_id, user_id), no delete-then-insert race", async () => {
    const r = await vote(null);
    expect(r.status).toBe(200);
    expect(r.ops).toEqual([
      { table: "show_n_tell_votes", op: "upsert", payload: { entry_id: 9, user_id: "voter", round_id: 4 }, opts: { onConflict: "round_id,user_id" } },
    ]);
  });

  test("before 0217 is applied it falls back to delete + insert", async () => {
    const r = await vote({ code: "42P10" });
    expect(r.status).toBe(200);
    expect(r.ops.map((o) => o.op)).toEqual(["upsert", "delete", "insert"]);
  });

  test("any other upsert error is a 500", async () => {
    expect((await vote({ code: "23503" })).status).toBe(500);
  });
});
