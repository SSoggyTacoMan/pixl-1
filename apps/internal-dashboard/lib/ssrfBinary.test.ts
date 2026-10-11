import { describe, expect, test } from "bun:test";
import { safeBinaryGet, type LookupImpl } from "./ssrfGuard";
import { isPrivateIp } from "./urlSafety";
import { startHttpServer, startHttpsServer, tlsFixture } from "./testTls";

const lookupLocal: LookupImpl = async () => [{ address: "127.0.0.1", family: 4 }];
// Lets the loopback test server through while keeping the blocklist live for
// every other address.
const guard = { lookupImpl: lookupLocal, isBlockedIp: (ip: string) => ip !== "127.0.0.1", ca: tlsFixture.cert };

describe("safeBinaryGet (shop image URL fetch)", () => {
  test("downloads a small body", async () => {
    const s = await startHttpsServer((_req, res) => res.writeHead(200).end(Buffer.from([1, 2, 3])));
    try {
      const buf = await safeBinaryGet(`https://html.example.test:${s.port}/a.png`, { ...guard, maxBytes: 10 });
      expect([...buf]).toEqual([1, 2, 3]);
    } finally {
      await s.close();
    }
  });

  test("aborts a streamed body that passes the cap (no Content-Length)", async () => {
    const s = await startHttpServer((_req, res) => {
      res.writeHead(200, { "transfer-encoding": "chunked" });
      const chunk = Buffer.alloc(64 * 1024, 7);
      let sent = 0;
      const pump = () => {
        while (sent < 50 && res.write(chunk)) sent++;
        if (sent < 50) res.once("drain", pump);
        else res.end();
      };
      pump();
    });
    try {
      await expect(
        safeBinaryGet(`http://html.example.test:${s.port}/big`, { ...guard, maxBytes: 100 * 1024 }),
      ).rejects.toThrow("too large");
    } finally {
      await s.close();
    }
  });

  test("refuses a declared Content-Length over the cap before reading", async () => {
    const s = await startHttpServer((_req, res) => res.writeHead(200, { "content-length": "999999" }).end(Buffer.alloc(10)));
    try {
      await expect(safeBinaryGet(`http://html.example.test:${s.port}/x`, { ...guard, maxBytes: 1000 })).rejects.toThrow(
        "too large",
      );
    } finally {
      await s.close();
    }
  });

  test("refuses redirects instead of following them", async () => {
    const s = await startHttpServer((_req, res) => res.writeHead(302, { location: "http://169.254.169.254/" }).end());
    try {
      await expect(safeBinaryGet(`http://html.example.test:${s.port}/x`, { ...guard, maxBytes: 1000 })).rejects.toThrow(
        "redirected",
      );
    } finally {
      await s.close();
    }
  });

  test("DNS rebinding: the pinned lookup that connects is the one checked", async () => {
    // First resolution (the pre-check) says public, the second (the actual
    // connect) says metadata IP. With a pinned lookup the connect-time answer
    // is checked too, so the request never reaches the internal address.
    let calls = 0;
    const rebinding: LookupImpl = async () =>
      ++calls === 1 ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "169.254.169.254", family: 4 }];
    await expect(
      safeBinaryGet("http://rebind.example.test/x.png", { lookupImpl: rebinding, maxBytes: 1000, timeoutMs: 2000 }),
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });

  test("blocks private, CGNAT and metadata targets, and non-http schemes", async () => {
    for (const u of ["http://10.0.0.1/", "http://100.64.0.1/", "http://169.254.169.254/latest", "http://[::1]/"])
      await expect(safeBinaryGet(u, { maxBytes: 10 })).rejects.toThrow("private");
    await expect(safeBinaryGet("file:///etc/passwd", { maxBytes: 10 })).rejects.toThrow("scheme");
    await expect(safeBinaryGet("http://user:pw@example.com/", { maxBytes: 10 })).rejects.toThrow("credentials");
  });
});

describe("urlSafety blocklist", () => {
  test("covers 100.64.0.0/10 and 0.0.0.0/8", () => {
    for (const ip of ["100.64.0.1", "100.127.255.254", "0.1.2.3"]) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["100.63.255.255", "100.128.0.1", "8.8.8.8"]) expect(isPrivateIp(ip)).toBe(false);
  });
});
