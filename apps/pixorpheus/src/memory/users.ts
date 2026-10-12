import type { WebClient } from "@slack/web-api";
import { db } from "../db/client.js";
import { aiPost } from "../ai/client.js";
import { botIdentity } from "../slack/identity.js";
import { isIdentityFact, safeFacts } from "./identityFilter.js";

export const userMemory = new Map<string, string[]>();
export const personalityMemory = new Map<string, string[]>();

export function parseFacts(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * The stored facts about a user that are safe to show or feed to a model.
 * Every reader goes through this (never userMemory.get directly), so legacy
 * rows saved before the identity filter existed are dropped at read time.
 * Legacy "name is X" facts are excluded too (isIdentityFact matches them);
 * display names come only from the Slack profile, see getDisplayName.
 */
export function getSafeFacts(userId: string | null | undefined): string[] {
  if (!userId) return [];
  return safeFacts(parseFacts(userMemory.get(userId)));
}

/** Same as getSafeFacts, for personality traits. */
export function getSafeTraits(userId: string | null | undefined): string[] {
  if (!userId) return [];
  return safeFacts(parseFacts(personalityMemory.get(userId)));
}

export async function loadMemory(): Promise<void> {
  try {
    const { data } = await db().from("user_memory").select("slack_user_id, facts");
    for (const row of data || []) userMemory.set(row.slack_user_id, parseFacts(row.facts));
  } catch (e) {
    // best-effort on boot
  }
}

export async function loadPersonalityMemory(): Promise<void> {
  try {
    const { data } = await db().from("user_personality").select("slack_user_id, traits");
    for (const row of data || []) personalityMemory.set(row.slack_user_id, row.traits);
  } catch (e) {
    // best-effort on boot
  }
}

export async function savePersonality(userId: string, traits: string[]): Promise<void> {
  personalityMemory.set(userId, traits);
  try {
    await db()
      .from("user_personality")
      .upsert({ slack_user_id: userId, traits }, { onConflict: "slack_user_id" });
  } catch (e: any) {
    console.error("savePersonality error:", e.message);
  }
}

export async function saveUserMemory(userId: string, facts: string[]): Promise<void> {
  userMemory.set(userId, facts);
  try {
    await db()
      .from("user_memory")
      .upsert({ slack_user_id: userId, facts }, { onConflict: "slack_user_id" });
  } catch (e: any) {
    console.error("saveUserMemory error:", e.message);
  }
}

// Slack display names, cached in memory only. This used to be stored as a
// "name is X" fact in user_memory and read back from there, but legacy rows
// written by the old extractor can hold a "name is <real name>" fact too,
// and reading the name back from memory would surface it. The display name
// now always comes from the user's Slack profile (what they chose to show
// the workspace), never from stored memory.
const DISPLAY_NAME_TTL_MS = 6 * 3600_000;
const displayNames = new Map<string, { name: string; at: number }>();

export async function ensureUserName(userId: string, client: WebClient): Promise<void> {
  const cached = displayNames.get(userId);
  if (cached && Date.now() - cached.at < DISPLAY_NAME_TTL_MS) return;
  try {
    const info = await client.users.info({ user: userId });
    // Display name only, never real_name: the display name is what the user
    // chose to show the workspace, the real name is identity data.
    const name = (info.user?.profile?.display_name || "").trim();
    if (!name) {
      displayNames.delete(userId);
      return;
    }
    displayNames.set(userId, { name: name.slice(0, 80), at: Date.now() });
  } catch (e) {
    // best-effort
  }
}

export function getDisplayName(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return displayNames.get(userId)?.name ?? null;
}

export function resolveUserMentions(text: string): string {
  return text.replace(/<@([A-Z0-9]+)(?:\|[^>]*)?>/g, (match, uid) => {
    if (uid === botIdentity.userId) return "@pixorpheus";
    const name = getDisplayName(uid);
    return name ? `@${name}` : match;
  });
}

export const GARBAGE_PATTERNS = [
  /nothing worth/i,
  /output.*nothing/i,
  /potential consideration/i,
  /is there something/i,
  /could you provide/i,
  /to create a/i,
  /information about/i,
  /multiple messages/i,
  /recurring themes/i,
  /i.d typically need/i,
  /\*\*/,
  /broader context/i,
  /conversation/i,
  /memorable facts/i,
  /this (person|exchange|message)/i,
  /provide more/i,
];

export async function extractMemory(userId: string, messages: string[]): Promise<void> {
  const combined = messages.join("\n");
  if (combined.length < 10) return;
  try {
    const res = await aiPost({
      messages: [
        {
          role: "system",
          content: `Extract up to 10 harmless preferences and interests of THE AUTHOR of these messages, things a friend would remember to make small talk. Capture ONLY:
- Interests: hobbies, games, music, shows, tech stack, programming languages, favorite things
- Opinions: things they love or hate, strong takes, pet peeves
- Projects: what they are building or shipped for Pixl
NEVER output anything that identifies who they are or where to find them, even if they state it directly: no real name, no age, birthday or grade, no city, country, nationality, timezone or school, no pronouns, gender or sexuality, no family members or relationships, no religion or health, no email, phone, username or social account, no job or employer. If a message only contains that kind of detail, skip it.
RULES:
- Short phrases only, max 10 words each, one per line
- Only things stated BY THE AUTHOR about THEMSELVES, never facts about other people they mention
- If someone says "alex loves pizza", that's about alex, not the author, SKIP it
- If there is nothing worth saving, output exactly: SKIP
- No bullets, no numbers, no explanations, no meta-commentary, no questions`,
        },
        { role: "user", content: combined },
      ],
      max_tokens: 250,
    });
    const raw = res.data.choices?.[0]?.message?.content?.trim();
    if (!raw || raw.toUpperCase() === "SKIP") return;
    const newFacts = raw
      .split("\n")
      .map((f) => f.replace(/^[-•*\d.]+\s*/, "").trim())
      .filter((f) => f.length > 3 && f.length < 80)
      .filter((f) => !f.endsWith("?"))
      .filter((f) => !GARBAGE_PATTERNS.some((p) => p.test(f)))
      // The prompt says no identity details; this holds when it doesn't.
      .filter((f) => !isIdentityFact(f));
    if (!newFacts.length) return;
    // Rewriting the row also drops any legacy identity facts stored before
    // this filter existed, including old "name is X" display-name facts.
    const existing = parseFacts(userMemory.get(userId)).filter((f) => !isIdentityFact(f));
    const deduped = newFacts.filter((nf) => {
      const nfWords = nf.toLowerCase().split(" ").slice(0, 3).join(" ");
      return !existing.some((ef) => ef.toLowerCase().split(" ").slice(0, 3).join(" ") === nfWords);
    });
    if (!deduped.length) return;
    const merged = [...existing, ...deduped];
    await saveUserMemory(userId, merged.slice(-100));
  } catch (e) {
    // best-effort, a failed AI call just means we learned nothing this time
  }
}

export async function extractPersonality(userId: string, messages: string[]): Promise<void> {
  const combined = messages.join("\n");
  if (combined.length < 20) return;
  try {
    const res = await aiPost({
      messages: [
        {
          role: "system",
          content: `Analyze HOW this person communicates, not just what they say. Extract up to 5 stable personality traits. Focus on:
- Communication style (blunt, verbose, passive-aggressive, enthusiastic...)
- Humor type (sarcastic, dry, chaotic, self-deprecating...)
- Energy level (high energy, chill, erratic, intense...)
- Recurring behaviors (always uses "...", very short replies, overthinks, hypes people up...)
- How they react (defensive, chill, gets excited easily, always skeptical...)
Short phrases only, max 8 words each, one per line. Only note things that feel consistent and distinct. Output nothing if nothing stands out. No bullets, no numbers. Only HOW they talk, never who they are: no name, age, location, school, gender, sexuality, family, religion, health or contact details.`,
        },
        { role: "user", content: combined },
      ],
      max_tokens: 150,
    });
    const raw = res.data.choices?.[0]?.message?.content?.trim();
    if (!raw) return;
    const newTraits = raw
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 3 && t.length < 80)
      .filter((t) => !isIdentityFact(t));
    if (!newTraits.length) return;
    const parsed = safeFacts(parseFacts(personalityMemory.get(userId)));
    const deduped = newTraits.filter((nt) => {
      const ntWords = nt.toLowerCase().split(" ").slice(0, 3).join(" ");
      return !parsed.some((et) => et.toLowerCase().split(" ").slice(0, 3).join(" ") === ntWords);
    });
    if (!deduped.length) return;
    await savePersonality(userId, [...parsed, ...deduped].slice(-30));
  } catch (e) {
    // best-effort
  }
}
