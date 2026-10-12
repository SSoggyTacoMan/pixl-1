import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { issueSessionToken, verifySessionToken } from "../auth/session.js";
import { db } from "../db/pgCompat.js";
import authRouter from "./auth.js";

const STATE = "client-state-0123456789";
const DASHBOARD_CALLBACK = "https://pixl.hackclub.com/api/auth/callback";
const DASHBOARD_KEY = "d".repeat(48);
const INTERNAL_KEY = "i".repeat(48);
process.env.SERVICE_KEY_PIXL_DASHBOARD = DASHBOARD_KEY;
process.env.SERVICE_KEY_INTERNAL_DASHBOARD = INTERNAL_KEY;

async function startTestApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function chainable(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select", "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is",
    "contains", "not", "match", "or", "order", "limit", "range", "insert",
    "upsert", "update", "delete", "single", "maybeSingle",
  ];
  for (const m of methods) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

// Simulates the exact race: the pre-insert lookup finds nothing (both
// concurrent requests see this), the insert then hits a unique constraint
// (the "other" concurrent request won), and the code should fall back to
// fetching the row that won instead of 500ing - but only when the constraint
// that fired is actually users_oauth_provider_oauth_id_key (drizzle/
// 0177_users_oauth_unique.sql), not just any 23505 on `users` (it already has
// another unique constraint, on referral_code).
function mockUsersRace(
  winnerRow: Record<string, unknown>,
  constraintName = "users_oauth_provider_oauth_id_key",
) {
  const realFrom = db.from;
  let usersCalls = 0;
  db.from = ((table: string) => {
    if (table !== "users") return chainable({ data: [], error: null }) as ReturnType<typeof realFrom>;
    usersCalls++;
    if (usersCalls === 1) return chainable({ data: [], error: null }) as ReturnType<typeof realFrom>;
    if (usersCalls === 2)
      return chainable({
        data: null,
        error: {
          code: "23505",
          message: `duplicate key value violates unique constraint "${constraintName}"`,
          constraintName,
        },
      }) as ReturnType<typeof realFrom>;
    return chainable({ data: winnerRow, error: null }) as ReturnType<typeof realFrom>;
  }) as typeof db.from;
  return {
    usersInsertAttempts: () => usersCalls,
    restore: () => {
      db.from = realFrom;
    },
  };
}

// A plain in-memory users table for the non-race paths: a real select-miss
// then insert-success (new signup), or a select-hit (existing login), with
// state that's actually consistent between calls - unlike mockUsersRace,
// which deliberately makes select and insert disagree to simulate a race.
function mockUsersTable(initialRows: Record<string, unknown>[] = []) {
  const realFrom = db.from;
  const rows = [...initialRows];
  const inserted: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  let nextId = 1;

  function usersChain() {
    let filters: Record<string, unknown> = {};
    let insertPayload: Record<string, unknown> | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    // .maybeSingle() selects return one row (or null), like db-js.
    let one = false;
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        filters = { ...filters, [col]: val };
        return chain;
      },
      limit: () => chain,
      single: () => chain,
      maybeSingle: () => {
        one = true;
        return chain;
      },
      insert: (row: Record<string, unknown>) => {
        insertPayload = row;
        return chain;
      },
      update: (payload: Record<string, unknown>) => {
        updatePayload = payload;
        return chain;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        let result: { data: unknown; error: unknown };
        if (updatePayload) {
          updates.push(updatePayload);
          result = { data: null, error: null };
        } else if (insertPayload) {
          const row = { id: `user-${nextId++}`, ...insertPayload };
          rows.push(row);
          inserted.push(row);
          result = { data: row, error: null };
        } else {
          const matches = rows.filter((r) =>
            Object.entries(filters).every(([k, v]) => r[k] === v),
          );
          result = { data: one ? (matches[0] ?? null) : matches, error: null };
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return chain;
  }

  db.from = ((table: string) => {
    if (table === "users") return usersChain() as ReturnType<typeof realFrom>;
    return chainable({ data: [], error: null }) as ReturnType<typeof realFrom>;
  }) as typeof db.from;

  return {
    insertedRows: () => inserted,
    updatedRows: () => updates,
    restore: () => {
      db.from = realFrom;
    },
  };
}

function mockHcaFetch(identity: Record<string, unknown>) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.includes("/oauth/token")) {
      return new Response(
        JSON.stringify({ access_token: "fake-token", token_type: "bearer", expires_in: 3600, refresh_token: "r", scope: "" }),
        { status: 200 },
      );
    }
    if (href.includes("/api/v1/me")) {
      return new Response(JSON.stringify({ identity, scopes: [] }), { status: 200 });
    }
    return realFetch(url as string, init);
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

