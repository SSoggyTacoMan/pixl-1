// Pixo talks to Slack over Socket Mode only: it has no public hostname, so
// events, interactivity, slash commands and shortcuts all arrive over the
// socket Bolt opens with the app-level token. Without either token Bolt would
// start and then fail per request, so refuse to boot instead.
export function requireSlackEnv(env: Record<string, string | undefined> = process.env): {
  token: string;
  appToken: string;
} {
  const token = env.SLACK_BOT_TOKEN?.trim();
  const appToken = env.SLACK_APP_TOKEN?.trim();
  const missing = [!token && "SLACK_BOT_TOKEN", !appToken && "SLACK_APP_TOKEN"].filter(Boolean);
  if (missing.length) throw new Error(`Pixo cannot start: missing ${missing.join(", ")}`);
  if (!appToken!.startsWith("xapp-"))
    throw new Error("Pixo cannot start: SLACK_APP_TOKEN must be an app-level token (xapp-, scope connections:write)");
  return { token: token!, appToken: appToken! };
}
