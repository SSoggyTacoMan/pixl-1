// Labels for PUBLIC, unauthenticated pages (stats.pixl.rsvp / app/stats).
// Pure (no DB) so it's unit-testable.
//
// Never use playerLabel() (lib/db.ts) on a public page: it prefers real_name,
// the player's legal name from Hack Club Auth. Players are mostly minors; the
// only thing a public page may show is the in-game display_name they chose to
// make public themselves.
export const PUBLIC_FALLBACK_NAME = "a Pixl player";

export function publicOwnerLabel(u: { display_name?: string | null } | null | undefined): string {
  const name = typeof u?.display_name === "string" ? u.display_name.trim() : "";
  return name ? name.slice(0, 40) : PUBLIC_FALLBACK_NAME;
}

// The exact users columns a public query may embed. Kept here so the test can
// pin it: adding real_name/email/slack_id to this string is the bug.
export const PUBLIC_USER_COLUMNS = "display_name";
