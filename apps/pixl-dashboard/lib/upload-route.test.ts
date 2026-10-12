import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FALLBACK_CSP } from "./csp";
import type { ActionLogLine } from "./guarded-action-core";
import { MAX_IMAGE_BYTES, handleImageUpload, readCapped } from "./upload-route";

const SITE = "https://pixl.hackclub.com";
const auth = { token: "jwt.tok.en", session: { userId: "u1", displayName: "Ada", slackId: "U1" } };

function req(opts: { origin?: string | null; type?: string; body?: BodyInit | null; length?: string } = {}) {
  const headers = new Headers();
  if (opts.origin !== null) headers.set("origin", opts.origin ?? SITE);
  if (opts.type !== undefined) headers.set("content-type", opts.type);
  else headers.set("content-type", "image/png");
  if (opts.length) headers.set("content-length", opts.length);
  return new Request(`${SITE}/api/uploads/image`, {
    method: "POST",
    headers,
    body: opts.body === undefined ? new Uint8Array([137, 80, 78, 71]) : opts.body,
  });
}

function deps(overrides: { getAuth?: () => Promise<typeof auth | null>; fetchImpl?: typeof fetch } = {}) {
  const lines: ActionLogLine[] = [];
  const fetchImpl =
    overrides.fetchImpl ??
    (mock(async () => new Response(JSON.stringify({ url: "https://cdn.hackclub.com/x.png" }), { status: 200 })) as unknown as typeof fetch);
  return {
    lines,
    fetchImpl,
    d: { getAuth: overrides.getAuth ?? (async () => auth), fetchImpl, log: (l: ActionLogLine) => lines.push(l) },
  };
}

describe("handleImageUpload", () => {
  test("forwards one raw upload to apps/server with the Bearer token and returns the url", async () => {
    const { d, fetchImpl, lines } = deps();
    const res = await handleImageUpload(req(), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, url: "https://cdn.hackclub.com/x.png" });
    const calls = (fetchImpl as unknown as ReturnType<typeof mock>).mock.calls;
    expect(calls.length).toBe(1);
    const [url, init] = calls[0] as [string, RequestInit];
    expect(url).toBe("https://server.pixl.hackclub.com/api/uploads");
    const h = new Headers(init.headers);
    expect(h.get("authorization")).toBe("Bearer jwt.tok.en");
    expect(h.get("content-type")).toBe("image/png");
    expect(lines.at(-1)).toMatchObject({ action: "upload.image", userId: "u1", result: "ok" });
  });

  test("cross-site or missing Origin is refused before the session is even read", async () => {
    const getAuth = mock(async () => auth);
    for (const origin of ["https://evil.example", null]) {
      const { d, fetchImpl } = deps({ getAuth });
      const res = await handleImageUpload(req({ origin }), d);
      expect(res.status).toBe(403);
      expect((fetchImpl as unknown as ReturnType<typeof mock>).mock.calls.length).toBe(0);
    }
    expect(getAuth.mock.calls.length).toBe(0);
  });

  test("no session is 401 and never reaches apps/server", async () => {
    const { d, fetchImpl } = deps({ getAuth: async () => null });
    const res = await handleImageUpload(req(), d);
    expect(res.status).toBe(401);
    expect((fetchImpl as unknown as ReturnType<typeof mock>).mock.calls.length).toBe(0);
  });

  test("only png/jpeg/webp content types", async () => {
    for (const type of ["image/svg+xml", "text/html", "application/octet-stream", ""]) {
      const { d } = deps();
      const res = await handleImageUpload(req({ type }), d);
      expect(res.status).toBe(415);
    }
    const { d } = deps();
    expect((await handleImageUpload(req({ type: "image/JPEG; charset=binary" }), d)).status).toBe(200);
  });

  test("an oversized declared length is rejected without reading", async () => {
    const { d, fetchImpl } = deps();
    const res = await handleImageUpload(req({ length: String(MAX_IMAGE_BYTES + 1) }), d);
    expect(res.status).toBe(413);
    expect((fetchImpl as unknown as ReturnType<typeof mock>).mock.calls.length).toBe(0);
  });

  test("an oversized body is rejected even when Content-Length lies", async () => {
    const { d, fetchImpl } = deps();
    const res = await handleImageUpload(req({ body: new Uint8Array(MAX_IMAGE_BYTES + 1) }), d);
    expect(res.status).toBe(413);
    expect((fetchImpl as unknown as ReturnType<typeof mock>).mock.calls.length).toBe(0);
  });

  test("an empty body is rejected", async () => {
    const { d } = deps();
    expect((await handleImageUpload(req({ body: new Uint8Array(0) }), d)).status).toBe(400);
  });

  test("server errors keep their code; a server 401 reads as unauthorized", async () => {
    const busy = deps({ fetchImpl: (async () => new Response(JSON.stringify({ error: "busy" }), { status: 503 })) as unknown as typeof fetch });
    const r1 = await handleImageUpload(req(), busy.d);
    expect(r1.status).toBe(503);
    expect(await r1.json()).toEqual({ ok: false, error: "busy" });
    const gone = deps({ fetchImpl: (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch });
    const r2 = await handleImageUpload(req(), gone.d);
    expect(r2.status).toBe(401);
    expect(await r2.json()).toEqual({ ok: false, error: "unauthorized" });
  });
});

describe("readCapped", () => {
  test("returns the bytes under the cap and null over it", async () => {
    const small = new Response(new Uint8Array([1, 2, 3])).body;
    expect(await readCapped(small, 3)).toEqual(new Uint8Array([1, 2, 3]));
    const big = new Response(new Uint8Array(10)).body;
    expect(await readCapped(big, 9)).toBeNull();
  });
});

describe("Server Action body limit", () => {
  const cfg = readFileSync(join(import.meta.dir, "..", "next.config.ts"), "utf8");
  test("is back to 1mb now that images use the route handler", () => {
    expect(cfg).toMatch(/bodySizeLimit:\s*"1mb"/);
    expect(cfg).not.toMatch(/bodySizeLimit:\s*"16mb"/);
  });
  test("no Server Action uploads images anymore", () => {
    const actions = readFileSync(join(import.meta.dir, "..", "app", "(shell)", "projects", "actions.ts"), "utf8");
    expect(actions).not.toContain("uploadImage");
  });
});

describe("static fallback CSP", () => {
  test("is applied by next.config headers and has no way to run inline script", () => {
    const cfg = readFileSync(join(import.meta.dir, "..", "next.config.ts"), "utf8");
    expect(cfg).toContain('{ key: "Content-Security-Policy", value: FALLBACK_CSP }');
    expect(FALLBACK_CSP).toContain("script-src 'self'");
    expect(FALLBACK_CSP).not.toContain("unsafe-inline'; script");
    expect(FALLBACK_CSP).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
    expect(FALLBACK_CSP).toContain("frame-ancestors 'none'");
    expect(FALLBACK_CSP).toContain("object-src 'none'");
  });
});
