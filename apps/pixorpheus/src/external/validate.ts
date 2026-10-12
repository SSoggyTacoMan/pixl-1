import { isSlackUserId } from "../slack/pixlMembership.js";

// Request-body validators for the external (dashboard -> Pixo) API, kept
// apart from ticketApi.ts so they can be tested without booting Bolt.

export function slackUserIdFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  if (!("slackId" in body) || typeof body.slackId !== "string") return null;
  const slackId = body.slackId.trim();
  return isSlackUserId(slackId) ? slackId : null;
}

/** A Slack message timestamp, e.g. "1700000000.123456". */
export function isSlackTs(value: unknown): value is string {
  return typeof value === "string" && /^\d{9,11}\.\d{6}$/.test(value);
}
