import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { issueSessionToken } from "../auth/session.js";
import { db } from "../db/pgCompat.js";
import { bearer, testAuthGate } from "../http/testkit.js";
import collaboratorsRouter from "./collaborators.js";

type Tables = Record<string, { data: unknown; error: unknown }>;

function chainable(result: { data: unknown; error: unknown }, writes: unknown[], table: string) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "in", "order", "limit", "maybeSingle", "single"]) chain[m] = () => chain;
  for (const m of ["update", "insert"])
    chain[m] = (payload: unknown) => {
      writes.push({ table, op: m, payload });
      result = { data: null, error: null };
      return chain;
    };
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

async function call(tables: Tables, path: string, body: Record<string, unknown>, userId = "player") {
  const writes: unknown[] = [];
  const realFrom = db.from;
  db.from = ((table: string) =>
    chainable(tables[table] ?? { data: null, error: null }, writes, table)) as unknown as typeof db.from;
  const app = express();
  app.use(express.json());
  app.use(testAuthGate());
  app.use(collaboratorsRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const token = issueSessionToken({ client: "web", userId, displayName: "P" });
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...bearer(token) },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown>, writes };
  } finally {
    db.from = realFrom;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("POST /api/collaborators/redeem", () => {
  const project = { data: { id: 7, name: "P", user_id: "owner" }, error: null };

  test("a removed collaborator can't rejoin with an old code", async () => {
    const r = await call(
      { projects: project, project_collaborators: { data: { id: 3, status: "removed" }, error: null } },
      "/api/collaborators/redeem",
      { code: "ABC-DEF" },
    );
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("removed");
    expect(r.writes).toHaveLength(0);
  });

  test("a player who declined earlier can still join with the code", async () => {
    const r = await call(
      { projects: project, project_collaborators: { data: { id: 3, status: "declined" }, error: null } },
      "/api/collaborators/redeem",
      { code: "ABC-DEF" },
    );
    expect(r.status).toBe(200);
  });
});

describe("POST /api/projects/:id/collaborators/code/rotate", () => {
  test("the owner gets a fresh code", async () => {
    const r = await call(
      { projects: { data: { id: 7, user_id: "owner" }, error: null } },
      "/api/projects/7/collaborators/code/rotate",
      {},
      "owner",
    );
    expect(r.status).toBe(200);
    expect(String(r.body.code)).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    expect(r.writes).toHaveLength(1);
  });

  test("anyone else is refused and nothing changes", async () => {
    const r = await call({ projects: { data: null, error: null } }, "/api/projects/7/collaborators/code/rotate", {}, "intruder");
    expect(r.status).toBe(404);
    expect(r.writes).toHaveLength(0);
  });
});