function exchangeRaw(baseUrl: string, code: string) {
  return fetch(`${baseUrl}/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://play.pixl.hackclub.com" },
    body: JSON.stringify({ code }),
  });
}

// Trades the code on a callback redirect for the session, as the game does.
async function exchange(baseUrl: string, target: URL) {
  const res = await exchangeRaw(baseUrl, target.searchParams.get("code") ?? "");
  expect(res.status).toBe(200);
  return (await res.json()) as {
    token: string;
    user: { id: string; displayName: string; slackId: string | null };
    isNew: boolean;
    needsLegalName: boolean;
  };
}

const DEFAULT_START = `?redirect=${encodeURIComponent("https://play.pixl.hackclub.com/")}&state=${STATE}`;

async function driveHcaCallback(baseUrl: string, startQuery = DEFAULT_START) {
  const startRes = await fetch(`${baseUrl}/auth/hackclub${startQuery}`, { redirect: "manual" });
  const location = startRes.headers.get("location")!;
  const state = new URL(location).searchParams.get("state")!;
  return fetch(`${baseUrl}/auth/hackclub/callback?code=fake-code&state=${state}`, {
    redirect: "manual",
  });
}

describe("GET /auth/hackclub/callback", () => {
  test("a losing concurrent signup logs into the winner's account instead of 500ing", async () => {
    const winnerRow = {
      id: "winner-user-id",
      oauth_provider: "hackclub",
      oauth_id: "hca-race-identity",
      display_name: "Race Winner",
      real_name: "Race Winner",
    };
    const race = mockUsersRace(winnerRow);
    const hca = mockHcaFetch({ id: "hca-race-identity", first_name: "Race", last_name: "Winner" });
    const app = await startTestApp();
    try {
      const callbackRes = await driveHcaCallback(app.baseUrl);

      expect(callbackRes.status).toBe(302);
      const grant = await exchange(app.baseUrl, new URL(callbackRes.headers.get("location")!));
      const session = verifySessionToken(grant.token);
      expect(session?.userId).toBe("winner-user-id");
      // Never claims the "new signup" path for the race's loser.
      expect(grant.isNew).toBe(false);
      // select (miss) -> insert (23505) -> select (post-race refetch)
      expect(race.usersInsertAttempts()).toBe(3);
    } finally {
      race.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a 23505 on an unrelated constraint still 500s instead of being treated as the identity race", async () => {
    // users also has a unique constraint on referral_code (drizzle/
    // 0073_referrals.sql) - a 23505 from that has nothing to do with the
    // signup race and must not be swallowed into a fake "login succeeded".
    const race = mockUsersRace(
      { id: "should-not-be-used" },
      "users_referral_code_key",
    );
    const hca = mockHcaFetch({ id: "hca-unrelated-conflict", first_name: "Some", last_name: "Body" });
    const app = await startTestApp();
    try {
      const callbackRes = await driveHcaCallback(app.baseUrl);

      expect(callbackRes.status).toBe(500);
      // Never reached the post-race refetch - only lookup + failed insert.
      expect(race.usersInsertAttempts()).toBe(2);
    } finally {
      race.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a brand new HCA identity creates exactly one account and is flagged as a new signup", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-fresh-identity", first_name: "Fresh", last_name: "User" });
    const app = await startTestApp();
    try {
      const callbackRes = await driveHcaCallback(app.baseUrl);

      expect(callbackRes.status).toBe(302);
      const grant = await exchange(app.baseUrl, new URL(callbackRes.headers.get("location")!));
      expect(grant.isNew).toBe(true);
      const session = verifySessionToken(grant.token);
      expect(session?.userId).toBe(users.insertedRows()[0]?.id);
      // Exactly one users row ever gets created for this identity.
      expect(users.insertedRows()).toHaveLength(1);
      expect(users.insertedRows()[0]?.oauth_id).toBe("hca-fresh-identity");
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("an already-registered HCA identity logs into the same account without inserting", async () => {
    const users = mockUsersTable([
      {
        id: "existing-user-id",
        oauth_provider: "hackclub",
        oauth_id: "hca-existing-identity",
        display_name: "Returning Player",
        real_name: "Returning Player",
        avatar_url: "https://example.com/avatar.png",
      },
    ]);
    const hca = mockHcaFetch({ id: "hca-existing-identity", first_name: "Returning", last_name: "Player" });
    const app = await startTestApp();
    try {
      const callbackRes = await driveHcaCallback(app.baseUrl);

      expect(callbackRes.status).toBe(302);
      const grant = await exchange(app.baseUrl, new URL(callbackRes.headers.get("location")!));
      const session = verifySessionToken(grant.token);
      expect(session?.userId).toBe("existing-user-id");
      expect(grant.isNew).toBe(false);
      // No new row was ever created for a login that already had one.
      expect(users.insertedRows()).toHaveLength(0);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });
});

async function loginWith(identity: Record<string, unknown>, existingRows: Record<string, unknown>[] = []) {
  const users = mockUsersTable(existingRows);
  const hca = mockHcaFetch(identity);
  const app = await startTestApp();
  try {
    const res = await driveHcaCallback(app.baseUrl);
    return {
      status: res.status,
      body: res.status === 403 ? await res.text() : "",
      location: res.headers.get("location"),
      inserted: users.insertedRows(),
      updated: users.updatedRows(),
    };
  } finally {
    users.restore();
    hca.restore();
    await app.close();
  }
}

describe("GET /auth/hackclub/callback -> HCA eligibility", () => {
  const base = { first_name: "Some", last_name: "Player" };

  test("needs_submission creates an account and stores the status", async () => {
    const r = await loginWith({ ...base, id: "hca-needs-submission", verification_status: "needs_submission" });
    expect(r.status).toBe(302);
    expect(r.inserted).toHaveLength(1);
    expect(r.inserted[0]?.hca_verification_status).toBe("needs_submission");
    expect(r.inserted[0]?.hca_ysws_eligible).toBeNull();
  });

  test("pending creates an account and stores the status", async () => {
    const r = await loginWith({ ...base, id: "hca-pending", verification_status: "pending" });
    expect(r.status).toBe(302);
    expect(r.inserted).toHaveLength(1);
    expect(r.inserted[0]?.hca_verification_status).toBe("pending");
  });

  test("verified and ysws_eligible creates an account and stores both claims", async () => {
    const r = await loginWith({
      ...base,
      id: "hca-verified-eligible",
      verification_status: "verified",
      ysws_eligible: true,
    });
    expect(r.status).toBe(302);
    expect(r.inserted).toHaveLength(1);
    expect(r.inserted[0]?.hca_verification_status).toBe("verified");
    expect(r.inserted[0]?.hca_ysws_eligible).toBe(true);
  });

  test("verified but not ysws_eligible is rejected with no account", async () => {
    const r = await loginWith({
      ...base,
      id: "hca-verified-not-eligible",
      verification_status: "verified",
      ysws_eligible: false,
    });
    expect(r.status).toBe(403);
    expect(r.body).toContain("isn't eligible");
    expect(r.inserted).toHaveLength(0);
  });

  test("verified with no ysws_eligible claim is rejected with no account", async () => {
    const r = await loginWith({ ...base, id: "hca-verified-no-claim", verification_status: "verified" });
    expect(r.status).toBe(403);
    expect(r.inserted).toHaveLength(0);
  });

  test("ineligible is rejected with no account", async () => {
    const r = await loginWith({ ...base, id: "hca-ineligible", verification_status: "ineligible" });
    expect(r.status).toBe(403);
    expect(r.body).toContain("isn't eligible");
    expect(r.inserted).toHaveLength(0);
  });

  test("a missing status still creates an account, with no state stored", async () => {
    const r = await loginWith({ ...base, id: "hca-no-status" });
    expect(r.status).toBe(302);
    expect(r.inserted).toHaveLength(1);
    expect(r.inserted[0]).not.toHaveProperty("hca_verification_status");
    expect(r.inserted[0]).not.toHaveProperty("hca_ysws_eligible");
  });

  test("an existing user with an ineligible status still logs in and their state is refreshed", async () => {
    const r = await loginWith(
      { ...base, id: "hca-existing-ineligible", verification_status: "ineligible", ysws_eligible: false },
      [
        {
          id: "existing-user-id",
          oauth_provider: "hackclub",
          oauth_id: "hca-existing-ineligible",
          display_name: "Returning Player",
          real_name: "Returning Player",
          avatar_url: "https://example.com/avatar.png",
        },
      ],
    );
    expect(r.status).toBe(302);
    expect(new URL(r.location!).searchParams.get("code")).toBeTruthy();
    expect(r.inserted).toHaveLength(0);
    const refresh = r.updated.find((u) => "hca_verification_status" in u);
    expect(refresh?.hca_verification_status).toBe("ineligible");
    expect(refresh?.hca_ysws_eligible).toBe(false);
  });

  test("an existing user picks up a newly verified state on login", async () => {
    const r = await loginWith(
      { ...base, id: "hca-existing-verified", verification_status: "verified", ysws_eligible: true },
      [
        {
          id: "existing-user-id",
          oauth_provider: "hackclub",
          oauth_id: "hca-existing-verified",
          display_name: "Returning Player",
          real_name: "Returning Player",
          avatar_url: "https://example.com/avatar.png",
        },
      ],
    );
    expect(r.status).toBe(302);
    const refresh = r.updated.find((u) => "hca_verification_status" in u);
    expect(refresh?.hca_verification_status).toBe("verified");
    expect(refresh?.hca_ysws_eligible).toBe(true);
  });

  test("an existing user's stored state is not wiped when HCA sends no status", async () => {
    const r = await loginWith({ ...base, id: "hca-existing-no-status" }, [
      {
        id: "existing-user-id",
        oauth_provider: "hackclub",
        oauth_id: "hca-existing-no-status",
        display_name: "Returning Player",
        real_name: "Returning Player",
        avatar_url: "https://example.com/avatar.png",
      },
    ]);
    expect(r.status).toBe(302);
    for (const u of r.updated) {
      expect(u).not.toHaveProperty("hca_verification_status");
      expect(u).not.toHaveProperty("hca_ysws_eligible");
    }
  });
});

// The initial display_name on signup comes from HCA/Slack, sources the
// player doesn't control the character set of. A later rename rejects a
// bad name via nameProblem() (routes/profile.ts) , signup must run the
// same check or a nasty/malformed name slips in before any rename ever
// happens.
describe("GET /auth/hackclub/callback -> new signup display_name validation", () => {
  const FALLBACK_PATTERN = /^user_[a-zA-Z0-9]{1,8}$/;

  test("a normal HCA name is stored as-is", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-name-ok", first_name: "Ada", last_name: "Lovelace" });
    const app = await startTestApp();
    try {
      await driveHcaCallback(app.baseUrl);
      expect(users.insertedRows()[0]?.display_name).toBe("Ada Lovelace");
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a <script> tag in the HCA name never reaches display_name", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-name-xss", first_name: "<script>alert(1)</script>" });
    const app = await startTestApp();
    try {
      await driveHcaCallback(app.baseUrl);
      const stored = users.insertedRows()[0]?.display_name as string;
      expect(stored).not.toContain("<script>");
      expect(stored).toMatch(FALLBACK_PATTERN);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a nasty Slack fallback name never reaches display_name", async () => {
    const users = mockUsersTable([]);
    const originalToken = process.env.SLACK_BOT_TOKEN;
    process.env.SLACK_BOT_TOKEN = "fake-token";
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString();
      if (href.includes("/oauth/token")) {
        return new Response(
          JSON.stringify({
            access_token: "fake-token",
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: "r",
            scope: "",
          }),
          { status: 200 },
        );
      }
      if (href.includes("/api/v1/me")) {
        return new Response(
          JSON.stringify({
            identity: { id: "hca-slack-nasty", slack_id: "U999NASTY" },
            scopes: [],
          }),
          { status: 200 },
        );
      }
      if (href.includes("slack.com/api/users.info")) {
        return new Response(
          JSON.stringify({ ok: true, user: { real_name: "<img src=x onerror=alert(1)>" } }),
          { status: 200 },
        );
      }
      return realFetch(url as string, init);
    }) as typeof fetch;
    const app = await startTestApp();
    try {
      await driveHcaCallback(app.baseUrl);
      const stored = users.insertedRows()[0]?.display_name as string;
      expect(stored).not.toContain("<img");
      expect(stored).toMatch(FALLBACK_PATTERN);
    } finally {
      globalThis.fetch = realFetch;
      if (originalToken === undefined) delete process.env.SLACK_BOT_TOKEN;
      else process.env.SLACK_BOT_TOKEN = originalToken;
      users.restore();
      await app.close();
    }
  });

  test("a name over 24 characters falls back to the generated placeholder", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({
      id: "hca-name-long",
      first_name: "Reallylongfirstnamehere",
      last_name: "AndAnEvenLongerLastName",
    });
    const app = await startTestApp();
    try {
      await driveHcaCallback(app.baseUrl);
      const stored = users.insertedRows()[0]?.display_name as string;
      expect(stored.length).toBeLessThanOrEqual(24);
      expect(stored).toMatch(FALLBACK_PATTERN);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a valid Unicode name is stored as-is", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-name-unicode", first_name: "José", last_name: "García" });
    const app = await startTestApp();
    try {
      await driveHcaCallback(app.baseUrl);
      expect(users.insertedRows()[0]?.display_name).toBe("José García");
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a blocked word in the HCA name falls back to the generated placeholder", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-name-blocked", first_name: "idiot" });
    const app = await startTestApp();
    try {
      await driveHcaCallback(app.baseUrl);
      const stored = users.insertedRows()[0]?.display_name as string;
      expect(stored).not.toBe("idiot");
      expect(stored).toMatch(FALLBACK_PATTERN);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });
});

describe("GET /auth/hackclub redirect allowlist", () => {
  const start = (baseUrl: string, redirect: string) =>
    fetch(`${baseUrl}/auth/hackclub?redirect=${encodeURIComponent(redirect)}&state=${STATE}`, { redirect: "manual" });

  test("the game and the Pixl Dashboard are accepted", async () => {
    const app = await startTestApp();
    try {
      for (const ok of ["https://play.pixl.hackclub.com/", "https://pixl.hackclub.com/api/auth/callback"]) {
        const res = await start(app.baseUrl, ok);
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toStartWith("https://auth.hackclub.com/oauth/authorize");
      }
    } finally {
      await app.close();
    }
  });

  test("localhost, other hosts, http and look-alikes are refused", async () => {
    const app = await startTestApp();
    try {
      for (const bad of [
        "http://localhost:7777/callback",
        "https://localhost/callback",
        "http://127.0.0.1:3000/",
        "http://play.pixl.hackclub.com/",
        "https://evil.example/",
        "https://play.pixl.hackclub.com.evil.example/",
        "https://dash.pixl.hackclub.com/",
        "https://user:pass@play.pixl.hackclub.com/",
        "javascript:alert(1)",
        "/relative",
        // A login code may only land on the two pages that exchange it.
        "https://pixl.hackclub.com/account",
        "https://pixl.hackclub.com/api/auth/callback?next=/x",
        "https://play.pixl.hackclub.com/?x=1",
        "https://play.pixl.hackclub.com/shop",
      ]) {
        const res = await start(app.baseUrl, bad);
        expect(res.status).toBe(400);
      }
    } finally {
      await app.close();
    }
  });

  test("a missing or malformed state is refused", async () => {
    const app = await startTestApp();
    try {
      const redirect = encodeURIComponent("https://play.pixl.hackclub.com/");
      expect((await fetch(`${app.baseUrl}/auth/hackclub?redirect=${redirect}`, { redirect: "manual" })).status).toBe(400);
      expect((await fetch(`${app.baseUrl}/auth/hackclub?redirect=${redirect}&state=a%20b`, { redirect: "manual" })).status).toBe(400);
    } finally {
      await app.close();
    }
  });
});

describe("code exchange login", () => {
  test("the callback puts a code and the client state on the redirect, never a token", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-code-identity", first_name: "Code", last_name: "Tester" });
    const app = await startTestApp();
    try {
      const res = await driveHcaCallback(app.baseUrl);
      expect(res.status).toBe(302);
      const target = new URL(res.headers.get("location")!);
      expect(target.origin).toBe("https://play.pixl.hackclub.com");
      expect(target.searchParams.get("state")).toBe(STATE);
      expect(target.searchParams.get("code")).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(target.searchParams.has("token")).toBe(false);
      expect(target.searchParams.has("name")).toBe(false);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a code works exactly once", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-once-identity", first_name: "Once", last_name: "Only" });
    const app = await startTestApp();
    try {
      const target = new URL((await driveHcaCallback(app.baseUrl)).headers.get("location")!);
      const first = await exchangeRaw(app.baseUrl, target.searchParams.get("code")!);
      expect(first.status).toBe(200);
      const body = (await first.json()) as { token: string; user: { id: string; displayName: string }; isNew: boolean; needsLegalName: boolean };
      expect(verifySessionToken(body.token)?.userId).toBe(body.user.id);
      expect(body.user.displayName).toBe("Once Only");
      expect(body.isNew).toBe(true);
      expect(body.needsLegalName).toBe(false);
      const second = await exchangeRaw(app.baseUrl, target.searchParams.get("code")!);
      expect(second.status).toBe(400);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("the exchange is refused from another origin, with no origin, or with a wrong service key", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-caller-identity", first_name: "Caller", last_name: "Check" });
    const app = await startTestApp();
    try {
      const code = new URL((await driveHcaCallback(app.baseUrl)).headers.get("location")!).searchParams.get("code")!;
      const post = (headers: Record<string, string>) =>
        fetch(`${app.baseUrl}/auth/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ code }),
        });
      expect((await post({})).status).toBe(401);
      expect((await post({ Origin: "https://pixl.hackclub.com" })).status).toBe(401);
      expect((await post({ "x-pixl-service-key": "x".repeat(40) })).status).toBe(401);
      // The internal dashboard's key is a real key but not allowed here.
      expect((await post({ "x-pixl-service-key": INTERNAL_KEY })).status).toBe(401);
      // None of those spent the code.
      expect((await post({ Origin: "https://play.pixl.hackclub.com" })).status).toBe(200);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("the token's client comes from the login's redirect, matched by the caller; the body can't override it", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-client-identity", first_name: "Client", last_name: "Kind" });
    const app = await startTestApp();
    const freshCode = async (redirect = "https://play.pixl.hackclub.com/") =>
      new URL(
        (await driveHcaCallback(app.baseUrl, `?redirect=${encodeURIComponent(redirect)}&state=${STATE}`)).headers.get("location")!,
      ).searchParams.get("code")!;
    const webCode = () => freshCode(DASHBOARD_CALLBACK);
    const post = async (headers: Record<string, string>, body: Record<string, unknown>) => {
      const res = await fetch(`${app.baseUrl}/auth/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(200);
      return verifySessionToken(((await res.json()) as { token: string }).token);
    };
    try {
      expect((await post({ "x-pixl-service-key": DASHBOARD_KEY }, { code: await webCode() }))?.client).toBe("web");
      expect((await post({ Origin: "https://play.pixl.hackclub.com" }, { code: await freshCode() }))?.client).toBe("game");
      // A client field in the body is stripped, never honored.
      expect(
        (await post({ Origin: "https://play.pixl.hackclub.com" }, { code: await freshCode(), client: "web" }))?.client,
      ).toBe("game");
      expect(
        (await post({ "x-pixl-service-key": DASHBOARD_KEY }, { code: await webCode(), client: "game" }))?.client,
      ).toBe("web");
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a login code only redeems for the client its login was started for", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-bound-identity", first_name: "Bound", last_name: "Code" });
    const app = await startTestApp();
    const freshCode = async (redirect: string) =>
      new URL(
        (await driveHcaCallback(app.baseUrl, `?redirect=${encodeURIComponent(redirect)}&state=${STATE}`)).headers.get("location")!,
      ).searchParams.get("code")!;
    const post = (headers: Record<string, string>, code: string) =>
      fetch(`${app.baseUrl}/auth/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ code }),
      });
    try {
      // A game login's code, traded by the Pixl Dashboard's backend: refused,
      // and spent (the game can't use it afterwards either).
      const gameCode = await freshCode("https://play.pixl.hackclub.com/");
      expect((await post({ "x-pixl-service-key": DASHBOARD_KEY }, gameCode)).status).toBe(400);
      expect((await post({ Origin: "https://play.pixl.hackclub.com" }, gameCode)).status).toBe(400);
      // A Pixl Dashboard login's code, traded from the game's origin: refused.
      const webCode = await freshCode(DASHBOARD_CALLBACK);
      expect((await post({ Origin: "https://play.pixl.hackclub.com" }, webCode)).status).toBe(400);
      // The matching caller works.
      const ok = await post({ "x-pixl-service-key": DASHBOARD_KEY }, await freshCode(DASHBOARD_CALLBACK));
      expect(ok.status).toBe(200);
      expect(verifySessionToken(((await ok.json()) as { token: string }).token)?.client).toBe("web");
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });

  test("a player with no name on file from HCA needs a legal name", async () => {
    const users = mockUsersTable([]);
    const hca = mockHcaFetch({ id: "hca-nameless-identity", primary_email: "x@example.com" });
    const app = await startTestApp();
    try {
      const grant = await exchange(app.baseUrl, new URL((await driveHcaCallback(app.baseUrl)).headers.get("location")!));
      expect(grant.needsLegalName).toBe(true);
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  });
});

