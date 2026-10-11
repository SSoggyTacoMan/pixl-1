import { describe, expect, test } from "bun:test";
import jwt from "jsonwebtoken";
import { issueSessionToken } from "../auth/session.js";
import { isAllowedWsOrigin, parseWsAuth, WS_AUTH_FAILED, WS_AUTH_TIMEOUT_MS } from "./gameServer.js";

describe("WebSocket auth", () => {
  test("only the game's origin may open a socket", () => {
    expect(isAllowedWsOrigin("https://play.pixl.hackclub.com")).toBe(true);
    for (const bad of [undefined, "", "https://pixl.hackclub.com", "https://dash.pixl.hackclub.com", "http://localhost:8060"])
      expect(isAllowedWsOrigin(bad)).toBe(false);
  });

  test("the first frame must be {type:auth, token}", () => {
    const token = issueSessionToken({ client: "game", userId: "u-ws", displayName: "W" });
    expect(parseWsAuth(JSON.stringify({ type: "auth", token }), false)?.userId).toBe("u-ws");
    expect(parseWsAuth(Buffer.from(JSON.stringify({ type: "auth", token })), false)?.userId).toBe("u-ws");
  });

  test("anything else fails auth", () => {
    const token = issueSessionToken({ client: "game", userId: "u-ws", displayName: "W" });
    expect(parseWsAuth(JSON.stringify({ type: "auth", token }), true)).toBeNull();
    expect(parseWsAuth(JSON.stringify({ type: "move", token }), false)).toBeNull();
    expect(parseWsAuth(JSON.stringify({ type: "auth" }), false)).toBeNull();
    expect(parseWsAuth(JSON.stringify({ type: "auth", token: "forged.token.value" }), false)).toBeNull();
    expect(parseWsAuth("not json", false)).toBeNull();
    expect(parseWsAuth("null", false)).toBeNull();
    expect(parseWsAuth(JSON.stringify({ type: "auth", token: "x".repeat(5000) }), false)).toBeNull();
  });

  test("only game tokens authenticate: web tokens and pre-split tokens fail", () => {
    const web = issueSessionToken({ client: "web", userId: "u-ws", displayName: "W" });
    expect(parseWsAuth(JSON.stringify({ type: "auth", token: web }), false)).toBeNull();
    const legacy = jwt.sign({ userId: "u-ws", displayName: "W" }, process.env.JWT_SECRET!, { algorithm: "HS256" });
    expect(parseWsAuth(JSON.stringify({ type: "auth", token: legacy }), false)).toBeNull();
    const game = issueSessionToken({ client: "game", userId: "u-ws", displayName: "W" });
    expect(parseWsAuth(JSON.stringify({ type: "auth", token: game }), false)?.client).toBe("game");
  });

  test("the contract constants the game relies on", () => {
    expect(WS_AUTH_FAILED).toBe(4401);
    expect(WS_AUTH_TIMEOUT_MS).toBe(5000);
  });
});

describe("WebSocket auth over a real socket", () => {
  async function withServer(fn: (url: string) => Promise<void>) {
    const { createServer } = await import("node:http");
    const { attachWebSocketServer } = await import("./gameServer.js");
    const server = createServer();
    attachWebSocketServer(server);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    try {
      await fn(`ws://127.0.0.1:${port}/ws`);
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>((r) => server.close(() => r()));
    }
  }

  function open(url: string, origin?: string) {
    const { WebSocket } = require("ws") as typeof import("ws");
    const ws = new WebSocket(url, origin ? { headers: { Origin: origin } } : {});
    const received: string[] = [];
    ws.on("message", (m) => received.push(m.toString()));
    const closed = new Promise<{ code: number; reason: string }>((resolve) =>
      ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() })),
    );
    const opened = new Promise<boolean>((resolve) => {
      ws.on("open", () => resolve(true));
      ws.on("error", () => resolve(false));
    });
    return { ws, received, closed, opened };
  }

  test("an upgrade from any origin but the game is refused", async () => {
    await withServer(async (url) => {
      expect(await open(url, "https://evil.example").opened).toBe(false);
      expect(await open(url).opened).toBe(false);
    });
  });

  test("a bad first frame closes with 4401 and nothing is sent first", async () => {
    await withServer(async (url) => {
      const c = open(url, "https://play.pixl.hackclub.com");
      expect(await c.opened).toBe(true);
      c.ws.send(JSON.stringify({ type: "move", posX: 1, posY: 2 }));
      expect((await c.closed).code).toBe(4401);
      expect(c.received).toEqual([]);
    });
  });

  test("a web token or a pre-split token in the first frame closes with 4401", async () => {
    const web = issueSessionToken({ client: "web", userId: "u-ws", displayName: "W" });
    const legacy = jwt.sign({ userId: "u-ws", displayName: "W" }, process.env.JWT_SECRET!, { algorithm: "HS256" });
    await withServer(async (url) => {
      for (const token of [web, legacy]) {
        const c = open(url, "https://play.pixl.hackclub.com");
        expect(await c.opened).toBe(true);
        c.ws.send(JSON.stringify({ type: "auth", token }));
        expect((await c.closed).code).toBe(4401);
        expect(c.received).toEqual([]);
      }
    });
  });

  test("no first frame within 5 s closes with 4401", async () => {
    await withServer(async (url) => {
      const c = open(url, "https://play.pixl.hackclub.com");
      expect(await c.opened).toBe(true);
      const started = Date.now();
      expect((await c.closed).code).toBe(4401);
      expect(Date.now() - started).toBeGreaterThanOrEqual(WS_AUTH_TIMEOUT_MS - 100);
      expect(c.received).toEqual([]);
    });
  }, 10_000);
});
