import { describe, expect, test } from "bun:test";
import { LOGIN_STATE_COOKIE, SESSION_COOKIE, cookieBase, cookieNames, sessionCookiesToClear } from "./session-cookie";

describe("session cookie names", () => {
  test("production uses the __Host- prefix for both cookies", () => {
    expect(cookieNames("production")).toEqual({
      session: "__Host-pixl_session",
      loginState: "__Host-pixl_login_state",
    });
  });
  test("an empty or unknown NODE_ENV is treated as production", () => {
    expect(cookieNames("").session).toBe("__Host-pixl_session");
    expect(cookieNames("staging").session).toBe("__Host-pixl_session");
  });
  test("plain names only in development and test", () => {
    expect(cookieNames("development")).toEqual({ session: "pixl_session", loginState: "pixl_login_state" });
    expect(cookieNames("test")).toEqual({ session: "pixl_session", loginState: "pixl_login_state" });
  });
  test("sign-out also clears the legacy plain pixl_session cookie", () => {
    expect(sessionCookiesToClear("production")).toEqual(["__Host-pixl_session", "pixl_session"]);
    expect(sessionCookiesToClear("development")).toEqual(["pixl_session"]);
  });
  test("the exported constants follow the current NODE_ENV (test here)", () => {
    expect(SESSION_COOKIE).toBe("pixl_session");
    expect(LOGIN_STATE_COOKIE).toBe("pixl_login_state");
  });
  test("__Host- requirements: Secure, Path=/ and no Domain wherever the prefix is used", () => {
    for (const env of ["production", "", "staging"]) {
      const base = cookieBase(env) as Record<string, unknown>;
      expect(base.secure).toBe(true);
      expect(base.path).toBe("/");
      expect(base.domain).toBeUndefined();
      expect(base.httpOnly).toBe(true);
    }
    expect(cookieBase("development").secure).toBe(false);
  });
});
