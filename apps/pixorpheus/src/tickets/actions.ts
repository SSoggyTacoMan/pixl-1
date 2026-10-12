import { app } from "../slack/app.js";
import { db } from "../db/client.js";
import {
  checkIsHelper,
  resolveTicket,
  reopenTicket,
  ticketResultText,
  isTicketAuthor,
  deleteTitlePrompt,
  createTicket,
} from "./service.js";
import { pendingTickets } from "./state.js";

app.action("mark_resolved", async ({ ack, body, client }) => {
  await ack();
  const b = body as any;
  const msgTs = b.actions[0].value;
  const resolver = b.user.id;
  const channelId = b.channel.id;

  let ticket;
  try {
    const { data } = await db().from("tickets").select("opened_by_slack_id").eq("msg_ts", msgTs).maybeSingle();
    ticket = data;
  } catch (e) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: resolver,
      text: "Database error - could not load the ticket.",
    });
    return;
  }

  if (!ticket) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: resolver,
      text: "No ticket found for this message.",
    });
    return;
  }

  const isAuthor = ticket.opened_by_slack_id === resolver;
  if (!isAuthor && !(await checkIsHelper(resolver))) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: resolver,
      text: "Only the ticket author or a helper can mark this as resolved.",
    });
    return;
  }

  const result = await resolveTicket(msgTs, resolver, client);
  const resultText = ticketResultText(result);
  if (resultText) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: resolver,
      text: resultText,
    });
  }
});

app.action("reopen_ticket", async ({ ack, body, client }) => {
  await ack();
  const b = body as any;
  const msgTs = b.actions[0].value;
  const reopener = b.user.id;
  const channelId = b.channel.id;

  let ticket;
  try {
    const { data } = await db().from("tickets").select("opened_by_slack_id").eq("msg_ts", msgTs).maybeSingle();
    ticket = data;
  } catch (e) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: reopener,
      text: "Database error - could not load the ticket.",
    });
    return;
  }

  if (!ticket) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: reopener,
      text: "No ticket found for this message.",
    });
    return;
  }

  const isAuthor = ticket.opened_by_slack_id === reopener;
  if (!isAuthor && !(await checkIsHelper(reopener))) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: reopener,
      text: "Only the ticket author or a helper can reopen tickets.",
    });
    return;
  }

  const result = await reopenTicket(msgTs, reopener, client);
  const resultText = ticketResultText(result);
  if (resultText) {
    await client.chat.postEphemeral({
      channel: channelId,
      thread_ts: msgTs,
      user: reopener,
      text: resultText,
    });
  }
});

app.action("view_faq", async ({ ack }) => {
  await ack();
});

app.action("skip_title", async ({ ack, body, client }) => {
  await ack();
  const b = body as any;
  const msgTs = b.actions[0].value;
  if (!(await isTicketAuthor(msgTs, b.user.id))) {
    try {
      await client.chat.postEphemeral({
        channel: b.channel.id,
        thread_ts: msgTs,
        user: b.user.id,
        text: "Only the ticket author can set or skip the title.",
      });
    } catch (e) {}
    return;
  }
  await deleteTitlePrompt(msgTs, client, b.message?.ts);
  const pending = pendingTickets.get(msgTs);
  if (!pending) return;
  await createTicket(pending.event, null, app.client);
});

app.action("open_title_modal", async ({ ack, body, client }) => {
  await ack();
  const b = body as any;
  const msgTs = b.actions[0].value;
  if (!(await isTicketAuthor(msgTs, b.user.id))) {
    try {
      await client.chat.postEphemeral({
        channel: b.channel.id,
        thread_ts: msgTs,
        user: b.user.id,
        text: "Only the ticket author can set or skip the title.",
      });
    } catch (e) {}
    return;
  }
  try {
    await client.views.open({
      trigger_id: b.trigger_id,
      view: {
        type: "modal",
        callback_id: "title_modal",
        private_metadata: JSON.stringify({
          msgTs,
          promptTs: b.message?.ts || null,
        }),
        notify_on_close: true,
        title: { type: "plain_text", text: "Set ticket title" },
        submit: { type: "plain_text", text: "Set title" },
        close: { type: "plain_text", text: "Skip" },
        blocks: [
          {
            type: "input",
            block_id: "title_block",
            label: { type: "plain_text", text: "Title" },
            element: {
              type: "plain_text_input",
              action_id: "title_input",
              placeholder: {
                type: "plain_text",
                text: 'e.g. "Can\'t access my Pixl account"',
              },
              max_length: 100,
            },
          },
        ],
      },
    });
  } catch (e: any) {
    console.error("[open_title_modal]", e.message);
  }
});
