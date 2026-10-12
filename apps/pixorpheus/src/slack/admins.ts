// The only source of elevated power in Pixo: SLACK_ADMIN_USER_IDS (a
// comma-separated list of Slack user IDs set in the deployment env). There
// is no table, ticket-channel membership or helper fallback, and an empty or
// missing variable means nobody is an admin (fail closed).

export function slackAdminIds(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set(
    (env.SLACK_ADMIN_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[UW][A-Z0-9]{5,20}$/.test(s)),
  );
}

export function isSlackAdmin(slackUserId: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!slackUserId) return false;
  return slackAdminIds(env).has(slackUserId);
}
