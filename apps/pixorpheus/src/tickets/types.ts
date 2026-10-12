export interface TicketRow {
  msg_ts: string;
  title_prompt_ts: string | null;
  description: string | null;
  title: string | null;
  opened_by_slack_id: string;
  status: "open" | "closed";
  claimed_by_slack_id: string | null;
  closed_by_slack_id: string | null;
  closed_at: string | null;
  ticket_number: number | string | null;
  permalink: string | null;
  last_msg_at: string | null;
  [key: string]: unknown;
}
