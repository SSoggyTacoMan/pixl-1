import { NextRequest, NextResponse } from "next/server";

// Two jobs:
// 1. stats.pixl.rsvp serves the public stats page at its root.
// 2. Stamp the request path onto x-pixl-pathname so page guards can record
//    which page was viewed in the audit log (Server Components have no other
//    way to see the pathname). Always overwritten, so a client can't spoof it.
export function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const headers = new Headers(req.headers);
  headers.set("x-pixl-pathname", req.nextUrl.pathname.slice(0, 300));
  if (host.startsWith("stats.") && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/stats";
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
};
