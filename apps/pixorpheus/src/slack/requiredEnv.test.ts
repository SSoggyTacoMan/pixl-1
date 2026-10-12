import { describe, expect, test } from "bun:test";
import { requireSlackEnv } from "./requiredEnv.js";
import { audit, auditRow, setAuditWriter, type PixoAuditRow } from "../audit.js";

describe("requireSlackEnv", () => {
  test("throws when either token is missing or blank", () => {
    expect(() => requireSlackEnv({})).toThrow(/SLACK_BOT_TOKEN, SLACK_APP_TOKEN/);
    expect(() => requireSlackEnv({ SLACK_APP_TOKEN: "xapp-1" })).toThrow(/missing SLACK_BOT_TOKEN$/);
    expect(() => requireSlackEnv({ SLACK_BOT_TOKEN: "xoxb-1" })).toThrow(/missing SLACK_APP_TOKEN$/);
    expect(() => requireSlackEnv({ SLACK_BOT_TOKEN: "xoxb-1", SLACK_APP_TOKEN: "  " })).toThrow(/SLACK_APP_TOKEN/);
  });
  test("the app token must be an app-level xapp- token", () => {
    expect(() => requireSlackEnv({ SLACK_BOT_TOKEN: "xoxb-1", SLACK_APP_TOKEN: "xoxb-2" })).toThrow(/xapp-/);
  });
  test("a signing secret is no longer needed (Socket Mode)", () => {
    expect(requireSlackEnv({ SLACK_BOT_TOKEN: " xoxb-1 ", SLACK_APP_TOKEN: "xapp-1" })).toEqual({ token: "xoxb-1", appToken: "xapp-1" });
  });
});

describe("audit", () => {
  test("writes an app=pixorpheus row", async () => {
    const rows: PixoAuditRow[] = [];
    const prev = setAuditWriter(async (r) => void rows.push(r));
    try {
      await audit({ action: "helpers.add", slackId: "U0ADMIN001", target: "slack:U0TARGET01", result: "ok" }, true);
    } finally {
      setAuditWriter(prev);
    }
    expect(rows).toEqual([
      {
        app: "pixorpheus",
        actor_type: "staff",
        actor_id: "U0ADMIN001",
        slack_id: "U0ADMIN001",
        action: "helpers.add",
        target: "slack:U0TARGET01",
        result: "ok",
        meta: {},
      },
    ]);
  });

  test("a failed write never throws", async () => {
    const prev = setAuditWriter(async () => {
      throw new Error("db down");
    });
    const origError = console.error;
    console.error = () => {};
    try {
      await expect(audit({ action: "x", slackId: null, result: "denied" }, false)).resolves.toBeUndefined();
    } finally {
      console.error = origError;
      setAuditWriter(prev);
    }
  });

  test("non-admins are recorded as players", () => {
    expect(auditRow({ action: "memory.read_other", slackId: "U0X", result: "denied" }, false).actor_type).toBe("player");
  });
});
