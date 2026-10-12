// Bolt happily starts with an undefined signing secret or token and then
// fails (or worse, mis-verifies) per request. Refuse to boot instead.
export function requireSlackEnv(env: Record<string, string | undefined> = process.env): {
  signingSecret: string;
  token: string;
} {
  const signingSecret = env.SLACK_SIGNING_SECRET?.trim();
  const token = env.SLACK_BOT_TOKEN?.trim();
  const missing = [!signingSecret && "SLACK_SIGNING_SECRET", !token && "SLACK_BOT_TOKEN"].filter(Boolean);
  if (missing.length) throw new Error(`Pixo cannot start: missing ${missing.join(", ")}`);
  return { signingSecret: signingSecret!, token: token! };
}
