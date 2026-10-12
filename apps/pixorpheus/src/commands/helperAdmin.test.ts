import { describe, expect, test } from "bun:test";
import { handleHelperAdmin, parseTargetUserId, type HelperAdminDeps } from "./helperAdmin.js";
import type { PixoAuditEvent } from "../audit.js";

const ADMIN = "U0ADMIN001";
const HELPER = "U0HELPER01";
const TARGET = "U0TARGET01";

function fakeDeps(adminIds: string | undefined) {
  const added: string[] = [];
  const removed: string[] = [];
  const audits: { event: PixoAuditEvent; isAdmin: boolean }[] = [];
  const deps: HelperAdminDeps = {
    addHelper: async (id) => void added.push(id),
    removeHelper: async (id) => void removed.push(id),
    audit: async (event, isAdmin) => void audits.push({ event, isAdmin }),
    env: { SLACK_ADMIN_USER_IDS: adminIds },
  };
  return { deps, added, removed, audits };
}

describe("parseTargetUserId", () => {
  test("accepts a mention or a bare user id", () => {
    expect(parseTargetUserId(`<@${TARGET}>`)).toBe(TARGET);
    expect(parseTargetUserId(`<@${TARGET}|someone>`)).toBe(TARGET);
    expect(parseTargetUserId(TARGET)).toBe(TARGET);
  });
  test("rejects anything that isn't a user id", () => {
    for (const bad of ["", "   ", "C0CHANNEL1", "<!channel>", "everyone", "U1", "<@C0CHANNEL1>", `${TARGET} extra`, "u0lower001"]) {
      expect(parseTargetUserId(bad)).toBeNull();
    }
  });
});

describe("handleHelperAdmin", () => {
  test("fails closed when SLACK_ADMIN_USER_IDS is empty or missing", async () => {
    for (const env of [undefined, "", " , "]) {
      const { deps, added, audits } = fakeDeps(env);
      const reply = await handleHelperAdmin("add", ADMIN, `<@${TARGET}>`, deps);
      expect(reply).toContain("Only Pixl admins");
      expect(added).toEqual([]);
      expect(audits[0].event.result).toBe("denied");
    }
  });

  test("an existing helper (not an admin) cannot add or remove helpers", async () => {
    const { deps, added, removed, audits } = fakeDeps(ADMIN);
    expect(await handleHelperAdmin("add", HELPER, `<@${TARGET}>`, deps)).toContain("Only Pixl admins");
    expect(await handleHelperAdmin("remove", HELPER, `<@${TARGET}>`, deps)).toContain("Only Pixl admins");
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
    expect(audits.map((a) => [a.event.action, a.event.result, a.event.slackId])).toEqual([
      ["helpers.add", "denied", HELPER],
      ["helpers.remove", "denied", HELPER],
    ]);
  });

  test("an admin adds and removes a validated target, audited", async () => {
    const { deps, added, removed, audits } = fakeDeps(`U0OTHER001, ${ADMIN}`);
    expect(await handleHelperAdmin("add", ADMIN, `<@${TARGET}|t>`, deps)).toBe(`<@${TARGET}> is now a helper.`);
    expect(await handleHelperAdmin("remove", ADMIN, TARGET, deps)).toBe(`<@${TARGET}> is no longer a helper.`);
    expect(added).toEqual([TARGET]);
    expect(removed).toEqual([TARGET]);
    expect(audits).toEqual([
      { event: { action: "helpers.add", slackId: ADMIN, target: `slack:${TARGET}`, result: "ok" }, isAdmin: true },
      { event: { action: "helpers.remove", slackId: ADMIN, target: `slack:${TARGET}`, result: "ok" }, isAdmin: true },
    ]);
  });

  test("an admin with an invalid target gets usage and nothing is written", async () => {
    const { deps, added } = fakeDeps(ADMIN);
    expect(await handleHelperAdmin("add", ADMIN, "<!channel>", deps)).toContain("Usage");
    expect(await handleHelperAdmin("add", ADMIN, "C0CHANNEL1", deps)).toContain("Usage");
    expect(added).toEqual([]);
  });

  test("a DB failure is reported and audited as an error", async () => {
    const { deps, audits } = fakeDeps(ADMIN);
    deps.addHelper = async () => {
      throw new Error("db down");
    };
    expect(await handleHelperAdmin("add", ADMIN, TARGET, deps)).toBe("Failed to add helper.");
    expect(audits.at(-1)?.event.result).toBe("error");
  });
});
