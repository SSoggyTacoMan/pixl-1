import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  EDIT_SUBMISSION,
  NO_REVIEW,
  REVIEW,
  REVIEW_HARDWARE_ONLY,
  REVIEWER_PERMISSIONS,
  SECOND_PASS,
  resolveAccess,
  reviewerPermsOnly,
  satisfies,
  type RoleInputs,
} from "./roles";
import { clientIp, errorCode, fieldNamesFromArgs, isNavigationSignal, targetFromArgs } from "./auditTarget";

const session = (slackId: string) => ({ slackId, name: slackId, exp: 0 });
const inputs = (over: Partial<RoleInputs> = {}): RoleInputs => ({
  ownerIds: ["UOWNER1"],
  secondPassIds: [],
  adminPermissions: null,
  isHelper: false,
  isFulfiller: false,
  ...over,
});

describe("owner comes from ADMIN_SLACK_IDS only", () => {
  test("an env owner is an owner with every role", () => {
    const a = resolveAccess(session("UOWNER1"), inputs())!;
    expect(a.isOwner).toBe(true);
    expect(a.isReviewer && a.isHelper && a.isFulfiller).toBe(true);
    for (const r of ["owner", "reviewer", "helper", "fulfiller", "staff"] as const)
      expect(satisfies(a, r)).toBe(true);
  });

  test("no admins-row value can make someone an owner", () => {
    const a = resolveAccess(
      session("UOTHER"),
      inputs({ adminPermissions: ["review", "super", "owner", "ban", "shop", "operations", SECOND_PASS] }),
    )!;
    expect(a.isOwner).toBe(false);
    expect(satisfies(a, "owner")).toBe(false);
  });

  test("an owner with NO_REVIEW drops out of the queue but keeps owner rights", () => {
    const a = resolveAccess(session("UOWNER1"), inputs({ adminPermissions: [NO_REVIEW] }))!;
    expect(a.isReviewer).toBe(false);
    expect(satisfies(a, "owner")).toBe(true);
  });
});

describe("reviewer permissions are filtered to review-only values", () => {
  test("only review perms and markers survive", () => {
    expect(reviewerPermsOnly(["review", "ban", "shop", "sponsor", SECOND_PASS, "tickets"]).sort()).toEqual(
      ["review", SECOND_PASS].sort(),
    );
    expect(REVIEWER_PERMISSIONS as readonly string[]).not.toContain("ban");
  });

  test("a reviewer row grants reviewer and nothing owner-level", () => {
    const a = resolveAccess(session("UREV"), inputs({ adminPermissions: [REVIEW, "ban", "shop", "notify"] }))!;
    expect(a.isReviewer).toBe(true);
    expect(satisfies(a, "reviewer")).toBe(true);
    expect(satisfies(a, "owner")).toBe(false);
    expect(satisfies(a, "helper")).toBe(false);
    expect(satisfies(a, "fulfiller")).toBe(false);
  });

  test("a row with only legacy sub-admin perms grants nothing (can't sign in)", () => {
    expect(resolveAccess(session("UOLD"), inputs({ adminPermissions: ["ban", "warn", "shop"] }))).toBeNull();
  });

  test("markers without review grant nothing", () => {
    expect(resolveAccess(session("UX"), inputs({ adminPermissions: [SECOND_PASS, EDIT_SUBMISSION] }))).toBeNull();
  });

  test("second pass needs the marker (or SECOND_PASS_SLACK_IDS) on top of review", () => {
    const plain = resolveAccess(session("UREV"), inputs({ adminPermissions: [REVIEW] }))!;
    expect(plain.canSecondPass).toBe(false);
    expect(satisfies(plain, { review: "second_pass" })).toBe(false);
    const marked = resolveAccess(session("UREV"), inputs({ adminPermissions: [REVIEW, SECOND_PASS] }))!;
    expect(marked.canSecondPass && marked.canEditSubmission).toBe(true);
    const env = resolveAccess(session("UREV"), inputs({ adminPermissions: [REVIEW], secondPassIds: ["UREV"] }))!;
    expect(env.canSecondPass).toBe(true);
  });

  test("SECOND_PASS_SLACK_IDS set: an owner not on it isn't a final reviewer", () => {
    const a = resolveAccess(session("UOWNER1"), inputs({ secondPassIds: ["USOMEONE"] }))!;
    expect(a.canSecondPass).toBe(false);
  });

  test("edit_submission and queue scope markers", () => {
    const a = resolveAccess(
      session("UREV"),
      inputs({ adminPermissions: [REVIEW, EDIT_SUBMISSION, REVIEW_HARDWARE_ONLY] }),
    )!;
    expect(a.canEditSubmission).toBe(true);
    expect(a.canSecondPass).toBe(false);
    expect(a.reviewQueues).toBe("hardware");
  });
});

