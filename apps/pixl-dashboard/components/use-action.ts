"use client";

// Client-side wrapper around a guarded Server Action: pending flag, last
// error (humanized), and a run() that resolves to the typed result.
import { useCallback, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/guarded-action-core";
import { humanizeError } from "@/lib/errors";

export function useAction<I, R>(action: (input: I) => Promise<ActionResult<R>>) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (input: I): Promise<ActionResult<R>> =>
      new Promise((resolve) => {
        setError(null);
        startTransition(async () => {
          let res: ActionResult<R>;
          try {
            res = await action(input);
          } catch {
            res = { ok: false, error: "network" };
          }
          if (!res.ok) setError(humanizeError(res.error));
          resolve(res);
        });
      }),
    [action],
  );

  return { run, pending, error, setError };
}

/** Navigates to a flow URL returned by apps/server (already https-checked server side). */
export function goTo(url: string | null | undefined): boolean {
  if (!url || !url.startsWith("https://")) return false;
  window.location.assign(url);
  return true;
}
