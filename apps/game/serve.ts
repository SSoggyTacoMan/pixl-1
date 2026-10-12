// Serves the Godot web export (and nothing else) at play.pixl.hackclub.com.
// Every player-facing page lives on the Pixl Dashboard (pixl.hackclub.com);
// this process has no page rewrites and no API handlers.
import { resolve, sep } from "node:path";

const ROOT = resolve(process.env.SITE_ROOT ?? "/srv/site");
const PORT = Number(process.env.PORT ?? 3000);

function baseHeaders(contentType: string): Headers {
  return new Headers({
    "Content-Type": contentType,
    // Cross-origin isolation for the Godot wasm (SharedArrayBuffer). There are
    // no other pages on this host any more, so it applies to everything.
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
    // The login return briefly carries ?code=&state= in the URL; never let it
    // leak out through a Referer header.
    "Referrer-Policy": "no-referrer",
  });
}

async function serveStatic(
  pathname: string,
  ifNoneMatch: string | null,
): Promise<Response | null> {
  let rel: string;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const candidates = rel.endsWith("/") ? [`${rel}index.html`] : [rel];

  for (const candidate of candidates) {
    const path = resolve(ROOT, `.${candidate}`);
    if (path !== ROOT && !path.startsWith(ROOT + sep)) continue;

    const file = Bun.file(path);
    if (await file.exists()) {
      // The Godot bundle keeps its file names across deploys, so without this
      // Cloudflare hands out the previous build for hours after a deploy.
      // no-cache still caches, it just revalidates, and the size+mtime ETag
      // turns that into a 304 rather than a re-download.
      const etag = `W/"${file.size.toString(16)}-${Math.floor(file.lastModified).toString(16)}"`;
      const headers = baseHeaders(file.type);
      headers.set("Cache-Control", "no-cache");
      headers.set("ETag", etag);
      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers });
      }
      return new Response(file, { headers });
    }
  }

  return null;
}

Bun.serve({
  port: PORT,
  idleTimeout: 60,
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: baseHeaders("text/plain"),
      });
    }

    const { pathname } = new URL(request.url);
    const file = await serveStatic(pathname, request.headers.get("if-none-match"));
    if (file) return file;

    return new Response("Not found", {
      status: 404,
      headers: baseHeaders("text/plain"),
    });
  },
});

console.log(`Serving ${ROOT} on :${PORT}`);
