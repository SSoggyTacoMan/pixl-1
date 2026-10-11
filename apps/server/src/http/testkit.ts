import type { RequestHandler } from "express";
import { authGate } from "./gate.js";

// For route tests: the real deny-by-default gate, with the revocation and
// ban lookups stubbed to "fine" so no database is needed.
export function testAuthGate(): RequestHandler {
  return authGate({
    revokedAt: async () => ({ ok: true, revokedAtMs: null }),
    banState: async () => "clear",
  });
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
