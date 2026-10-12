import { tsStr } from "../db/client.js";
import type { TicketRow } from "./types.js";

export function normalizeTicket(t: Record<string, unknown> | null | undefined): TicketRow | null {
  if (!t) return null;
  return {
    ...t,
    msg_ts: tsStr(t.msg_ts),
    title_prompt_ts: tsStr(t.title_prompt_ts),
  } as TicketRow;
}
