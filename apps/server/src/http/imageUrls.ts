// Where a player-supplied image URL may point. Every image a player sets
// (project thumbnail, cart screenshots, idea image, journal images, player
// card photo) is rendered on other players' pages, so an arbitrary host
// would let anyone log the IP of every teenager who views it, or swap the
// picture after review. Uploads go through /api/uploads to the Hack Club
// CDN, so only the CDN's hosts are accepted. The player card can also keep
// the Slack profile photo it was seeded with at sign-up (slackAvatar.ts),
// so Slack's avatar hosts are allowed for avatar_url only.

export const CDN_IMAGE_HOSTS: readonly string[] = Object.freeze([
  "cdn.hackclub.com",
  "hc-cdn.hel1.your-objectstorage.com",
  "assets.hackclub.com",
]);

// users.info image_512/image_192: avatars.slack-edge.com for uploaded
// photos, secure.gravatar.com (with an a.slack-edge.com / ca.slack-edge.com
// fallback) for the default ones.
export const SLACK_AVATAR_HOSTS: readonly string[] = Object.freeze([
  "avatars.slack-edge.com",
  "a.slack-edge.com",
  "ca.slack-edge.com",
  "secure.gravatar.com",
]);

export const MAX_IMAGE_URL_LENGTH = 500;

// The normalized URL if it is a plain https URL on an allowed host, else
// null. No credentials, no explicit port, nothing that could break out of an
// attribute (quotes, angle brackets, whitespace, backslashes).
export function allowedImageUrl(raw: unknown, opts: { avatar?: boolean } = {}): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > MAX_IMAGE_URL_LENGTH || /["'<>\s\\]/.test(s)) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const ok = CDN_IMAGE_HOSTS.includes(host) || (opts.avatar === true && SLACK_AVATAR_HOSTS.includes(host));
  if (!ok) return null;
  const href = u.href;
  return href.length <= MAX_IMAGE_URL_LENGTH ? href : null;
}

// Every markdown image (![alt](url "title")) in a journal entry. Broader
// than the Pixl Dashboard renderer's own pattern on purpose, so nothing it
// would render as an image can slip past the check.
const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)]*)\)/g;

export function markdownImageUrls(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(MD_IMAGE_RE)) {
    let target = m[1].trim();
    if (target.startsWith("<")) target = target.slice(1, target.indexOf(">") > 0 ? target.indexOf(">") : undefined);
    out.push(target.split(/\s+/)[0] ?? "");
  }
  return out;
}

export function markdownImagesAllowed(content: string): boolean {
  return markdownImageUrls(content).every((url) => allowedImageUrl(url) !== null);
}

// For content imported from another program (Macondo journals): a
// disallowed image becomes a plain link, which loads nothing until clicked,
// rather than failing the whole import.
export function demoteDisallowedMarkdownImages(content: string): string {
  return content.replace(MD_IMAGE_RE, (whole: string) => {
    const url = markdownImageUrls(whole)[0] ?? "";
    return allowedImageUrl(url) !== null ? whole : whole.slice(1);
  });
}