describe("GET /auth/hackclub/callback retry link", () => {
  test("a throttled token exchange offers a retry with the same redirect and state", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/oauth/token")) return new Response("slow your roll!", { status: 429 });
      return realFetch(url as string, init);
    }) as typeof fetch;
    const app = await startTestApp();
    try {
      const redirect = encodeURIComponent("https://pixl.hackclub.com/api/auth/callback");
      const res = await driveHcaCallback(app.baseUrl, `?redirect=${redirect}&state=${STATE}`);
      expect(res.status).toBe(429);
      const href = /href="([^"]+)"/.exec(await res.text())![1].replace(/&#38;/g, "&");
      const retry = new URL(href, "http://x");
      expect(retry.pathname).toBe("/auth/hackclub");
      expect(retry.searchParams.get("redirect")).toBe("https://pixl.hackclub.com/api/auth/callback");
      expect(retry.searchParams.get("state")).toBe(STATE);
    } finally {
      globalThis.fetch = realFetch;
      await app.close();
    }
  });
});

describe("POST /auth/flow/:name", () => {
  test("needs a Bearer session", async () => {
    const app = await startTestApp();
    try {
      const res = await fetch(`${app.baseUrl}/auth/flow/resync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect: "https://pixl.hackclub.com/account" }),
      });
      expect(res.status).toBe(401);
    } finally {
      await app.close();
    }
  });

  test("returns the HCA URL for each flow and refuses unknown flows and bad redirects", async () => {
    // Revocation and ban lookups read users/bans; nothing is revoked or banned.
    const users = mockUsersTable([]);
    const app = await startTestApp();
    const token = issueSessionToken({ client: "web", userId: "flow-user", displayName: "Flow" });
    const post = (name: string, redirect: string) =>
      fetch(`${app.baseUrl}/auth/flow/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ redirect }),
      });
    try {
      for (const name of ["verify-address", "resync", "legal-name"]) {
        const res = await post(name, "https://pixl.hackclub.com/account");
        expect(res.status).toBe(200);
        const body = (await res.json()) as { url: string };
        expect(body.url).toStartWith("https://auth.hackclub.com/oauth/authorize");
        expect(body.url).not.toContain(token);
      }
      expect((await post("demo", "https://pixl.hackclub.com/")).status).toBe(400);
      expect((await post("resync", "http://localhost:7777/callback")).status).toBe(400);
    } finally {
      users.restore();
      await app.close();
    }
  });
});

