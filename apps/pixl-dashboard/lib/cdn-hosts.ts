// The only hosts this app loads remote images from: next/image's
// remotePatterns (next.config.ts) and the link-preview card renderer
// (lib/og/remote-image.ts) both read this list, so they can't drift apart.
export const CDN_HOSTS = ["cdn.hackclub.com", "hc-cdn.hel1.your-objectstorage.com", "assets.hackclub.com"] as const;
