// The one wrapper every Server Action goes through. Kept dependency-injected
// (no next/headers, no next/cache imports here) so it can be unit tested;
// lib/guarded-action.ts wires in the real cookie reader, fetch and cache.
//
// Guarantees, in order:
//   1. a verified session exists (else { ok:false, error:"unauthorized" })
//   2. the input parses against the zod schema (else "invalid_input")
//   3. exactly ONE apps/server endpoint is called - the handler doesn't get a
//      fetch function, it returns a request description and this wrapper
//      performs it, so a handler can't fan out to other endpoints
//   4. a structured log line is written for every attempt
//   5. the result is a typed { ok:true, data } | { ok:false, error }
import type { z } from "zod";
import type { SessionPayload } from "./session";
import { serverFetch, type HttpMethod, type ServerBody, type ServerResult } from "./server-api-core";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ServerCall {
  method: HttpMethod;
  path: string;
  body?: ServerBody;
  /** e.g. "project:12" - included in the log line, never a secret. */
  target?: string;
}

export interface ActionLogLine {
  app: "pixl-dashboard";
  action: string;
  userId: string | null;
  slackId: string | null;
  target: string | null;
  result: "ok" | "denied" | "invalid" | "error";
  status: number | null;
  error: string | null;
  at: string;
}

export interface GuardDeps {
  getAuth: () => Promise<{ token: string; session: SessionPayload } | null>;
  fetchImpl?: typeof fetch;
  log: (line: ActionLogLine) => void;
  revalidate: (path: string) => void;
  now?: () => Date;
}

export interface GuardOptions<T, R> {
  /** Paths whose server-rendered data this action changes. */
  revalidate?: string[];
  /** Shape the server's response down to what the UI needs. */
  pick?: (data: T) => R;
}

export const json = (value: unknown): ServerBody => ({ kind: "json", value });

export function createGuardedAction(deps: GuardDeps) {
  return function guardedAction<S extends z.ZodType, T = unknown, R = T>(
    action: string,
    schema: S,
    handler: (input: z.output<S>, session: SessionPayload) => ServerCall,
    options: GuardOptions<T, R> = {},
  ): (input: z.input<S>) => Promise<ActionResult<R>> {
    return async function run(input: z.input<S>): Promise<ActionResult<R>> {
      const at = (deps.now ?? (() => new Date()))().toISOString();
      const base = { app: "pixl-dashboard" as const, action, at };

      const auth = await deps.getAuth();
      if (!auth) {
        deps.log({ ...base, userId: null, slackId: null, target: null, result: "denied", status: null, error: "unauthorized" });
        return { ok: false, error: "unauthorized" };
      }
      const who = { userId: auth.session.userId, slackId: auth.session.slackId ?? null };

      const parsed = schema.safeParse(input);
      if (!parsed.success) {
        deps.log({ ...base, ...who, target: null, result: "invalid", status: null, error: "invalid_input" });
        return { ok: false, error: "invalid_input" };
      }

      let call: ServerCall;
      try {
        call = handler(parsed.data, auth.session);
      } catch {
        deps.log({ ...base, ...who, target: null, result: "invalid", status: null, error: "invalid_input" });
        return { ok: false, error: "invalid_input" };
      }

      let res: ServerResult<T>;
      try {
        res = await serverFetch<T>(
          call.path,
          { method: call.method, token: auth.token, body: call.body },
          deps.fetchImpl,
        );
      } catch {
        res = { ok: false, status: 0, error: "invalid_request" };
      }

      const target = call.target ?? null;
      if (!res.ok) {
        const result = res.status === 401 || res.status === 403 ? "denied" : "error";
        deps.log({ ...base, ...who, target, result, status: res.status, error: res.error });
        return { ok: false, error: res.status === 401 ? "unauthorized" : res.error };
      }

      deps.log({ ...base, ...who, target, result: "ok", status: res.status, error: null });
      for (const p of options.revalidate ?? []) {
        try {
          deps.revalidate(p);
        } catch {
          // revalidation is best effort; the write already succeeded
        }
      }
      const data = options.pick ? options.pick(res.data) : (res.data as unknown as R);
      return { ok: true, data };
    };
  };
}
