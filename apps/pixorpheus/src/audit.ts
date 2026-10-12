import { sql } from "./db/pgCompat.js";

// Pixo's side of the shared audit_log table (apps/server/drizzle/0214).
// Fire-and-forget like the server's writer: a failed insert goes to stderr
// (as a structured line, so the event is never lost entirely) and never
// breaks the command that triggered it. `meta` must never carry tokens,
// secrets or message content - only ids and short reason strings.

export type PixoAuditResult = "ok" | "denied" | "error";

export interface PixoAuditEvent {
  action: string;
  slackId: string | null;
  target?: string | null;
  result: PixoAuditResult;
  meta?: Record<string, unknown>;
}

export interface PixoAuditRow {
  app: "pixorpheus";
  actor_type: "staff" | "player";
  actor_id: string | null;
  slack_id: string | null;
  action: string;
  target: string | null;
  result: PixoAuditResult;
  meta: Record<string, unknown>;
}

export type PixoAuditWriter = (row: PixoAuditRow) => Promise<void>;

async function insertRow(row: PixoAuditRow): Promise<void> {
  await sql.unsafe(
    `insert into audit_log (app, actor_type, actor_id, slack_id, action, target, result, meta)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [row.app, row.actor_type, row.actor_id, row.slack_id, row.action, row.target, row.result, JSON.stringify(row.meta)],
  );
}

let writer: PixoAuditWriter = insertRow;

/** Tests swap the writer; returns the previous one. */
export function setAuditWriter(next: PixoAuditWriter): PixoAuditWriter {
  const prev = writer;
  writer = next;
  return prev;
}

export function auditRow(event: PixoAuditEvent, isAdmin: boolean): PixoAuditRow {
  return {
    app: "pixorpheus",
    actor_type: isAdmin ? "staff" : "player",
    actor_id: event.slackId,
    slack_id: event.slackId,
    action: event.action.slice(0, 128),
    target: event.target ? event.target.slice(0, 512) : null,
    result: event.result,
    meta: event.meta ?? {},
  };
}

export async function audit(event: PixoAuditEvent, isAdmin: boolean): Promise<void> {
  const row = auditRow(event, isAdmin);
  try {
    await writer(row);
  } catch (e: any) {
    console.error(JSON.stringify({ audit_write_failed: true, error: e?.message ?? String(e), row }));
  }
}
