import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Request } from "express";
import { issueSessionToken } from "../auth/session.js";
import { clientIpFor, rateLimitKeyFor } from "./clientKey.js";

const DASH = "k".repeat(48);
const INTERNAL = "j".repeat(48);
const saved = { ...process.env };
beforeAll(() => {
  process.env.SERVICE_KEY_PIXL_DASHBOARD = DASH;
  process.env.SERVICE_KEY_INTERNAL_DASHBOARD = INTERNAL;
});
afterAll(() => {
  process.env.SERVICE_KEY_PIXL_DASHBOARD = saved.SERVICE_KEY_PIXL_DASHBOARD;
  process.env.SERVICE_KEY_INTERNAL_DASHBOARD = saved.SERVICE_KEY_INTERNAL_DASHBOARD;
});

const req = (headers: Record<string, string>) =>
  ({ headers, socket: { remoteAddress: "10.0.0.5" } }) as unknown as Request;

describe("clientIpFor", () => {
  test("trusts the leftmost forwarded IP only with the Pixl Dashboard's key", () => {
    const xff = "203.0.113.9, 10.0.0.9";
    expect(clientIpFor(req({ "x-forwarded-for": xff, "x-pixl-service-key": DASH }))).toBe("203.0.113.9");
    expect(clientIpFor(req({ "x-forwarded-for": xff, "x-pixl-service-key": INTERNAL }))).not.toBe("203.0.113.9");
    expect(clientIpFor(req({ "x-forwarded-for": xff }))).not.toBe("203.0.113.9");
    expect(clientIpFor(req({ "x-forwarded-for": xff, "x-pixl-service-key": "wrong" }))).not.toBe("203.0.113.9");
  });
});

describe("rateLimitKeyFor", () => {
  test("a verified session is limited per player, otherwise per client", () => {
    const token = issueSessionToken({ client: "web", userId: "u-rl", displayName: "R" });
    expect(rateLimitKeyFor(req({ authorization: `Bearer ${token}` }))).toBe("user:u-rl");
    expect(rateLimitKeyFor(req({ authorization: "Bearer forged.x.y" }))).not.toStartWith("user:");
    expect(rateLimitKeyFor(req({ "x-forwarded-for": "203.0.113.7", "x-pixl-service-key": DASH }))).toBe("203.0.113.7");
  });
});
