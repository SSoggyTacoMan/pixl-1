import { config } from "@/app/_generated/config";

/** The game lives on its own host; this site never proxies it. */
export const GAME_URL = config.urls.play;

/**
 * Login entry for a signed-out page. Always this app's own route (it binds
 * the login `state` cookie before the browser leaves); `next` must be a
 * same-site path and is re-checked server side by safeNext().
 */
export function loginUrl(next: string): string {
  return `/api/auth/login?next=${encodeURIComponent(next || "/dashboard")}`;
}
