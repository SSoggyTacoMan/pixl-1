import { describe, expect, test } from "bun:test";
import { formForwardHeaders, trustCfConnectingIp, visitorIp } from "./form-forwarding";

const h = (init: Record<string, string>) => new Headers(init);
const opts = { origin: "https://pixl.hackclub.com", serviceKey: "k".repeat(40) };

describe("visitorIp", () => {
  test("with TRUST_CF_CONNECTING_IP, prefers cf-connecting-ip over any X-Forwarded-For", () => {
    expect(
      visitorIp(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 10.0.0.2" }), { trustCf: true }),
    ).toBe("203.0.113.7");
  });
  test("without it, a client-sent cf-connecting-ip is ignored (rightmost XFF hop wins)", () => {
    expect(
      visitorIp(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 10.0.0.2" }), { trustCf: false }),
    ).toBe("10.0.0.2");
    expect(visitorIp(h({ "cf-connecting-ip": "203.0.113.7" }), { trustCf: false })).toBeNull();
  });
  test("the default follows the env flag, which must be exactly 1", () => {
    expect(trustCfConnectingIp(undefined)).toBe(false);
    expect(trustCfConnectingIp("")).toBe(false);
    expect(trustCfConnectingIp("true")).toBe(false);
    expect(trustCfConnectingIp("0")).toBe(false);
    expect(trustCfConnectingIp("1")).toBe(true);
    const prev = process.env.TRUST_CF_CONNECTING_IP;
    try {
      delete process.env.TRUST_CF_CONNECTING_IP;
      expect(visitorIp(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.2" }))).toBe("10.0.0.2");
      process.env.TRUST_CF_CONNECTING_IP = "1";
      expect(visitorIp(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "10.0.0.2" }))).toBe("203.0.113.7");
    } finally {
      if (prev === undefined) delete process.env.TRUST_CF_CONNECTING_IP;
      else process.env.TRUST_CF_CONNECTING_IP = prev;
    }
  });
  test("falls back to the LAST X-Forwarded-For entry, never the client-supplied first", () => {
    expect(visitorIp(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }))).toBe("198.51.100.4");
    expect(visitorIp(h({ "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
  });
  test("ignores values that aren't IPs", () => {
    expect(
      visitorIp(h({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "1.2.3.4, evil" }), { trustCf: true }),
    ).toBeNull();
    expect(visitorIp(h({}))).toBeNull();
  });
  test("accepts IPv6", () => {
    expect(visitorIp(h({ "cf-connecting-ip": "2001:db8::1" }), { trustCf: true })).toBe("2001:db8::1");
    expect(visitorIp(h({ "x-forwarded-for": "6.6.6.6, 2001:db8::2" }))).toBe("2001:db8::2");
  });
});

describe("formForwardHeaders", () => {
  test("sends Origin, the service key and a single-value X-Forwarded-For", () => {
    const out = formForwardHeaders(
      { "content-type": "application/json", "x-forwarded-for": "6.6.6.6" },
      h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6, 10.0.0.1" }),
      { ...opts, trustCf: true },
    );
    expect(out.get("origin")).toBe("https://pixl.hackclub.com");
    expect(out.get("x-pixl-service-key")).toBe(opts.serviceKey);
    expect(out.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(out.get("content-type")).toBe("application/json");
  });
  test("a spoofed cf-connecting-ip is not forwarded unless trusted", () => {
    const out = formForwardHeaders(
      undefined,
      h({ "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "198.51.100.4" }),
      { ...opts, trustCf: false },
    );
    expect(out.get("x-forwarded-for")).toBe("198.51.100.4");
  });
  test("a spoofed first X-Forwarded-For entry is never forwarded", () => {
    const out = formForwardHeaders(undefined, h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }), opts);
    expect(out.get("x-forwarded-for")).toBe("198.51.100.4");
  });
  test("no usable IP means no X-Forwarded-For at all", () => {
    const out = formForwardHeaders({ "x-forwarded-for": "6.6.6.6" }, h({}), opts);
    expect(out.get("x-forwarded-for")).toBeNull();
  });
});
