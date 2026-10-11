import { describe, expect, mock, test } from "bun:test";
import { assertServerPath, buildServerRequest, errorCode, serverFetch } from "./server-api-core";

describe("buildServerRequest", () => {
  test("sends the token only as a Bearer header, never in the URL", () => {
    const { url, init } = buildServerRequest("/api/profile/wallet", { token: "abc.def.ghi" });
    expect(url).toBe("https://server.pixl.hackclub.com/api/profile/wallet");
    expect(url).not.toContain("token");
    const h = new Headers(init.headers);
    expect(h.get("authorization")).toBe("Bearer abc.def.ghi");
    expect(h.get("x-pixl-service-key")).toBeNull();
    expect(init.method).toBe("GET");
    expect(init.cache).toBe("no-store");
    expect(init.redirect).toBe("manual");
  });

  test("keeps an existing query string intact", () => {
    const { url } = buildServerRequest("/api/shop/items?region=eu", { token: "t" });
    expect(url).toBe("https://server.pixl.hackclub.com/api/shop/items?region=eu");
  });

  test("service key goes in x-pixl-service-key, with no Authorization header", () => {
    const { init } = buildServerRequest("/auth/exchange", {
      method: "POST",
      serviceKey: "svc",
      body: { kind: "json", value: { code: "c1" } },
    });
    const h = new Headers(init.headers);
    expect(h.get("x-pixl-service-key")).toBe("svc");
    expect(h.get("authorization")).toBeNull();
    expect(h.get("content-type")).toBe("application/json");
    expect(init.body).toBe('{"code":"c1"}');
  });

  test("raw bodies carry their own content type", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { init } = buildServerRequest("/api/uploads", {
      method: "POST",
      token: "t",
      body: { kind: "raw", value: bytes, contentType: "image/png" },
    });
    expect(new Headers(init.headers).get("content-type")).toBe("image/png");
    expect(init.body).toBe(bytes);
  });

  test("defaults to POST when there is a body and no method", () => {
    const { init } = buildServerRequest("/api/x", { body: { kind: "json", value: {} } });
    expect(init.method).toBe("POST");
  });
});

describe("assertServerPath", () => {
  for (const bad of [
    "api/x",
    "//evil.example/x",
    "https://evil.example/x",
    "/api/../admin",
    "/api/./x",
    "/api\\x",
    "/api/x y",
    "/api/x\n",
  ]) {
    test(`rejects ${JSON.stringify(bad)}`, () => {
      expect(() => assertServerPath(bad)).toThrow();
    });
  }
  test("accepts normal paths", () => {
    expect(() => assertServerPath("/api/projects/12/journal?x=1")).not.toThrow();
  });
});

describe("serverFetch", () => {
  test("parses JSON and reports errors with the server's code", async () => {
    const f = mock(async () => new Response(JSON.stringify({ error: "nope" }), { status: 400 }));
    const r = await serverFetch("/api/x", { token: "t" }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, status: 400, error: "nope", data: { error: "nope" } });
  });

  test("network failure becomes server_unreachable", async () => {
    const f = mock(async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = await serverFetch("/api/x", {}, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, status: 0, error: "server_unreachable" });
  });

  test("errorCode falls back to the status", () => {
    expect(errorCode(null, 502)).toBe("http_502");
    expect(errorCode({ message: "m" }, 400)).toBe("m");
  });
});
