import { app } from "../slack/app.js";
import { aiPost } from "../ai/client.js";
import { sanitizeAIOutput } from "../ai/outputFilter.js";
import { checkAiRateLimit, AI_RATE_LIMIT_MESSAGE } from "../ai/rateLimit.js";
import { getSafeFacts, getSafeTraits, getDisplayName, GARBAGE_PATTERNS } from "../memory/users.js";
import { isSlackAdmin } from "../slack/admins.js";
import { audit } from "../audit.js";
import { programMemory, addProgramFact, removeProgramFact } from "../memory/program.js";
import { checkIsHelper, checkIsInTicketChannel } from "../tickets/service.js";

// Program facts are injected into every prompt Pixo builds, for everyone,
// so writing them is an admin-only power (SLACK_ADMIN_USER_IDS): not helpers,
// not ticket-channel members, and no hardcoded per-person bypass.
app.command("/pixl-remember", async ({ command, ack, respond }) => {
  await ack();
  const admin = isSlackAdmin(command.user_id);
  if (!admin) {
    await audit({ action: "program_memory.add", slackId: command.user_id, result: "denied" }, false);
    await respond({ text: "Only Pixl admins can add to my memory." });
    return;
  }
  const fact = command.text?.trim();
  if (!fact) {
    await respond({ text: "Usage: `/pixl-remember [fact about this server]`" });
    return;
  }
  await addProgramFact(fact);
  await audit({ action: "program_memory.add", slackId: command.user_id, result: "ok" }, true);
  await respond({ text: `got it, i'll remember: _${fact}_` });
});

app.command("/pixl-forget", async ({ command, ack, respond }) => {
  await ack();
  if (!isSlackAdmin(command.user_id)) {
    await audit({ action: "program_memory.remove", slackId: command.user_id, result: "denied" }, false);
    await respond({ text: "Only Pixl admins can modify my memory." });
    return;
  }
  if (!programMemory.length) {
    await respond({ text: "nothing stored to forget lol" });
    return;
  }
  const idx = parseInt(command.text?.trim() || "") - 1;
  if (isNaN(idx) || idx < 0 || idx >= programMemory.length) {
    await respond({
      text: `Usage: \`/pixl-forget [number]\`\n${programMemory.map((f, i) => `${i + 1}. ${f}`).join("\n")}`,
    });
    return;
  }
  const removed = programMemory[idx];
  await removeProgramFact(idx);
  await audit({ action: "program_memory.remove", slackId: command.user_id, result: "ok" }, true);
  await respond({ text: `forgot: _${removed}_` });
});

app.command("/pixl-memories", async ({ command, ack, respond, client }) => {
  await ack();
  const isAdmin = await checkIsHelper(command.user_id);
  const isInTicketChannel = await checkIsInTicketChannel(command.user_id, client);
  if (!isAdmin && !isInTicketChannel) {
    await respond({
      text: "Only support team members can view stored memories.",
    });
    return;
  }
  if (!programMemory.length) {
    await respond({
      text: "nothing stored yet. use `/pixl-remember [fact]` to add some.",
    });
    return;
  }
  await respond({
    text: `*Stored program memories:*\n${programMemory.map((f, i) => `${i + 1}. ${f}`).join("\n")}`,
  });
});

// /pixl-mymemory [@user] - shows what pixorpheus remembers about you or someone else
app.command("/pixl-mymemory", async ({ command, ack, respond }) => {
  await ack();
  if (!checkAiRateLimit(command.user_id)) {
    await respond({ text: AI_RATE_LIMIT_MESSAGE, response_type: "ephemeral" });
    return;
  }
  const mentionMatch = command.text?.trim().match(/^<@([A-Z0-9]+)(?:\|[^>]+)?>/);
  const targetId = mentionMatch ? mentionMatch[1] : command.user_id;
  const isSelf = targetId === command.user_id;

  // Memory is harvested from private DMs, so only the subject themself or a
  // Pixl admin (SLACK_ADMIN_USER_IDS, env only) can look it up. Helpers and
  // ticket-channel members no longer can, and every cross-user lookup is
  // audited.
  if (!isSelf) {
    const admin = isSlackAdmin(command.user_id);
    await audit(
      { action: "memory.read_other", slackId: command.user_id, target: `slack:${targetId}`, result: admin ? "ok" : "denied" },
      admin,
    );
    if (!admin) {
      await respond({ text: "you can only look up your own memory.", response_type: "ephemeral" });
      return;
    }
  }

  const traitList = getSafeTraits(targetId);
  const cleanFacts = getSafeFacts(targetId).filter((f) => !GARBAGE_PATTERNS.some((p) => p.test(f)));

  const displayName = getDisplayName(targetId) || (isSelf ? "you" : `<@${targetId}>`);

  if (!cleanFacts.length && !traitList.length) {
    await respond({
      text: `i don't remember anything about ${isSelf ? "you" : displayName} yet 💀`,
      response_type: "ephemeral",
    });
    return;
  }

  try {
    const input = [
      cleanFacts.length ? `facts: ${cleanFacts.join(", ")}` : null,
      traitList.length ? `personality: ${traitList.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // Memory can contain sensitive facts about the subject, so this always
    // goes back through respond() (ephemeral, visible only to the caller),
    // never posted into the channel, even for the "someone else" case.
    const res = await aiPost({
      messages: [
        {
          role: "system",
          content: isSelf
            ? `You are Pixorpheus, a sarcastic Slack bot. The person asking is the subject, speak DIRECTLY to them using "you". Write 1-2 casual sentences summarizing what you know about them. Lowercase, conversational, gen Z energy. No lists. Only mention real concrete things, skip anything vague.`
            : `You are Pixorpheus, a sarcastic Slack bot. Write 1-2 casual sentences summarizing who ${displayName} is. Use their name or "they". Lowercase, conversational, gen Z energy. No lists. Only mention real concrete things, skip anything vague.`,
        },
        { role: "user", content: input },
      ],
      max_tokens: 120,
    });
    const summary = res.data.choices?.[0]?.message?.content?.trim();
    if (summary) {
      const safeSummary = sanitizeAIOutput(summary);
      await respond({
        text: isSelf ? `here's what i got on you:\n${safeSummary}` : `here's what i know about ${displayName}:\n${safeSummary}`,
        response_type: "ephemeral",
      });
      return;
    }
  } catch (e) {}

  await respond({
    text: isSelf
      ? `here's what i got on you:\n${cleanFacts.join("\n")}`
      : `here's what i know about ${displayName}:\n${cleanFacts.map((f) => `• ${f}`).join("\n")}`,
    response_type: "ephemeral",
  });
});
