import { describe, expect, mock, test } from "bun:test";
import { allowedImageUrl, fetchCardImage } from "./remote-image";
import { playerCard, shopItemCard } from "./cards";

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const isPng = (b: Uint8Array) => SIG.every((v, i) => b[i] === v);
const CDN = "https://cdn.hackclub.com/abc/item.png";

describe("allowedImageUrl", () => {
  test("only https URLs on the CDN allowlist", () => {
    expect(allowedImageUrl(CDN)?.hostname).toBe("cdn.hackclub.com");
    expect(allowedImageUrl("http://cdn.hackclub.com/x.png")).toBeNull();
    expect(allowedImageUrl("https://evil.example/x.png")).toBeNull();
    expect(allowedImageUrl("https://cdn.hackclub.com.evil.example/x.png")).toBeNull();
    expect(allowedImageUrl("https://user:pw@cdn.hackclub.com/x.png")).toBeNull();
    expect(allowedImageUrl("https://cdn.hackclub.com:8443/x.png")).toBeNull();
    expect(allowedImageUrl("https://169.254.169.254/latest")).toBeNull();
    expect(allowedImageUrl(42)).toBeNull();
  });
});

describe("fetchCardImage", () => {
  test("never fetches a disallowed URL", async () => {
    const f = mock(async () => new Response("x"));
    expect(await fetchCardImage("https://evil.example/a.png", { fetchImpl: f as unknown as typeof fetch })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  test("follows a redirect only while it stays on the allowlist", async () => {
    const calls: string[] = [];
    const f = mock(async (url: string) => {
      calls.push(url);
      if (url === CDN) return new Response(null, { status: 302, headers: { location: "https://assets.hackclub.com/b.png" } });
      return new Response(new Uint8Array([1, 2, 3]));
    });
    expect(await fetchCardImage(CDN, { fetchImpl: f as unknown as typeof fetch })).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls).toEqual([CDN, "https://assets.hackclub.com/b.png"]);

    const off = mock(async () => new Response(null, { status: 301, headers: { location: "http://10.0.0.1/meta" } }));
    expect(await fetchCardImage(CDN, { fetchImpl: off as unknown as typeof fetch })).toBeNull();
    expect(off).toHaveBeenCalledTimes(1);
  });

  test("fetches with redirect: manual and enforces the byte cap", async () => {
    const f = mock(async (_u: string, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      return new Response(new Uint8Array(64));
    });
    expect(await fetchCardImage(CDN, { fetchImpl: f as unknown as typeof fetch, maxBytes: 16 })).toBeNull();
    const declared = mock(async () => new Response("x", { headers: { "content-length": "999999999" } }));
    expect(await fetchCardImage(CDN, { fetchImpl: declared as unknown as typeof fetch })).toBeNull();
  });

  test("errors and non-2xx become null", async () => {
    const boom = mock(async () => {
      throw new Error("timeout");
    });
    expect(await fetchCardImage(CDN, { fetchImpl: boom as unknown as typeof fetch })).toBeNull();
    const nf = mock(async () => new Response("no", { status: 404 }));
    expect(await fetchCardImage(CDN, { fetchImpl: nf as unknown as typeof fetch })).toBeNull();
  });
});

describe("cards", () => {
  test("shop card reads only the public endpoint and fetches the CDN photo", async () => {
    const urls: string[] = [];
    const f = mock(async (url: string, init?: RequestInit) => {
      urls.push(url);
      if (url.endsWith("/api/shop/item/5/public")) {
        expect(new Headers(init?.headers).get("authorization")).toBeNull();
        return Response.json({ ok: true, item: { id: 5, name: "Iron", price: 900, image_url: CDN } });
      }
      return new Response(new Uint8Array([0xff, 0xd8])); // JPEG: decode fails, card still renders
    });
    expect(isPng(await shopItemCard("5", { fetchImpl: f as unknown as typeof fetch }))).toBe(true);
    expect(urls).toEqual(["https://server.pixl.hackclub.com/api/shop/item/5/public", CDN]);
  });

  test("bad ids never reach the server", async () => {
    const f = mock(async () => Response.json({}));
    expect(isPng(await shopItemCard("5/../../admin", { fetchImpl: f as unknown as typeof fetch }))).toBe(true);
    expect(isPng(await playerCard("not-a-uuid", { fetchImpl: f as unknown as typeof fetch }))).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  test("player card falls back on server errors and skips non-CDN avatars", async () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const urls: string[] = [];
    const f = mock(async (url: string) => {
      urls.push(url);
      return Response.json({
        ok: true,
        player: { display_name: "Ada", avatar_url: "https://avatars.slack-edge.com/a.png", level: 2, xp_hours: 10, created_at: "2026-08-01T00:00:00Z" },
        projects: [{}, {}],
      });
    });
    expect(isPng(await playerCard(id, { fetchImpl: f as unknown as typeof fetch }))).toBe(true);
    expect(urls).toEqual([`https://server.pixl.hackclub.com/api/explore/players/${id}/public`]);
    const down = mock(async () => new Response("", { status: 500 }));
    expect(isPng(await playerCard(id, { fetchImpl: down as unknown as typeof fetch }))).toBe(true);
  });
});
