// The only hosts this app loads remote images from: next/image's
// remotePatterns (next.config.ts) and the link-preview card renderer
// (lib/og/remote-image.ts) both read this list, so they can't drift apart.
export const CDN_HOSTS = ["cdn.hackclub.com", "hc-cdn.hel1.your-objectstorage.com", "assets.hackclub.com"] as const;

// Slack profile photo hosts. Allowed for a player's avatar_url only, never for
// other player-set images. Mirrors apps/server/src/http/imageUrls.ts's
// SLACK_AVATAR_HOSTS (the server seeds avatar_url from Slack at sign-up).
export const AVATAR_HOSTS = ["avatars.slack-edge.com", "a.slack-edge.com", "ca.slack-edge.com", "secure.gravatar.com"] as const;
