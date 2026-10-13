// Full erasure of one player, for when they ask for their data to be removed.
// Deleting the users row cascades through almost everything (drizzle/0019 and
// every later FK); this also clears what the cascade misses:
// - chat_messages: the FK is ON DELETE SET NULL, so text and name would stay
// - bounty_claims: user_id has no FK
// - Slack-id keyed rows with no FK: Pixo's user_memory / user_personality,
//   help tickets, form submissions, member_joins
// - the player's own IP / user agent in audit_log (the rows stay, without them
//   they hold no PII)
// - project_collaborators.invited_by: NOT NULL with no ON DELETE, which would
//   block the delete, so invites they sent onto other people's projects are
//   handed to that project's owner
// - their records in the staging Airtable base
// The DB part is one transaction: either all of it happens or none of it.
import { deleteAirtableRecords } from "./airtable";
import { AGE_OVERRIDE_JUSTIFICATIONS } from "./ageOverrides";
import { sql } from "./pgCompat";

export interface ErasureResult {
  airtableDeleted: number;
  /** Airtable records we couldn't delete; an owner has to remove them by hand. */
  airtableFailed: string[];
  /** Still hardcoded in lib/ageOverrides.ts and the server's hcaEligibility.ts. */
  ageOverride: boolean;
}

export async function erasePlayer(userId: string): Promise<ErasureResult> {
  const [user] = await sql<{ slack_id: string | null }[]>`select slack_id from users where id = ${userId}`;
  if (!user) throw new Error("Player not found");
  const slackId = user.slack_id?.trim() || null;

  // Record ids first: they live on rows the delete removes.
  const records = await sql<{ id: string }[]>`
    select airtable_record_id as id from projects
      where user_id = ${userId} and airtable_record_id is not null
    union
    select airtable_record_id as id from project_collaborators
      where user_id = ${userId} and airtable_record_id is not null`;
  const airtable = await deleteAirtableRecords(records.map((r) => r.id));

  await sql.begin(async (tx) => {
    await tx`
      update project_collaborators pc set invited_by = p.user_id
      from projects p
      where pc.project_id = p.id and pc.invited_by = ${userId} and p.user_id <> ${userId}`;
    await tx`delete from chat_messages where user_id = ${userId}`;
    await tx`delete from bounty_claims where user_id = ${userId}`;
    await tx`update audit_log set ip = null, user_agent = null where actor_id = ${userId}`;
    if (slackId) {
      await tx`update audit_log set ip = null, user_agent = null where slack_id = ${slackId} and actor_type = 'player'`;
      await tx`delete from user_memory where slack_user_id = ${slackId}`;
      await tx`delete from user_personality where slack_user_id = ${slackId}`;
      await tx`delete from tickets where opened_by_slack_id = ${slackId}`;
      await tx`delete from form_submissions where slack_id = ${slackId}`;
      await tx`delete from member_joins where user_id = ${slackId}`;
    }
    await tx`delete from users where id = ${userId}`;
  });

  return {
    airtableDeleted: airtable.deleted.length,
    airtableFailed: airtable.failed,
    ageOverride: userId in AGE_OVERRIDE_JUSTIFICATIONS,
  };
}

/** The owner-facing summary after an erasure: what's done and what still needs a human. */
export function erasureSummary(name: string, r: ErasureResult): string {
  const parts = [`Erased ${name}'s data.`];
  if (r.airtableDeleted > 0 || r.airtableFailed.length > 0)
    parts.push("If any of their projects were already sent to Hack Club's Unified YSWS DB, ask HQ to remove them there.");
  if (r.airtableFailed.length > 0)
    parts.push(
      `Couldn't delete ${r.airtableFailed.length} Airtable record(s), remove them by hand: ${r.airtableFailed.join(", ")}.`,
    );
  if (r.ageOverride) parts.push("Their id is still in lib/ageOverrides.ts and the server's hcaEligibility.ts, remove it in code.");
  return parts.join(" ");
}
