import { TRAINING_CHANNEL } from "../constants.js";
import { isSlackAdmin } from "../slack/admins.js";

// Style training ("pixo:child labor training", "pixo:kawaii") rewrites the
// style notes injected into every single prompt, so it is restricted to Pixl
// admins (SLACK_ADMIN_USER_IDS) talking in the one configured training
// channel. Anywhere else, or from anyone else, the trigger phrases are just
// ordinary messages: nothing is swallowed and nothing is collected.
export function isTrainingAllowed(
  slackUserId: string | null | undefined,
  channel: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return !!channel && channel === TRAINING_CHANNEL && isSlackAdmin(slackUserId, env);
}
