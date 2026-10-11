import { describe, expect, test } from "bun:test";
import { bearerMatches, csrfRejection, isValidTicketTs, originOf, secretsEqual } from "./requestGuards";
import { csvCell } from "./csv";
import { secureCookies, validSessionSecret } from "./session";

const BASE = "https://dash.pixl.hackclub.com";
const hdrs = (h: Record<string, string>) => {
  const H = new Headers(h);
  return (n: string) => H.get(n);
};

describe("ticket ts validation (M3)", () => {
  test("accepts a Slack message ts", () => {
    expect(isValidTicketTs("1760212345.123456")).toBe(true);
  });
  test("rejects path tricks and malformed values", () => {
    for (const bad of [
      "",
      "123.456",
      "1760212345.123456/../../admin",
      "../1760212345.123456",
      "1760212345.1234567",
      "1760212345123456",
      "1760212345.12345a",
      "1760212345.123456\n",
      " 1760212345.123456",
      "%2e%2e",
    ])
      expect(isValidTicketTs(bad)).toBe(false);
    expect(isValidTicketTs(undefined)).toBe(false);
    expect(isValidTicketTs(1760212345.123456)).toBe(false);
  });
});

describe("CSRF origin check for cookie-auth routes (M4)", () => {
  test("safe methods pass without an Origin", () => {
    expect(csrfRejection("GET", hdrs({}), BASE)).toBeNull();
    expect(csrfRejection("HEAD", hdrs({}), BASE)).toBeNull();
  });
  test("same-origin POST passes", () => {
    expect(csrfRejection("POST", hdrs({ origin: BASE }), BASE)).toBeNull();
    expect(csrfRejection("POST", hdrs({ origin: BASE }), `${BASE}/some/path`)).toBeNull();
  });
  test("cross-site, missing, null or look-alike Origin is refused", () => {
    expect(csrfRejection("POST", hdrs({}), BASE)).toBe("bad_origin");
    expect(csrfRejection("POST", hdrs({ origin: "null" }), BASE)).toBe("bad_origin");
    expect(csrfRejection("POST", hdrs({ origin: "https://evil.example" }), BASE)).toBe("bad_origin");
    expect(csrfRejection("POST", hdrs({ origin: "https://dash.pixl.hackclub.com.evil.example" }), BASE)).toBe(
      "bad_origin",
    );
    expect(csrfRejection("POST", hdrs({ origin: "http://dash.pixl.hackclub.com" }), BASE)).toBe("bad_origin");
    expect(csrfRejection("DELETE", hdrs({ origin: "https://pixl.hackclub.com" }), BASE)).toBe("bad_origin");
  });
  test("an unset/invalid BASE_URL fails closed", () => {
    expect(csrfRejection("POST", hdrs({ origin: BASE }), undefined)).toBe("server_misconfigured");
    expect(csrfRejection("POST", hdrs({ origin: BASE }), "not a url")).toBe("server_misconfigured");
    expect(originOf("javascript:alert(1)")).toBeNull();
  });
  test("JSON handlers also require Content-Type application/json", () => {
    const json = { requireJson: true };
    expect(csrfRejection("POST", hdrs({ origin: BASE, "content-type": "application/json; charset=utf-8" }), BASE, json)).toBeNull();
    expect(csrfRejection("POST", hdrs({ origin: BASE, "content-type": "text/plain" }), BASE, json)).toBe(
      "bad_content_type",
    );
    expect(csrfRejection("POST", hdrs({ origin: BASE }), BASE, json)).toBe("bad_content_type");
  });
});

describe("constant-time secret compare (cron)", () => {
  test("matches only the exact bearer", () => {
    expect(bearerMatches("Bearer s3cret-value", "s3cret-value")).toBe(true);
    expect(bearerMatches("Bearer s3cret-valuX", "s3cret-value")).toBe(false);
    expect(bearerMatches("Bearer s3cret", "s3cret-value")).toBe(false);
    expect(bearerMatches("s3cret-value", "s3cret-value")).toBe(false);
    expect(bearerMatches(null, "s3cret-value")).toBe(false);
  });
  test("different lengths don't throw and an empty expected secret never matches", () => {
    expect(secretsEqual("a", "a much longer secret")).toBe(false);
    expect(secretsEqual("", "")).toBe(false);
  });
});

describe("CSV formula neutralization", () => {
  test("neutralizes =, +, -, @, tab and CR prefixes", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    for (const p of ["+1", "-1", "@SUM(A1)", "\t=1+1", "\r=1+1"]) expect(csvCell(p).startsWith(`"'`)).toBe(true);
  });
  test("plain values are just quoted", () => {
    expect(csvCell("Jane")).toBe(`"Jane"`);
    expect(csvCell(null)).toBe(`""`);
    expect(csvCell(42)).toBe(`"42"`);
  });
});

describe("session secret and cookie flags", () => {
  test("SESSION_SECRET under 32 chars is refused", () => {
    expect(() => validSessionSecret(undefined)).toThrow();
    expect(() => validSessionSecret("short")).toThrow();
    expect(() => validSessionSecret("x".repeat(31))).toThrow();
    expect(validSessionSecret("x".repeat(32))).toBe("x".repeat(32));
  });
  test("cookies are Secure everywhere but local dev/test", () => {
    expect(secureCookies("production")).toBe(true);
    expect(secureCookies("")).toBe(true);
    expect(secureCookies("staging")).toBe(true);
    expect(secureCookies("development")).toBe(false);
  });
});
