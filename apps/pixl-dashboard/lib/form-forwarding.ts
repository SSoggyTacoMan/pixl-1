// Pure header building for the public /form actions (app/form/[formKey]/
// actions.ts), split out so it can be unit tested without next/headers.
//
// apps/server rate-limits the forms routes per IP. It only trusts a forwarded
// X-Forwarded-For when the request also carries this app's service key, so
// without both every visitor shares one bucket (this app's egress IP) and one
// person can lock everyone out.
import { isIP } from "node:net";

/**
 * The visitor's IP as seen by this app. Cloudflare overwrites
 * cf-connecting-ip on every request, so a client can't spoof it. Failing
 * that, the LAST X-Forwarded-For entry is the one our own ingress appended;
 * the first entry is whatever the client sent and is never trusted.
 */
export function visitorIp(h: Pick<Headers, "get">): string | null {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf && isIP(cf)) return cf;
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
  opts: { origin: string; serviceKey: string },
): Headers {
  const h = new Headers(base);
  h.set("origin", opts.origin);
  h.set("x-pixl-service-key", opts.serviceKey);
  h.delete("x-forwarded-for");
  const ip = visitorIp(incoming);
  if (ip) h.set("x-forwarded-for", ip);
  return h;
}
