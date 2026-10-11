export type ConnectOutcome = "connected" | "failed" | null;

/** ?hackatime= as set by apps/server's Hackatime callback; anything else is ignored. */
export function outcomeFrom(raw: string | string[] | undefined): ConnectOutcome {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "connected" || v === "failed" ? v : null;
}
