// Per-player data this app keeps in browser storage. Logging out clears all
// of it (clearPlayerLocalState, called from the LOG OUT form) so the next
// person on a shared computer can't read an unposted journal draft or pick up
// someone else's tour progress. Device preferences (theme, font, locale, docs
// nav) are not per-player and are left alone.

/** localStorage key prefix for unposted journal drafts, one per project. */
export const JOURNAL_DRAFT_PREFIX = "pixl_journal_draft_";
export const journalDraftKey = (projectId: number) => `${JOURNAL_DRAFT_PREFIX}${projectId}`;

export const TOUR_STEP_KEY = "pixl_tour_step";
export const ONBOARDED_KEY = "pixl_onboarded";
export const FP_SHOWN_KEY = "pixl_fp_shown";

const LOCAL_KEYS = [TOUR_STEP_KEY, ONBOARDED_KEY];
const SESSION_KEYS = [FP_SHOWN_KEY];

type StorageLike = Pick<Storage, "length" | "key" | "removeItem">;

function sweep(store: StorageLike | null | undefined, exact: string[], prefixes: string[]) {
  if (!store) return;
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k !== null && (exact.includes(k) || prefixes.some((p) => k.startsWith(p)))) doomed.push(k);
  }
  for (const k of doomed) store.removeItem(k);
}

function safeStore(get: () => StorageLike): StorageLike | null {
  try {
    return get();
  } catch {
    return null;
  }
}

/** Removes every per-player key. Never throws (storage may be blocked). */
export function clearPlayerLocalState(
  local: StorageLike | null = typeof window === "undefined" ? null : safeStore(() => window.localStorage),
  session: StorageLike | null = typeof window === "undefined" ? null : safeStore(() => window.sessionStorage),
): void {
  try {
    sweep(local, LOCAL_KEYS, [JOURNAL_DRAFT_PREFIX]);
  } catch {
    // best effort
  }
  try {
    sweep(session, SESSION_KEYS, []);
  } catch {
    // best effort
  }
}