describe("helpers and fulfillers sign in without an admins row", () => {
  test("helper", () => {
    const a = resolveAccess(session("UHELP"), inputs({ isHelper: true }))!;
    expect(a).not.toBeNull();
    expect(satisfies(a, "helper")).toBe(true);
    expect(satisfies(a, "staff")).toBe(true);
    expect(satisfies(a, "reviewer")).toBe(false);
    expect(satisfies(a, "fulfiller")).toBe(false);
    expect(satisfies(a, "owner")).toBe(false);
  });

  test("fulfiller", () => {
    const a = resolveAccess(session("UFUL"), inputs({ isFulfiller: true }))!;
    expect(a).not.toBeNull();
    expect(satisfies(a, "fulfiller")).toBe(true);
    expect(satisfies(a, "helper")).toBe(false);
    expect(satisfies(a, "owner")).toBe(false);
  });

  test("nobody else gets in", () => {
    expect(resolveAccess(session("URANDOM"), inputs())).toBeNull();
  });
});

describe("audit helpers", () => {
  test("target comes from the first id field, values never land in meta", () => {
    const fd = new FormData();
    fd.set("projectId", "123");
    fd.set("note", "player's home address");
    expect(targetFromArgs([fd])).toBe("project:123");
    expect(fieldNamesFromArgs([fd]).sort()).toEqual(["note", "projectId"]);
    expect(targetFromArgs([42])).toBe("id:42");
    expect(targetFromArgs([])).toBeNull();
  });

  test("client ip is the last (ingress-appended) x-forwarded-for hop, not the spoofable first", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(clientIp((n) => h.get(n))).toBe("10.0.0.1");
    const spoofed = new Headers({ "x-forwarded-for": "6.6.6.6, , 203.0.113.9 ,  " });
    expect(clientIp((n) => spoofed.get(n))).toBe("203.0.113.9");
    const h2 = new Headers({ "x-real-ip": "5.6.7.8" });
    expect(clientIp((n) => h2.get(n))).toBe("5.6.7.8");
  });

  test("audit error meta is a class/code, never the message", () => {
    const pgErr = Object.assign(new Error('duplicate key value (email)=(kid@example.com)'), { code: "23505" });
    expect(errorCode(pgErr)).toBe("Error:23505");
    expect(errorCode(new TypeError("Jane Doe, 1 Main St"))).toBe("TypeError");
    expect(errorCode("raw string with PII")).toBe("string");
    expect(errorCode(Object.assign(new Error("x"), { name: "evil name with spaces" }))).toBe("Error");
    for (const v of [pgErr, new TypeError("Jane Doe, 1 Main St")]) expect(errorCode(v)).not.toMatch(/@|Jane|Main/);
  });

  test("redirect() is control flow, not an error", () => {
    expect(isNavigationSignal({ digest: "NEXT_REDIRECT;replace;/x;307;" })).toBe(true);
    expect(isNavigationSignal(new Error("boom"))).toBe(false);
  });
});

// Every exported server action must go through guardedAction - no exceptions.
function useServerFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) useServerFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) {
      const src = readFileSync(p, "utf8");
      if (/^\s*["']use server["']/.test(src)) out.push(p);
    }
  }
  return out;
}

describe("every server action is guarded", () => {
  const files = useServerFiles(join(import.meta.dir, "../app"));
  test("finds the action files", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
  });
  for (const f of files) {
    test(f.replace(/^.*[\\/]app[\\/]/, "app/"), () => {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/^export (async )?function /m);
      expect(src).not.toMatch(/^export default /m);
      const consts = [...src.matchAll(/^export const (\w+) = (\w+)/gm)];
      expect(consts.length).toBeGreaterThan(0);
      for (const m of consts) expect(`${m[1]}: ${m[2]}`).toBe(`${m[1]}: guardedAction`);
    });
  }
});
