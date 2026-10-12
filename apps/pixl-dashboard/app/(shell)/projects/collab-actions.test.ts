import { describe, expect, mock, test } from "bun:test";
import type { z } from "zod";

// Capture what each guardedAction is declared with instead of running it
// (the real wrapper is covered by lib/guarded-action.test.ts).
type Decl = { schema: z.ZodType; handler: (input: unknown) => { method: string; path: string; target?: string }; opts: { pick?: (d: unknown) => unknown } };
const decls = new Map<string, Decl>();
mock.module("@/lib/guarded-action", () => ({
  json: (value: unknown) => ({ kind: "json", value }),
  guardedAction: (name: string, schema: z.ZodType, handler: Decl["handler"], opts: Decl["opts"] = {}) => {
    decls.set(name, { schema, handler, opts });
    return async () => ({ ok: false, error: "not_in_test" });
  },
}));
await import("./collab-actions");

describe("rotateJoinCode", () => {
  const d = decls.get("collab.code_rotate")!;
  test("POSTs the owner-only rotate endpoint for that project", () => {
    const input = d.schema.parse({ projectId: 12 });
    expect(d.handler(input)).toEqual({ method: "POST", path: "/api/projects/12/collaborators/code/rotate", target: "project:12" });
  });
  test("project id must be a positive int", () => {
    for (const bad of [0, -1, 1.5, "12", "12/../x", null]) expect(d.schema.safeParse({ projectId: bad }).success).toBe(false);
  });
  test("only the new code string reaches the client", () => {
    expect(d.opts.pick!({ ok: true, code: "BLUE-FOX", extra: "x" })).toEqual({ code: "BLUE-FOX" });
    expect(d.opts.pick!({ ok: true })).toEqual({ code: "" });
  });
});
