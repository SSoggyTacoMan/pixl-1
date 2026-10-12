import { describe, expect, test } from "bun:test";
import { formForwardHeaders, visitorIp } from "./form-forwarding";

const h = (init: Record<string, string>) => new Headers(init);
const opts = { origin: "https://pixl.hackclub.com", serviceKey: "k".repeat(40) };

describe("visitorIp", () => {
  test("prefers cf-connecting-ip over any X-Forwarded-For", () => {
    expect(visitorIp(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1, 10.0.0.2" }))).toBe(
      "203.0.113.7",
    );
  });
  test("falls back to the LAST X-Forwarded-For entry, never the client-supplied first", () => {
    expect(visitorIp(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" }))).toBe("198.51.100.4");
    expect(visitorIp(h({ "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
  });
  test("ignores values that aren't IPs", () => {
    expect(visitorIp(h({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "1.2.3.4, evil" }))).toBeNull();
    expect(visitorIp(h({}))).toBeNull();
  });
  test("accepts IPv6", () => {
    expect(visitorIp(h({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});

describe("formForwardHeaders", () => {
  test("sends Origin, the service key and a single-value X-Forwarded-For", () => {
    const out = formForwardHeaders(
      { "content-type": "application/json", "x-forwarded-for": "6.6.6.6" },
      h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6, 10.0.0.1" }),
      opts,
    );
    expect(out.get("origin")).toBe("https://pixl.hackclub.com");
    expect(out.get("x-pixl-service-key")).toBe(opts.serviceKey);
    expect(out.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(out.get("content-type")).toBe("application/json");
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
