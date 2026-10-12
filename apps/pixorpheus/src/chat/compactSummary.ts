import { sanitizeAIOutput } from "../ai/outputFilter.js";

/**
 * A compact is model output summarizing what players said, posted publicly
 * (pixo compact) - so a player can plant "<!channel>" or a slur in the day's
 * chat and have the model repeat it. Run it through the same output filter
 * every other AI reply goes through; "" (dropped whole) means no compact.
 * Applied both when generating and when reading a stored row, so a row
 * written before this filter existed is cleaned on the way out too.
 */
export function safeCompactSummary(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return sanitizeAIOutput(raw).trim() || null;
}
