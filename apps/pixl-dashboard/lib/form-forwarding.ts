// Pure header building for the public /form actions (app/form/[formKey]/
// actions.ts), split out so it can be unit tested without next/headers.
//
// apps/server rate-limits the forms routes per IP. It only trusts a forwarded
// X-Forwarded-For when the request also carries this app's service key, so
// without both every visitor shares one bucket (this app's egress IP) and one
// person can lock everyone out.
//
// Deployment assumption: exactly one trusted proxy (the Orchard ingress) sits
// in front of this app and APPENDS the address it saw to X-Forwarded-For, so
// the rightmost entry is the only one a client can't forge.
//
// cf-connecting-ip is only trustworthy when Cloudflare is the sole way in:
// Cloudflare overwrites it, but if the origin is reachable directly (or the
// zone isn't proxied), any client can send its own value and pick its rate
// limit bucket. So it's opt-in: set TRUST_CF_CONNECTING_IP=1 only when every
// request provably passes through Cloudflare. Unset, it's ignored.
import { isIP } from "node:net";

/** TRUST_CF_CONNECTING_IP=1 (exactly) opts in to cf-connecting-ip. */
export function trustCfConnectingIp(env: string | undefined = process.env.TRUST_CF_CONNECTING_IP): boolean {
  return env?.trim() === "1";
}

/**
 * The visitor's IP as seen by this app. With trustCf (see above), Cloudflare's
 * cf-connecting-ip. Otherwise the LAST X-Forwarded-For entry, the one our own
 * ingress appended; the first entry is whatever the client sent and is never
 * trusted.
 */
export function visitorIp(h: Pick<Headers, "get">, opts: { trustCf?: boolean } = {}): string | null {
  const trustCf = opts.trustCf ?? trustCfConnectingIp();
  if (trustCf) {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf && isIP(cf)) return cf;
  }
  const fwd = h.get("x-forwarded-for");
  if (!fwd) return null;
  const last = fwd.split(",").pop()?.trim();
  return last && isIP(last) ? last : null;
}

/**
 * Headers for one forms call: the site Origin (apps/server's forms routes
 * require it), the service key, and the visitor IP as a single-value
 * X-Forwarded-For. Any X-Forwarded-For already on `base` is dropped.
 */
export function formForwardHeaders(
  base: HeadersInit | undefined,
  incoming: Pick<Headers, "get">,
  opts: { origin: string; serviceKey: string; trustCf?: boolean },
): Headers {
  const h = new Headers(base);
  h.set("origin", opts.origin);
  h.set("x-pixl-service-key", opts.serviceKey);
  h.delete("x-forwarded-for");
  const ip = visitorIp(incoming, { trustCf: opts.trustCf });
  if (ip) h.set("x-forwarded-for", ip);
  return h;
}
