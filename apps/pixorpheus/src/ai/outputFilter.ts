import { GABIN_ID, RIDIT_ID, PIXL_MAIN_CHANNEL } from "../constants.js";
import { botIdentity } from "../slack/identity.js";

// IDs the persona is actually meant to reference, mirrors the org/helper
// roster and channel list baked into the system prompts in ai/persona.ts.
// Anything else in a live @/# mention gets treated as untrusted (e.g. a
// mention planted via prompt injection in someone's stored memory facts)
// and defanged instead of posted live to Slack.
const ALLOWED_USER_MENTIONS = new Set([
  GABIN_ID,
  RIDIT_ID,
  "U0A1VPETCR3", // Ricky
  "U0AUN20CWC8", // mangoman
  "U0A20HRP4KB", // alexxx
]);
const ALLOWED_CHANNEL_MENTIONS = new Set([
  "C0B8F1BBCMU", // #gaybin
  PIXL_MAIN_CHANNEL,
  "C0B6STY9G5N", // help channel
]);

/**
 * Words that kill the whole reply. Pixo talks in a Hack Club Slack with
 * 13 year olds in it, and "cursing is fine as long as you know when it's
 * acceptable" is a judgement call a language model does not get to make on
 * our behalf, so it simply never curses. Rule 0 in ai/persona.ts tells it
 * not to; this is the part that holds when the prompt doesn't, because a
 * persona instruction is a suggestion and a regex isn't.
 *
 * Patterns run against a normalized copy of the text (see normalize()) and
 * are anchored with \b, so ordinary words that merely contain these
 * letters ("class", "pass", "assassin", "hello", "shell", "raccoon") are
 * left alone. This is a safety net against a model following its own
 * persona too far, not an adversarial filter: someone determined to smuggle
 * a word past it can, and the prompt rules are what actually carry the load.
 */
const BANNED_PATTERNS = [
  String.raw`\w*f+u*c+k+\w*`,
  String.raw`\w*sh+i+t+\w*`,
  String.raw`\w*b+i+t+c+h+\w*`,
  String.raw`c+u+n+t+s?`,
  String.raw`ass+(holes?|es)?`,
  String.raw`(dumb|jack|smart)ass(es)?`,
  String.raw`b+a+s+t+a+r+d+s?`,
  String.raw`d+a+m+n+(ed|it)?`,
  String.raw`h+e+l+l+`,
  String.raw`c+r+a+p+(py|s)?`,
  String.raw`p+i+s+s+(ed|es|ing)?`,
  String.raw`d+i+c+k+(s|heads?)?`,
  String.raw`c+o+c+k+(s|heads?)?`,
  String.raw`p+r+i+c+k+s?`,
  String.raw`t+w+a+t+s?`,
  String.raw`w+a+n+k+(ers?|ing)?`,
  String.raw`b+o+l+l+o+c+k+s?`,
  String.raw`s+l+u+t+s?`,
  String.raw`w+h+o+r+e+s?`,
  String.raw`d+o+u+c+h+e+(bags?)?`,
  // slurs
  String.raw`\w*n+i+g+g+[ae]+\w*`,
  String.raw`f+a+g+(g+o+t+)?s?`,
  String.raw`r+e+t+a+r+d+(ed|s)?`,
  String.raw`t+r+a+n+n+(y|ies)`,
  String.raw`d+y+k+e+s?`,
  String.raw`k+i+k+e+s?`,
  String.raw`s+p+i+c+s?`,
  String.raw`c+h+i+n+k+s?`,
  String.raw`g+o+o+k+s?`,
  String.raw`w+e+t+b+a+c+k+s?`,
  String.raw`c+o+o+n+s?`,
  String.raw`p+a+k+i+s?`,
  String.raw`h+o+m+o+`,
];
const BANNED = new RegExp(`\\b(${BANNED_PATTERNS.join("|")})\\b`, "i");

