import { db } from "../db/client.js";
import { aiPost } from "../ai/client.js";

export let styleNotes = "";

export async function loadStyleMemory(): Promise<void> {
  try {
    const { data } = await db()
      .from("style_memory")
      .select("notes")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Legacy rows predate sanitizeStyleNotes, so clean them on load too.
    styleNotes = sanitizeStyleNotes(data?.notes || "");
  } catch (e) {
    styleNotes = "";
  }
}

/** Saved style notes never exceed this (the prompt only reads 400 anyway). */
export const STYLE_NOTES_MAX = 1500;

/**
 * Style notes are model output derived from chat messages and end up in
 * every prompt, so they are stored as plain prose: every Slack control
 * sequence (<!channel>, <@U...>, <#C...>, <https://...|label>, mailto:,
 * slack://) and bare URL is removed, and the length is capped.
 */
export function sanitizeStyleNotes(notes: string): string {
  return notes
    .replace(/<[^>]*>/g, " ")
    .replace(/<|>/g, " ")
    .replace(/\b(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|tel:|slack:|www\.)\S+/gi, " ")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, STYLE_NOTES_MAX);
}

export async function saveStyleMemory(rawNotes: string): Promise<void> {
  const notes = sanitizeStyleNotes(rawNotes);
  if (!notes) return;
  styleNotes = notes;
  try {
    await db().from("style_memory").delete().gte("id", 1);
    await db().from("style_memory").insert({ notes });
  } catch (e: any) {
    console.error("saveStyleMemory error:", e.message);
  }
}

export async function extractStyle(messages: string[]): Promise<string | null> {
  const combined = messages.join("\n");
  try {
    const res = await aiPost({
      messages: [
        {
          role: "system",
          content:
            "You are analyzing the writing style of French/English-speaking gen Z users. Extract specific speech patterns, vocabulary, expressions, humor style, and quirks from their messages. Output a concise style guide (10-15 points max) that another AI could use to naturally imitate their writing. Focus on: vocabulary, abbreviations, humor type, punctuation habits, emoji use, sentence structure, tone, recurring expressions. Write in English, be specific and concrete, no vague generalities.",
        },
        { role: "user", content: `Analyze these messages and extract the speaking style:\n\n${combined}` },
      ],
      max_tokens: 600,
    });
    return res.data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    return null;
  }
}
