import { describe, expect, test } from "bun:test";
import { requireSlackEnv } from "./requiredEnv.js";
import { audit, auditRow, setAuditWriter, type PixoAuditRow } from "../audit.js";

describe("requireSlackEnv", () => {
  test("throws when either secret is missing or blank", () => {
    expect(() => requireSlackEnv({})).toThrow(/SLACK_SIGNING_SECRET, SLACK_BOT_TOKEN/);
    expect(() => requireSlackEnv({ SLACK_SIGNING_SECRET: "s" })).toThrow(/SLACK_BOT_TOKEN/);
    expect(() => requireSlackEnv({ SLACK_BOT_TOKEN: "xoxb-1", SLACK_SIGNING_SECRET: "  " })).toThrow(/SLACK_SIGNING_SECRET/);
  });
  test("returns both when present", () => {
    expect(requireSlackEnv({ SLACK_SIGNING_SECRET: "s", SLACK_BOT_TOKEN: "xoxb-1" })).toEqual({ signingSecret: "s", token: "xoxb-1" });
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
