import { isSlackAdmin } from "../slack/admins.js";
import { isSlackUserId } from "../slack/pixlMembership.js";
import type { PixoAuditEvent } from "../audit.js";

// Pure logic for /pixl-addhelper and /pixl-removehelper, kept apart from the
// Bolt wiring in helpers.ts so it can be tested without a Slack app.
//
// Granting ticket-helper power is restricted to SLACK_ADMIN_USER_IDS only.
// It used to also accept any existing helper or any member of the ticket
// channel, so one helper (or anyone who got into that channel) could mint
// more helpers indefinitely.

export interface HelperAdminDeps {
  addHelper(slackUserId: string): Promise<void>;
  removeHelper(slackUserId: string): Promise<void>;
  audit(event: PixoAuditEvent, isAdmin: boolean): Promise<void>;
  env?: Record<string, string | undefined>;
}

export type HelperAdminKind = "add" | "remove";

export function parseTargetUserId(text: string | undefined): string | null {
  const raw = (text || "").trim();
  if (!raw) return null;
  const fromMention = raw.match(/^<@([A-Z0-9]+)(?:\|[^>]*)?>$/)?.[1];
  const candidate = fromMention ?? raw;
  return isSlackUserId(candidate) ? candidate : null;
}

export async function handleHelperAdmin(
  kind: HelperAdminKind,
  requesterId: string,
  text: string | undefined,
  deps: HelperAdminDeps,
): Promise<string> {
  const action = kind === "add" ? "helpers.add" : "helpers.remove";
  const usage = kind === "add" ? "Usage: `/pixl-addhelper @username`" : "Usage: `/pixl-removehelper @username`";
  const admin = isSlackAdmin(requesterId, deps.env);
  if (!admin) {
    await deps.audit({ action, slackId: requesterId, result: "denied", meta: { reason: "not_admin" } }, false);
    return "Only Pixl admins can change the helper list.";
  }
  const target = parseTargetUserId(text);
  if (!target) {
    await deps.audit({ action, slackId: requesterId, result: "error", meta: { reason: "invalid_target" } }, true);
    return usage;
  }
  try {
    if (kind === "add") await deps.addHelper(target);
    else await deps.removeHelper(target);
  } catch {
    await deps.audit({ action, slackId: requesterId, target: `slack:${target}`, result: "error" }, true);
    return kind === "add" ? "Failed to add helper." : "Failed to remove helper.";
  }
  await deps.audit({ action, slackId: requesterId, target: `slack:${target}`, result: "ok" }, true);
  return kind === "add" ? `<@${target}> is now a helper.` : `<@${target}> is no longer a helper.`;
}
