import { app } from "../slack/app.js";
import { PIXL_MAIN_CHANNEL } from "../constants.js";
import { db } from "../db/client.js";
import { welcomeThreads } from "./thread.js";
import { hasLaunched } from "../config.generated.js";

// End-of-day "new members" digest. Replaces the instant per-join welcome in the
// main channel: every join is recorded in member_joins (see welcomeMessages.ts),
// and once a day we post a single message welcoming everyone who joined.
//
// Time/timezone are configurable; default is 21:00 Europe/Paris. The schedule
// recomputes the next fire time after each run, so it stays correct across DST.
const DIGEST_HOUR = Math.min(23, Math.max(0, Number(process.env.NEW_MEMBERS_DIGEST_HOUR ?? 21)));
const DIGEST_TZ = process.env.NEW_MEMBERS_DIGEST_TZ ?? "Europe/Paris";

// Team subteam, cc'd once per digest (same group the old instant welcome cc'd).
const TEAM_SUBTEAM = "S0BFM30573R";

/** Record a main-channel join for the daily digest. Idempotent per user. */
export async function recordMemberJoin(userId: string, channel: string): Promise<void> {
  try {
    await db()
      .from("member_joins")
      .upsert({ user_id: userId, channel }, { onConflict: "user_id", ignoreDuplicates: true });
  } catch (e: any) {
    console.error("[new-members-digest] record failed:", e?.message ?? e);
  }
}

/** Milliseconds until the next DIGEST_HOUR:00 in DIGEST_TZ. */
function msUntilNextDigest(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DIGEST_TZ,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const h = get("hour") % 24; // en-US can render midnight as "24"
  const nowSec = h * 3600 + get("minute") * 60 + get("second");
  let untilSec = DIGEST_HOUR * 3600 - nowSec;
  if (untilSec <= 0) untilSec += 24 * 3600;
  return untilSec * 1000;
}