describe("verify-address identity binding", () => {
  const ADDRESS = { line_1: "1 Victim St", city: "Burlington", country: "US", postal_code: "05401", primary: true };
  async function runVerifyAddress(hcaIdentityId: string) {
    process.env.PII_ENCRYPTION_KEY ??= "a".repeat(64);
    const users = mockUsersTable([{ id: "addr-user", oauth_provider: "hackclub", oauth_id: "hca-addr-owner" }]);
    const hca = mockHcaFetch({ id: hcaIdentityId, addresses: [ADDRESS] });
    const app = await startTestApp();
    try {
      const token = issueSessionToken({ client: "web", userId: "addr-user", displayName: "Addr" });
      const start = await fetch(`${app.baseUrl}/auth/flow/verify-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ redirect: "https://pixl.hackclub.com/account" }),
      });
      expect(start.status).toBe(200);
      const state = new URL(((await start.json()) as { url: string }).url).searchParams.get("state")!;
      const res = await fetch(`${app.baseUrl}/auth/hackclub/callback?code=fake-code&state=${state}`, { redirect: "manual" });
      return { res, updates: users.updatedRows().filter((u) => "address_line1" in u) };
    } finally {
      users.restore();
      hca.restore();
      await app.close();
    }
  }

  test("someone else's HCA consent never writes their address onto the flow starter's account", async () => {
    const { res, updates } = await runVerifyAddress("hca-someone-else");
    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  test("the account's own HCA identity refreshes the address", async () => {
    const { res, updates } = await runVerifyAddress("hca-addr-owner");
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).searchParams.get("addr_verified")).toBe("1");
    expect(updates).toHaveLength(1);
  });
});

describe("removed backdoors", () => {
  test("/auth/demo no longer exists", async () => {
    const app = await startTestApp();
    try {
      const res = await fetch(`${app.baseUrl}/auth/demo?name=anyone`);
      expect(res.status).toBe(404);
    } finally {
      await app.close();
    }
  });
});

describe("ban check fails closed at login", () => {
  test("a bans lookup error issues no login code", async () => {
    const users = mockUsersTable([{ id: "ban-user", oauth_provider: "hackclub", oauth_id: "hca-ban-check", display_name: "B" }]);
    const usersFrom = db.from;
    db.from = ((table: string) =>
      table === "bans"
        ? chainable({ data: null, error: { message: "connection refused" } })
        : usersFrom(table)) as typeof db.from;
    const hca = mockHcaFetch({ id: "hca-ban-check", first_name: "Ban", last_name: "Check" });
    const app = await startTestApp();
    try {
      const res = await driveHcaCallback(app.baseUrl);
      expect(res.status).toBe(503);
      expect(res.headers.get("location")).toBeNull();
    } finally {
      db.from = usersFrom;
      users.restore();
      hca.restore();
      await app.close();
    }
  });
});
