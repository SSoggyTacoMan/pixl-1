import { describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";

process.env.PII_ENCRYPTION_KEY ??= "b".repeat(64);
const { issueSessionToken, verifySessionToken } = await import("../auth/session.js");
const { encryptPII } = await import("../crypto.js");
const { db } = await import("../db/pgCompat.js");
const { bearer, testAuthGate } = await import("../http/testkit.js");
const { default: profileRouter, maskedAddress } = await import("./profile.js");

async function call(method: string, path: string, token: string, body?: unknown, usersRow: unknown = null) {
  const writes: unknown[] = [];
  const realFrom = db.from;
  db.from = ((table: string) => {
    let result: { data: unknown; error: unknown } = { data: table === "users" ? usersRow : null, error: null };
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "maybeSingle", "single"]) c[m] = () => c;
    c.update = (payload: unknown) => {
      writes.push(payload);
      result = { data: null, error: null };
      return c;
    };
    c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return c;
  }) as unknown as typeof db.from;
  const app = express();
  app.use(express.json());
  app.use(testAuthGate());
  app.use(profileRouter);
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { "content-type": "application/json", ...bearer(token) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown>, writes };
  } finally {
    db.from = realFrom;
    await new Promise<void>((r) => server.close(() => r()));
  }
}

describe("POST /api/profile/name token re-issue", () => {
  test("a real rename re-issues a token that ends when the old one would have", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const old = jwt.sign({ userId: "u-name", displayName: "Old Name", client: "game", exp }, process.env.JWT_SECRET!, { algorithm: "HS256" });
    const r = await call("POST", "/api/profile/name", old, { name: "New Name" });
    expect(r.status).toBe(200);
    const fresh = verifySessionToken(String(r.body.token));
    expect(fresh?.displayName).toBe("New Name");
    expect(fresh?.client).toBe("game");
    expect(fresh?.exp).toBe(exp);
  });

  test("saving the same name hands back no new token", async () => {
    const token = issueSessionToken({ client: "game", userId: "u-name", displayName: "Same Name" });
    const r = await call("POST", "/api/profile/name", token, { name: "Same Name" });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeUndefined();
  });
});

describe("POST /api/profile/card-image", () => {
  const token = issueSessionToken({ client: "web", userId: "u-card", displayName: "Card" });

  test("a CDN upload or a Slack avatar is saved", async () => {
    for (const url of ["https://cdn.hackclub.com/x/me.png", "https://avatars.slack-edge.com/2024/1_512.png"]) {
      const r = await call("POST", "/api/profile/card-image", token, { url });
      expect(r.status).toBe(200);
      expect(r.writes).toEqual([{ avatar_url: url }]);
    }
  });

  test("an attacker-hosted image or another scheme is refused and nothing is saved", async () => {
    for (const url of ["https://evil.example/pixel.png", "javascript:alert(1)", "data:image/png;base64,AA", "http://cdn.hackclub.com/a.png"]) {
      const r = await call("POST", "/api/profile/card-image", token, { url });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("invalid_image_url");
      expect(r.writes).toHaveLength(0);
    }
  });
});

describe("GET /api/profile/eligibility", () => {
  const row = {
    birthday: encryptPII("2010-05-01"),
    address_line1: encryptPII("1 Secret Lane"),
    address_line2: encryptPII("Apt 2"),
    address_city: encryptPII("Burlington"),
    address_state: encryptPII("VT"),
    address_country: encryptPII("US"),
    address_postal: encryptPII("05401"),
    phone: encryptPII("+1 555 0100"),
  };

  test("never returns the street, postal code or phone", async () => {
    const token = issueSessionToken({ client: "web", userId: "u-elig", displayName: "E" });
    const r = await call("GET", "/api/profile/eligibility", token, undefined, row);
    expect(r.status).toBe(200);
    const text = JSON.stringify(r.body);
    for (const secret of ["1 Secret Lane", "Apt 2", "05401", "555", "VT"]) expect(text).not.toContain(secret);
    expect(r.body).toMatchObject({ ok: true, addressCity: "Burlington", addressCountry: "US", hasAddress: true, hasPhone: true });
    for (const k of ["addressLine1", "addressLine2", "addressState", "addressPostal"]) expect(k in r.body).toBe(false);
  });

  test("maskedAddress with nothing on file", () => {
    expect(maskedAddress({})).toEqual({ addressCity: "", addressCountry: "", hasAddress: false, hasPhone: false });
  });
});
