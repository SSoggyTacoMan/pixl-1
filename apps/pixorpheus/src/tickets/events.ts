import { app } from "../slack/app.js";
import { SILENCED_CHANNELS } from "../constants.js";
import { handleMessageInThread, handleNewQuestion } from "./service.js";
import type { PendingTicketEvent } from "./state.js";

app.event("message", async ({ event, client }) => {
  const e = event as any;
  if (SILENCED_CHANNELS.has(e.channel)) return;
  if (e.channel !== process.env.SLACK_HELP_CHANNEL) return;
  if (e.bot_id) return;

  const allowedSubtypes = ["file_share", "me_message", "thread_broadcast"];
  if (e.subtype && !allowedSubtypes.includes(e.subtype)) return;

  if (e.thread_ts) {
    await handleMessageInThread(e as PendingTicketEvent & { thread_ts: string }, client);
  } else {
    await handleNewQuestion(e as PendingTicketEvent, client);
  }
});
