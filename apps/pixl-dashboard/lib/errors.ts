// Error codes from guardedAction / apps/server -> short player-facing text.
// Unknown codes fall back to a readable version of the code itself.
const MESSAGES: Record<string, string> = {
  unauthorized: "Your session expired. Log in again.",
  invalid_input: "Some of that input wasn't valid.",
  network: "Couldn't reach Pixl. Check your connection and try again.",
  server_unreachable: "Pixl's server is unreachable right now. Try again in a bit.",
  rate_limited: "Slow down a little and try again shortly.",
  insufficient_funds: "You don't have enough pixels for that.",
  not_enough_pixels: "You don't have enough pixels for that.",
  out_of_stock: "That item is out of stock.",
  not_found: "That couldn't be found.",
  forbidden: "You don't have access to that.",
  file_too_large: "That file is too large.",
  cdn_failed: "The upload failed. Try again.",
  address_required: "Verify your address first.",
  not_eligible: "Your account isn't eligible for this yet.",
};

export function humanizeError(code: string | null | undefined): string {
  if (!code) return "Something went wrong.";
  if (MESSAGES[code]) return MESSAGES[code];
  if (/^http_5\d\d$/.test(code)) return "Pixl's server had a problem. Try again.";
  if (/^http_\d+$/.test(code)) return "That request failed.";
  // Server messages that are already sentences pass through.
  if (/\s/.test(code) && code.length < 300) return code;
  return code.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) + ".";
}
