// Safe, typed extras copied out of an apps/server JSON error body so the UI
// can show specific copy ("needs 3h, you're at 1.2h") instead of a generic
// line. Only the whitelisted fields below are ever copied, and only when
// they're the expected primitive shape - a raw server body (which could
// carry anything, including text we didn't write) never reaches the client.

export interface ActionDetails {
  /** Required amount: trial hours, journal characters/images, trophy XP. */
  need?: number;
  /** What the player currently has toward `need`. */
  have?: number;
  /** Hours being logged on a journal entry. */
  hours?: number;
  /** Player's XP (trophy claim). */
  xp?: number;
  /** Wallet balance in pixels (shop buy). */
  balance?: number;
  /** Price in pixels (shop buy). */
  price?: number;
  /** Hack Club Auth verification status, e.g. "pending". */
  hcaStatus?: string;
  /** Buyer region code (shop wrong_region). */
  region?: string;
  /** Region the item is sold in (shop wrong_region). */
  itemRegion?: string;
}

const NUMBER_FIELDS = ["need", "have", "hours", "xp", "balance", "price"] as const;
const MAX_ABS = 1e12;

// [server key, details key, allowed pattern]
const STRING_FIELDS: ReadonlyArray<readonly [string, "hcaStatus" | "region" | "itemRegion", RegExp]> = [
  ["hca_status", "hcaStatus", /^[a-z_]{1,32}$/],
  ["region", "region", /^[A-Za-z_-]{1,32}$/],
  ["item_region", "itemRegion", /^[A-Za-z_-]{1,32}$/],
];

export function pickDetails(data: unknown): ActionDetails | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const src = data as Record<string, unknown>;
  const out: ActionDetails = {};
  for (const key of NUMBER_FIELDS) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_ABS) out[key] = v;
  }
  for (const [from, to, re] of STRING_FIELDS) {
    const v = src[from];
    if (typeof v === "string" && re.test(v)) out[to] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
