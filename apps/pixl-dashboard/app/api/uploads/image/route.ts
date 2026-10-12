import type { NextRequest } from "next/server";
import { getAuth } from "@/lib/session";
import { handleImageUpload } from "@/lib/upload-route";

// Project/idea/journal image uploads. A route handler rather than a Server
// Action so only this endpoint accepts a 15MB body (see lib/upload-route.ts);
// every Server Action stays under next.config.ts's 1MB limit.
export async function POST(req: NextRequest) {
  return handleImageUpload(req, { getAuth, log: (line) => console.log(JSON.stringify(line)) });
}