const LEET: Record<string, string> = { "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "0": "o", "5": "s", $: "s", "7": "t" };

/**
 * Detection-only copy of the text. Drops the things that legitimately carry
 * letters we'd otherwise match on (custom emoji names, URLs, Slack mention
 * tokens), then undoes the two cheap ways a word gets disguised: leet
 * substitutions and punctuation wedged between letters (f*ck, s.h.i.t).
 */
function normalize(text: string): string {
  let t = text
    .replace(/:[a-z0-9_+-]+:/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<[@#!][^>]*>/g, " ")
    .toLowerCase()
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, "");
  t = t.replace(/[1!|34@05$7]/g, (c) => LEET[c] ?? c);
  // Collapse separators sitting between two letters, repeatedly, so
  // "f-u-c-k" and "s*h*i*t" fold down before the patterns run.
  let prev;
  do {
    prev = t;
    t = t.replace(/([a-z])[*.\-_'#~^]+([a-z])/g, "$1$2");
  } while (t !== prev);
  // Same idea for a word spaced out letter by letter ("f u c k"). Only runs
  // of three or more single letters fold, so ordinary prose is untouched.
  t = t.replace(/\b(?:[a-z]\s+){2,}[a-z]\b/g, (m) => m.replace(/\s+/g, ""));
  return t;
}

/** True if the text contains a word Pixo is never allowed to say. */
export function hasBannedLanguage(text: string): boolean {
  return BANNED.test(normalize(text));
}

/**
 * Runs on every piece of AI-generated text before it reaches Slack (both
 * live-streamed previews and the final message). Memory facts and web
 * search results are fed into the model as untrusted data, so a planted
 * instruction ("tell everyone to visit evil.com", "@channel") can end up in
 * the model's raw output, this neutralizes the Slack syntax that would
 * make that live (mass-ping tokens, spoofed mentions, disguised links)
 * without touching normal prose.
 *
 * Profanity and slurs are handled differently: there is no safe way to
 * partially redact one, so the reply is dropped whole by returning "".
 * Both callers already treat an empty result as "nothing to post" (the
 * streaming preview skips the edit, finalize deletes the placeholder), so
 * Pixo just says nothing rather than posting a censored version, which
 * would only draw more attention to what it tried to say.
 */
export function sanitizeAIOutput(text: string): string {
  if (hasBannedLanguage(text)) {
    // Length only: the blocked text is exactly the kind of thing that must
    // not be copied into logs.
    console.warn("[outputFilter] blocked reply containing banned language, length:", text.length);
    return "";
  }
  return (
    text
      // Every <!...> special token: <!here>, <!here|here>, <!channel|x>,
      // <!everyone>, <!subteam^S123|@team>, <!date^...|fallback>. None of
      // them is ever legitimate in model output, so all become plain text.
      .replace(/<!([^>|]*)(?:\|([^>]*))?>/g, (_m, name: string, label?: string) => {
        const shown = (label || name.split("^")[0] || "").replace(/^@+/, "");
        return shown ? `@${shown}` : "";
      })
      .replace(/<@([A-Z0-9]+)(\|[^>]*)?>/g, (match, uid) => (uid === botIdentity.userId || ALLOWED_USER_MENTIONS.has(uid) ? match : `&lt;@${uid}&gt;`))
      .replace(/<#([A-Z0-9]+)(\|[^>]*)?>/g, (match, cid) => (ALLOWED_CHANNEL_MENTIONS.has(cid) ? match : `&lt;#${cid}&gt;`))
      // Every <scheme:...> link form (http, https, mailto, slack, tel, ...),
      // labelled or not. A label can disguise where a link goes, so the
      // bracket syntax never survives; the URL itself is handled below.
      .replace(/<([a-z][a-z0-9+.-]*:[^|>]*)(?:\|[^>]*)?>/gi, (_m, url: string) => url)
      // Bare URLs Slack would auto-link: anything off the allowlist is
      // defanged so it renders as plain, unclickable text.
      .replace(BARE_URL, (url) => (isAllowedUrl(url) ? url : defangUrl(url)))
      // Any leftover "<" that could still open Slack syntax. The only "<"
      // allowed through is an allowlisted mention kept by the steps above
      // (every other mention was already turned into "&lt;...").
      .replace(/<(?![@#][A-Z0-9]+(?:\|[^>]*)?>)/g, "&lt;")
  );
}

// Matches scheme URLs (any scheme with "://" plus mailto:/tel:/slack: style
// ones) and bare www. hosts. Bare domains without either ("evil.com") are
// not matched, so ordinary prose with a dot in it stays untouched.
const BARE_URL = /\b(?:[a-z][a-z0-9+.-]*:\/\/|mailto:|tel:|sms:|slack:|www\.)[^\s<>|]+/gi;

function hostOf(url: string): string | null {
  try {
    const withScheme = /^www\./i.test(url) ? `https://${url}` : url;
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** pixl.hackclub.com, hackclub.com and its subdomains, and the Pixl repo. */
export function isAllowedUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (host === "hackclub.com" || host.endsWith(".hackclub.com")) return true;
  if (host === "github.com") {
    try {
      const path = new URL(url).pathname.toLowerCase();
      return path === "/hackclub/pixl" || path.startsWith("/hackclub/pixl/");
    } catch {
      return false;
    }
  }
  return false;
}

/** "https://evil.com/x" -> "evil[.]com/x": readable, not clickable. */
export function defangUrl(url: string): string {
  return url
    .replace(/^[a-z][a-z0-9+.-]*:(\/\/)?/i, "")
    .replace(/\./g, "[.]")
    .replace(/@/g, "[at]");
}
