// Static fallback Content-Security-Policy, set by next.config.ts headers() on
// every response. proxy.ts replaces it with the per-request nonce policy on
// every page it matches; this one covers whatever the proxy skips (static
// prefixes, API routes, prefetches) so nothing is ever served with no CSP.
// It has no nonce, so inline scripts can't run under it: a page that somehow
// renders without the proxy fails closed instead of running unprotected.
export const FALLBACK_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
