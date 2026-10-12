import { app } from "../slack/app.js";
import { db } from "../db/client.js";
import { audit } from "../audit.js";
import { handleHelperAdmin, type HelperAdminDeps } from "./helperAdmin.js";

const helperAdminDeps: HelperAdminDeps = {
  addHelper: async (slackUserId) => {
    const { error } = await db()
      .from("helpers")
      .upsert({ slack_user_id: slackUserId }, { onConflict: "slack_user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  },
  removeHelper: async (slackUserId) => {
    const { error } = await db().from("helpers").delete().eq("slack_user_id", slackUserId);
    if (error) throw new Error(error.message);
  },
  audit,
};

app.command("/pixl-addhelper", async ({ command, ack, respond }) => {
  await ack();
  await respond({ text: await handleHelperAdmin("add", command.user_id, command.text, helperAdminDeps) });
});

app.command("/pixl-removehelper", async ({ command, ack, respond }) => {
  await ack();
  await respond({ text: await handleHelperAdmin("remove", command.user_id, command.text, helperAdminDeps) });
});

app.command("/pixl-helpers", async ({ ack, respond }) => {
  await ack();
  const { data: rows } = await db().from("helpers").select("slack_user_id");
  if (!rows?.length) {
    await respond({ text: "No helpers registered yet." });
    return;
  }
  await respond({
    text: `*Current helpers:*\n${rows.map((r) => `• <@${r.slack_user_id}>`).join("\n")}`,
  });
});

app.command("/pixl-helpstats", async ({ ack, respond }) => {
  await ack();
  const [{ count: total }, { count: open }, { count: closed }] = await Promise.all([
    db().from("tickets").select("*", { count: "exact", head: true }),
    db().from("tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
    db().from("tickets").select("*", { count: "exact", head: true }).eq("status", "closed"),
  ]);
  await respond({
    text: `*Ticket Stats*\n• Total: ${total ?? 0}\n• Open: ${open ?? 0}\n• Resolved: ${closed ?? 0}`,
  });
});
