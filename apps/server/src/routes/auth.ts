import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { supabase, type UserRow } from "../db/client.js";
import type { PgError } from "../db/pgCompat.js";
import { issueSessionToken, type SessionClient } from "../auth/session.js";
import { forgetCachedRevocation, revokeUserSessions } from "../auth/revocation.js";
import {
  checkLoginRedirect,
  checkRedirect,
  CLIENT_STATE_RE,
  createLoginCodeStore,
  loginClientForRedirect,
  type LoginGrant,
} from "../auth/loginCodes.js";
import { lookupActiveBan } from "../moderation.js";
import { fetchSlackAvatar, fetchSlackDisplayName } from "../slackAvatar.js";
import { enrollSlackPlayerInPixl } from "../pixlSlack.js";
import { config } from "../config.generated.js";
import { encryptPII } from "../crypto.js";
import {
  hcaStateChanged,
  hcaStatePatch,
  hcaSyncOutcome,
  isSignupRejected,
  type HcaStateRow,
} from "../hcaEligibility.js";
import { nameProblem } from "./profile.js";
import { audit, auditRequest, auditRequestThrottled, requestActor } from "../audit.js";
import { requireSession } from "../http/requireSession.js";
import { validate, v } from "../http/validate.js";
import { matchServiceKey, serviceKeyHeader } from "../http/serviceKeys.js";
import { endUserSession } from "../ws/gameServer.js";

const router = Router();

// See drizzle/0177_users_oauth_unique.sql. A 23505 alone isn't enough to
// identify this race - `users` can grow other unique constraints later (it
// already has one, on referral_code), so pin the check to the specific
// constraint the signup race actually trips over.
const USERS_OAUTH_UNIQUE_CONSTRAINT = "users_oauth_provider_oauth_id_key";

function isOauthIdentityRace(error: PgError | null | undefined): boolean {
  return error?.code === "23505" && error?.constraintName === USERS_OAUTH_UNIQUE_CONSTRAINT;
}

async function saveSlackAvatar(userId: string, slackId: string): Promise<void> {
  const url = await fetchSlackAvatar(slackId);
  if (!url) return;
  const { error } = await supabase.from("users").update({ avatar_url: url }).eq("id", userId);
  if (error) console.error("Failed to save slack avatar", error.message);
}

const HCA_BASE_URL = "https://auth.hackclub.com";
const CLIENT_ID = process.env.HCA_CLIENT_ID!;
const CLIENT_SECRET = process.env.HCA_CLIENT_SECRET!;
const REDIRECT_URI = process.env.HCA_REDIRECT_URI!;
// Every login used to request phone+address up front, even though nothing
// but a shop order ever needs them , everyone got HCA's address/phone
// consent screen just to sign in and play. General login now only asks for
// birthdate (needed broadly for YSWS age eligibility, not shop-specific);
// phone/address are requested separately, only when a player actually starts
// a purchase (see the verify-address flow below, which already existed for
// re-verifying a stale address and now also covers a player's first order).
const HCA_LOGIN_SCOPES = "openid profile slack_id birthdate basic_info";
const HCA_ADDRESS_SCOPES =
  "openid profile slack_id phone birthdate address basic_info";
// A player's first_name/last_name (HCA_LOGIN_SCOPES' "basic_info"/"profile")
// is self-editable, exactly like a Slack display name - HCA separately tracks
// a legal_first_name/legal_last_name, only ever set through HCA's own
// identity-verification flow, under its own "legal_name" scope. Deliberately
// its own tiny one-off request, not folded into HCA_LOGIN_SCOPES, so this is
// only ever asked for when explicitly needed (see the legal-name flow below),
// not on every normal login.
const HCA_LEGAL_NAME_SCOPES = "openid legal_name";

// Maps our OAuth `state` (sent to HCA) -> the pending round trip. Abandoned
// logins are never claimed, so they're swept on a timer.
//
// purpose distinguishes a normal login (creates/signs in a user, mints a
// login code) from the re-auth flows started by an already signed-in player
// through POST /auth/flow/:name (no new session; userId is set for those).
// redirect is always an allowlisted URL (checkRedirect), clientState is the
// client's own opaque `state`, echoed back on a login redirect.
type FlowPurpose = "verify_address" | "resync_hca" | "verify_legal_name";
interface PendingLogin {
  expiresAt: number;
  redirect: string;
  clientState?: string;
  purpose?: FlowPurpose;
  userId?: string;
}
const PENDING_LOGIN_TTL_MS = 10 * 60_000;
const MAX_PENDING_LOGINS = 20_000;
const pendingLogins = new Map<string, PendingLogin>();

setInterval(() => {
  const now = Date.now();
  for (const [state, pending] of pendingLogins) {
    if (pending.expiresAt <= now) pendingLogins.delete(state);
  }
}, 60_000).unref();

function startPending(pending: Omit<PendingLogin, "expiresAt">): string {
  while (pendingLogins.size >= MAX_PENDING_LOGINS) {
    const oldest = pendingLogins.keys().next().value;
    if (oldest === undefined) break;
    pendingLogins.delete(oldest);
  }
  const state = crypto.randomBytes(16).toString("hex");
  pendingLogins.set(state, { ...pending, expiresAt: Date.now() + PENDING_LOGIN_TTL_MS });
  return state;
}

function hcaAuthorizeUrl(scope: string, state: string): string {
  const url = new URL(`${HCA_BASE_URL}/oauth/authorize`);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  // Must stay a subset of the scopes the HCA app is registered for, HCA
  // rejects the whole authorize request otherwise.
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return url.toString();
}

export const loginCodes = createLoginCodeStore();

interface HackClubTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface HcaAddress {
  id?: string;
  first_name?: string;
  last_name?: string;
  line_1?: string;
  line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone_number?: string;
  primary?: boolean;
}

interface HackClubMeResponse {
  identity: {
    id: string;
    first_name?: string;
    last_name?: string;
    // Only present when the "legal_name" scope was granted (see
    // HCA_LEGAL_NAME_SCOPES/verify_legal_name below) - never requested on a
    // normal login.
    legal_first_name?: string;
    legal_last_name?: string;
    primary_email?: string;
    slack_id?: string;
    // Confirmed against hackclub/auth's own jbuilder templates
    // (app/views/api/v1/identities/_identity.jb, _address.jb) , NOT the OIDC
    // standard claim names the "birthdate"/"address" scopes might suggest.
    // The "birthdate" scope's field is `birthday`, and "address" grants an
    // `addresses` ARRAY (one entry per address on file), not a single object.
    birthday?: string;
    addresses?: HcaAddress[];
    verification_status?: string;
    ysws_eligible?: boolean;
    [key: string]: unknown;
  };
  scopes: string[];
}

function extractBirthday(identity: HackClubMeResponse["identity"]): string | null {
  const raw = identity.birthday;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date > new Date() || date.getFullYear() < 1900) {
    console.warn("HCA birthday didn't parse as a date");
    return null;
  }
  return raw.slice(0, 10);
}

interface HcaAddressPatch {
  address_line1: string;
  address_line2: string;
  address_city: string;
  address_state: string;
  address_country: string;
  address_postal: string;
}

function extractAddress(identity: HackClubMeResponse["identity"]): HcaAddressPatch | null {
  const addresses = identity.addresses;
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  const addr = addresses.find((a) => a.primary) ?? addresses[0];
  const line1 = String(addr.line_1 ?? "").trim();
  const city = String(addr.city ?? "").trim();
  const country = String(addr.country ?? "").trim();
  const postal = String(addr.postal_code ?? "").trim();
  if (!line1 || !city || !country || !postal) {
    console.warn("HCA address missing expected fields, raw keys:", Object.keys(addr));
    return null;
  }
  return {
    address_line1: line1,
    address_line2: String(addr.line_2 ?? "").trim(),
    address_city: city,
    address_state: String(addr.state ?? "").trim(),
    address_country: country,
    address_postal: postal,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function loginErrorPage(heading: string, detail: string, retry: string, linkText = "Try logging in again"): string {
  return `<html><body style="font-family:sans-serif;text-align:center;margin-top:4rem;"><h2>${heading}</h2><p>${detail}</p><p><a href="${escapeHtml(retry)}">${linkText}</a></p></body></html>`;
}

// A retry starts the same login over: same allowlisted redirect, same client
// state (still bound to the same browser's cookie / nonce).
function retryLoginUrl(pending: PendingLogin): string {
  if (!pending.clientState) return pending.redirect;
  const params = new URLSearchParams({ redirect: pending.redirect, state: pending.clientState });
  return `/auth/hackclub?${params}`;
}

async function persistHcaState(userId: string, patch: HcaStateRow): Promise<boolean> {
  const { error } = await supabase.from("users").update(patch).eq("id", userId);
  if (error) {
    console.error("Failed to persist HCA state", userId, error.message);
    return false;
  }
  console.log("[auth] stored HCA state", userId, patch.hca_verification_status, patch.hca_ysws_eligible);
  return true;
}

function unsavedStatePage(retry: string, linkText?: string): string {
  return loginErrorPage(
    "Couldn't save your Hack Club Auth status",
    "Nothing was lost. Give it a moment and try again.",
    retry,
    linkText,
  );
}

function loginFailed(req: Request, reason: string, extra: { actorId?: string; slackId?: string | null } = {}): void {
  auditRequestThrottled(req, {
    action: "auth.login_failed",
    target: "hackclub",
    result: "denied",
    ...(extra.actorId ? { actorType: "player" as const, actorId: extra.actorId } : {}),
    ...(extra.slackId ? { slackId: extra.slackId } : {}),
    meta: { reason },
  });
}

// Step 1 of the code-exchange login. `redirect` must be exactly one of
// LOGIN_REDIRECTS (the Pixl Dashboard's callback or the game's root); `state` is echoed back
// untouched on the final redirect.
router.get(
  "/auth/hackclub",
  validate({
    query: z.object({ redirect: z.string().max(2000), state: z.string().regex(CLIENT_STATE_RE) }),
  }),
  (req, res) => {
    const redirect = checkLoginRedirect(req.query.redirect);
    if (!redirect) {
      loginFailed(req, "bad_redirect");
      return res.status(400).json({ ok: false, error: "invalid_redirect" });
    }
    const state = startPending({ redirect, clientState: String(req.query.state) });
    res.redirect(hcaAuthorizeUrl(HCA_LOGIN_SCOPES, state));
  },
);

// Step 3: trade a login code for a session token. Allowed from the Pixl
// Dashboard's backend (x-pixl-service-key = SERVICE_KEY_PIXL_DASHBOARD) or
// from the game's own origin with no key. Anything else is refused.
// The caller is checked before the body is validated, so an unauthorized
// caller always gets 401 and never learns anything about the expected shape.
router.post(
  "/auth/exchange",
  (req, res, next) => {
    const given = serviceKeyHeader(req);
    if (given) {
      const service = matchServiceKey(given);
      if (service !== "pixl-dashboard") {
        auditRequestThrottled(req, {
          action: "auth.service_key_rejected",
          ...(service ? { actorType: "service" as const, actorId: service } : {}),
          target: "POST /auth/exchange",
          result: "denied",
          meta: { reason: service ? "not_permitted" : "unknown_key" },
        });
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
      req.service = service;
    } else if (req.headers.origin !== config.urls.play) {
      auditRequestThrottled(req, {
        action: "auth.exchange",
        target: "POST /auth/exchange",
        result: "denied",
        meta: { reason: "caller_not_allowed" },
      });
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    next();
  },
  validate({ query: v.noQuery, body: z.object({ code: z.string().min(16).max(128) }) }),
  (req, res) => {
    // The token's client kind comes from the grant, which was bound to the
    // login redirect when the code was minted, never from the body. The
    // caller must be that same kind: the Pixl Dashboard's service key for a
    // "web" grant, the game's origin for a "game" one. A mismatch spends the
    // code (redeem already deleted it) and is refused.
    const caller: SessionClient = req.service === "pixl-dashboard" ? "web" : "game";
    const grant = loginCodes.redeem(String(req.body.code));
    if (!grant) {
      auditRequestThrottled(req, {
        action: "auth.exchange",
        target: "POST /auth/exchange",
        result: "denied",
        meta: { reason: "invalid_code", via: req.service ?? "game", client: caller },
      });
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }
    if (grant.client !== caller) {
      auditRequestThrottled(req, {
        actorType: "player",
        actorId: grant.userId,
        action: "auth.exchange",
        target: "POST /auth/exchange",
        result: "denied",
        meta: { reason: "client_mismatch", via: req.service ?? "game", client: caller, grantClient: grant.client },
      });
      return res.status(400).json({ ok: false, error: "invalid_code" });
    }
    const client: SessionClient = grant.client;

    const token = issueSessionToken({
      userId: grant.userId,
      displayName: grant.displayName,
      client,
      ...(grant.slackId ? { slackId: grant.slackId } : {}),
    });
    const actor = requestActor(req);
    audit({
      ...actor,
      actorType: "player",
      actorId: grant.userId,
      slackId: grant.slackId,
      action: "auth.exchange",
      target: `user:${grant.userId}`,
      result: "ok",
      meta: { via: req.service ?? "game", client, isNew: grant.isNew },
    });
    res.json({
      ok: true,
      token,
      user: { id: grant.userId, displayName: grant.displayName, slackId: grant.slackId },
      isNew: grant.isNew,
      needsLegalName: grant.needsLegalName,
    });
  },
);

// Revokes the caller's sessions for the caller's own client only (see
// auth/revocation.ts): logging out of the Pixl Dashboard leaves the game
// signed in and vice versa. Only a game logout closes the game socket.
router.post(
  "/auth/logout",
  requireSession(),
  validate({ query: v.noQuery, body: v.empty }),
  async (req, res) => {
    const session = req.session!;
    const client = session.client;
    const revokedAtMs = Date.now();
    const result = await revokeUserSessions(session.userId, revokedAtMs, client);
    if (result !== "revoked") {
      auditRequest(req, {
        action: "auth.logout",
        target: `user:${session.userId}`,
        result: "error",
        meta: { reason: result, client },
      });
      return res.status(result === "not_found" ? 404 : 503).json({ ok: false, error: "logout_failed" });
    }
    forgetCachedRevocation(session.userId);
    if (client === "game") endUserSession(session.userId, revokedAtMs);
    auditRequest(req, { action: "auth.logout", target: `user:${session.userId}`, result: "ok", meta: { client } });
    res.json({ ok: true });
  },
);

// Re-auth round trips for an already signed-in player. The client POSTs with
// its Bearer token and gets back the URL to send the browser to; the round
// trip ends on its (allowlisted) `redirect`. No session token is ever put in
// a URL.
//  - verify-address: pull a fresh phone+address from HCA (shop checkout,
//    also the first time a player starts an order at all, since general
//    login no longer asks HCA for it). Returns with ?addr_verified=1|0.
//  - resync: re-check HCA verification/eligibility for this account without
//    a re-login. Returns with ?hca_synced=<outcome>.
//  - legal-name: pull the HCA-verified legal name, for the rare case a
//    player's self-editable first_name/last_name obviously isn't their real
//    name. Returns with ?legal_name=saved|missing.
const FLOWS: Record<string, { purpose: FlowPurpose; scope: string }> = {
  "verify-address": { purpose: "verify_address", scope: HCA_ADDRESS_SCOPES },
  resync: { purpose: "resync_hca", scope: HCA_LOGIN_SCOPES },
  "legal-name": { purpose: "verify_legal_name", scope: HCA_LEGAL_NAME_SCOPES },
};

router.post(
  "/auth/flow/:name",
  requireSession(),
  validate({
    params: z.object({ name: z.enum(["verify-address", "resync", "legal-name"]) }),
    query: v.noQuery,
    body: z.object({ redirect: z.string().max(2000) }),
  }),
  (req, res) => {
    const session = req.session!;
    const flow = FLOWS[String(req.params.name)];
    const redirect = checkRedirect(req.body.redirect);
    if (!redirect) return res.status(400).json({ ok: false, error: "invalid_redirect" });
    const state = startPending({ redirect, purpose: flow.purpose, userId: session.userId });
    auditRequest(req, { action: `auth.flow.${String(req.params.name)}`, target: `user:${session.userId}`, result: "ok" });
    res.json({ ok: true, url: hcaAuthorizeUrl(flow.scope, state) });
  },
);

function withParam(base: string, key: string, value: string): string {
  const dest = new URL(base);
  dest.searchParams.set(key, value);
  return dest.toString();
}

function needsLegalNameFor(row: { legal_first_name?: unknown; legal_last_name?: unknown }, fullName: string): boolean {
  const hasLegal = Boolean(row.legal_first_name) || Boolean(row.legal_last_name);
  return !hasLegal && fullName.trim() === "";
}

router.get(
  "/auth/hackclub/callback",
  validate({ query: z.object({ code: z.string().max(2000).optional(), state: z.string().max(200).optional() }) }),
  async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    const pending = state ? pendingLogins.get(state) : undefined;
    if (state) pendingLogins.delete(state);
    if (!code || !pending) {
      loginFailed(req, "invalid_state");
      return res.status(400).send("Invalid OAuth state");
    }
    if (pending.expiresAt <= Date.now()) {
      loginFailed(req, "expired_state");
      return res.status(400).send("Login took too long, please try again");
    }

    const tokenRes = await fetch(`${HCA_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("HCA token exchange failed", tokenRes.status, body.slice(0, 500));
      // HCA throttles the token endpoint ("slow your roll!") if you log in and
      // out a few times in a row. The code is spent either way, so the only way
      // through is a fresh login once their window clears.
      const throttled = tokenRes.status === 429 || body.includes("slow your roll");
      loginFailed(req, throttled ? "hca_throttled" : "hca_token_failed");
      const retry = retryLoginUrl(pending);
      return res
        .status(throttled ? 429 : 502)
        .send(
          loginErrorPage(
            throttled ? "Hack Club Auth is rate limiting us" : "Login failed",
            throttled
              ? "Too many logins in a row. Give it a minute, then try again."
              : "Hack Club Auth wouldn't hand over your session.",
            retry,
          ),
        );
    }

    const tokens = (await tokenRes.json()) as HackClubTokenResponse;

    const meRes = await fetch(`${HCA_BASE_URL}/api/v1/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!meRes.ok) {
      console.error("HCA /me fetch failed", meRes.status);
      loginFailed(req, "hca_me_failed");
      return res.status(502).send("Failed to fetch user identity");
    }

    const me = (await meRes.json()) as HackClubMeResponse;
    const identity = me.identity;

    if (pending.purpose === "resync_hca") {
      const back = pending.redirect;
      const unsaved = () =>
        res.status(503).set("Retry-After", "5").send(unsavedStatePage(back, "Back to Pixl"));
      if (!pending.userId) return res.status(400).send("Invalid OAuth state");
      const { data: row, error: rowError } = await supabase
        .from("users")
        .select("id, oauth_provider, oauth_id, hca_verification_status, hca_ysws_eligible")
        .eq("id", pending.userId)
        .maybeSingle();
      if (rowError || !row) {
        console.error("HCA resync user lookup failed", rowError?.message);
        return unsaved();
      }
      // bound identity
      if (row.oauth_provider !== "hackclub" || row.oauth_id !== identity.id) {
        audit({ ...requestActor(req), actorType: "player", actorId: pending.userId, action: "auth.flow.resync", target: `user:${pending.userId}`, result: "denied", meta: { reason: "identity_mismatch" } });
        return res
          .status(403)
          .send(
            loginErrorPage(
              "That's a different Hack Club account",
              "Sign in to Hack Club Auth with the same account you used to join Pixl, then re-check.",
              back,
              "Back to Pixl",
            ),
          );
      }
      const fresh = hcaStatePatch(identity);
      if (fresh.hca_verification_status === undefined) {
        console.warn("[auth] HCA identity has no verification_status", row.id);
      } else if (hcaStateChanged(row as HcaStateRow, fresh) && !(await persistHcaState(row.id as string, fresh))) {
        return unsaved();
      }
      return res.redirect(
        withParam(back, "hca_synced", hcaSyncOutcome(fresh.hca_verification_status === undefined ? (row as HcaStateRow) : fresh)),
      );
    }

    if (pending.purpose === "verify_legal_name") {
      if (!pending.userId) return res.status(400).send("Invalid OAuth state");
      const { data: row, error: rowError } = await supabase
        .from("users")
        .select("id, oauth_provider, oauth_id")
        .eq("id", pending.userId)
        .maybeSingle();
      if (rowError || !row) {
        console.error("HCA legal-name user lookup failed", rowError?.message);
        return res.status(502).send("Something went wrong, try that link again");
      }
      // Same identity-binding check as resync_hca above , this writes a name
      // onto an account, so it must be the same HCA identity that account is
      // actually tied to, not whichever HCA account happened to be signed into
      // the browser that clicked the link.
      if (row.oauth_provider !== "hackclub" || row.oauth_id !== identity.id) {
        audit({ ...requestActor(req), actorType: "player", actorId: pending.userId, action: "auth.flow.legal-name", target: `user:${pending.userId}`, result: "denied", meta: { reason: "identity_mismatch" } });
        return res
          .status(403)
          .send(
            loginErrorPage(
              "That's a different Hack Club account",
              "Sign in to Hack Club Auth with the same account you used to join Pixl, then try that link again.",
              pending.redirect,
              "Back to Pixl",
            ),
          );
      }
      let saved = false;
      if (identity.legal_first_name || identity.legal_last_name) {
        const { error: legalErr } = await supabase
          .from("users")
          .update({
            legal_first_name: identity.legal_first_name ?? null,
            legal_last_name: identity.legal_last_name ?? null,
          })
          .eq("id", pending.userId);
        if (legalErr) console.error("Failed to save legal name from HCA", legalErr.message);
        else saved = true;
      }
      return res.redirect(withParam(pending.redirect, "legal_name", saved ? "saved" : "missing"));
    }

    if (pending.purpose === "verify_address") {
      if (!pending.userId) return res.status(400).send("Invalid OAuth state");
      const { data: row, error: rowError } = await supabase
        .from("users")
        .select("id, oauth_provider, oauth_id")
        .eq("id", pending.userId)
        .maybeSingle();
      if (rowError || !row) {
        console.error("HCA verify-address user lookup failed", rowError?.message);
        return res.status(502).send("Something went wrong, try that link again");
      }
      // Same identity binding as resync_hca / verify_legal_name: the address
      // HCA returns belongs to whoever consented, so it may only land on the
      // account tied to that exact HCA identity. Without this, A could start
      // the flow, send the authorize link to B, and B's address would be
      // written onto A's row.
      if (row.oauth_provider !== "hackclub" || row.oauth_id !== identity.id) {
        audit({ ...requestActor(req), actorType: "player", actorId: pending.userId, action: "auth.flow.identity_mismatch", target: `user:${pending.userId}`, result: "denied", meta: { flow: "verify-address" } });
        return res
          .status(403)
          .send(
            loginErrorPage(
              "That's a different Hack Club account",
              "Sign in to Hack Club Auth with the same account you used to join Pixl, then try that link again.",
              pending.redirect,
              "Back to Pixl",
            ),
          );
      }
      const addr = extractAddress(identity);
      if (addr) {
        const { error: addrErr } = await supabase
          .from("users")
          .update({
            address_line1: encryptPII(addr.address_line1),
            address_line2: encryptPII(addr.address_line2),
            address_city: encryptPII(addr.address_city),
            address_state: encryptPII(addr.address_state),
            address_country: encryptPII(addr.address_country),
            address_postal: encryptPII(addr.address_postal),
          })
          .eq("id", pending.userId);
        if (addrErr) console.error("Failed to refresh address from HCA", addrErr.message);
      }
      return res.redirect(withParam(pending.redirect, "addr_verified", addr ? "1" : "0"));
    }

    // Which HCA scope actually carries name/email isn't documented, so say so
    // loudly if a login comes back without them rather than silently falling
    // through to a user_xxxxxxxx placeholder.
    if (!identity.first_name && !identity.primary_email) {
      console.warn(
        "HCA identity missing name and email, granted scopes:",
        me.scopes,
        "fields:",
        Object.keys(identity),
      );
    }
    // The verified real name, straight from HCA and nothing else - this is
    // what real_name/first_name/last_name get set to below, since those feed
    // the review pipeline, the dashboard's "who is this" and the Airtable
    // submission. Never fall back to a player's own Slack display name here:
    // that's self-editable (exactly the "fake/game name" a player could set),
    // so it's only ever used for the cosmetic in-game display_name below, never
    // for the name anything treats as verified.
    const fullName = [identity.first_name, identity.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    // HCA doesn't always have a name on file (younger/incomplete accounts) ,
    // fall back to Slack's own directory before resorting to a generated
    // placeholder, since every player is a real Slack workspace member. This
    // only ever seeds the in-game display name, never real_name.
    let displayNameSource = fullName;
    if (!displayNameSource && identity.slack_id) {
      const slackName = await fetchSlackDisplayName(identity.slack_id);
      if (slackName) displayNameSource = slackName;
    }
    const fallbackName = `user_${identity.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;
    const candidateName = displayNameSource || identity.primary_email || fallbackName;
    // A rename later rejects a nasty/malformed name via nameProblem() , the
    // initial name from HCA/Slack must pass the same check or it never would.
    const displayNameFromHca = nameProblem(candidateName) ? fallbackName : candidateName;

    const { data: existingUsers, error: lookupError } = await supabase
      .from("users")
      .select("*")
      .eq("oauth_provider", "hackclub")
      .eq("oauth_id", identity.id)
      .limit(1);

    if (lookupError) {
      console.error("Supabase lookup failed", lookupError);
      loginFailed(req, "db_error");
      return res.status(500).send("Database error");
    }

    let userId: string;
    let displayName: string;
    let isNewUser = false;
    let needsLegalName = false;

    const hcaBirthday = extractBirthday(identity);
    const hcaAddress = extractAddress(identity);

    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0] as UserRow & { legal_first_name?: unknown; legal_last_name?: unknown };
      userId = existing.id;
      displayName = existing.display_name;
      needsLegalName = needsLegalNameFor(existing, fullName || existing.real_name || "");
      const fresh = hcaStatePatch(identity);
      if (fresh.hca_verification_status === undefined) {
        console.warn("[auth] HCA identity has no verification_status", userId);
      } else if (hcaStateChanged(existing as HcaStateRow, fresh) && !(await persistHcaState(userId, fresh))) {
        loginFailed(req, "hca_state_unsaved", { actorId: userId });
        return res.status(503).set("Retry-After", "5").send(unsavedStatePage(retryLoginUrl(pending)));
      }
      const patch: Record<string, string> = {};
      if (identity.slack_id) patch.slack_id = identity.slack_id;
      if (identity.primary_email) patch.email = identity.primary_email;
      // Keep the real name in sync every login , it's the authoritative identity the
      // dashboard shows, and the player's display_name can drift from it.
      if (fullName) patch.real_name = fullName;
      if (identity.first_name) patch.first_name = identity.first_name;
      if (identity.last_name) patch.last_name = identity.last_name;
      // Birthday/address now come from HCA (the /account self-report form is
      // gone) , keep them in sync every login the same way name/email are.
      if (hcaBirthday) patch.birthday = encryptPII(hcaBirthday);
      if (hcaAddress) {
        patch.address_line1 = encryptPII(hcaAddress.address_line1);
        patch.address_line2 = encryptPII(hcaAddress.address_line2);
        patch.address_city = encryptPII(hcaAddress.address_city);
        patch.address_state = encryptPII(hcaAddress.address_state);
        patch.address_country = encryptPII(hcaAddress.address_country);
        patch.address_postal = encryptPII(hcaAddress.address_postal);
      }
      if (Object.keys(patch).length > 0) {
        void supabase
          .from("users")
          .update(patch)
          .eq("id", userId)
          .then(({ error: e }) => {
            if (e) console.error("Failed to backfill slack_id/email", e);
          });
      }
      if (identity.slack_id && !(existing as { avatar_url?: string | null }).avatar_url)
        void saveSlackAvatar(userId, identity.slack_id);
    } else {
      if (isSignupRejected(identity)) {
        loginFailed(req, "signup_ineligible", { slackId: identity.slack_id ?? null });
        return res
          .status(403)
          .send(
            loginErrorPage(
              "This Hack Club account isn't eligible for Pixl.",
              "Hack Club Auth marks this identity as ineligible for YSWS programs, so a new Pixl account can't be created. If you think this is a mistake, reach out to the Pixl team.",
              retryLoginUrl(pending),
            ),
          );
      }

      const { data: created, error: insertError } = await supabase
        .from("users")
        .insert({
          oauth_provider: "hackclub",
          oauth_id: identity.id,
          ...hcaStatePatch(identity),
          display_name: displayNameFromHca,
          real_name: fullName,
          first_name: identity.first_name ?? "",
          last_name: identity.last_name ?? "",
          avatar_url: null,
          slack_id: identity.slack_id ?? null,
          email: identity.primary_email ?? null,
          birthday: hcaBirthday ? encryptPII(hcaBirthday) : null,
          // The address columns are NOT NULL DEFAULT '' , writing null when HCA
          // has no address on file fails the insert and blocks the signup.
          // encryptPII returns "" for a missing value, which is what we want.
          address_line1: encryptPII(hcaAddress?.address_line1),
          address_line2: encryptPII(hcaAddress?.address_line2),
          address_city: encryptPII(hcaAddress?.address_city),
          address_state: encryptPII(hcaAddress?.address_state),
          address_country: encryptPII(hcaAddress?.address_country),
          address_postal: encryptPII(hcaAddress?.address_postal),
        })
        .select()
        .single();

      if (insertError || !created) {
        // unique_violation on users(oauth_provider, oauth_id) (see
        // drizzle/0177_users_oauth_unique.sql) , two concurrent logins for the
        // same HCA identity both missed the select above and raced to insert;
        // the DB constraint is the actual guard. The loser just re-fetches the
        // row the winner created and logs into that account instead of erroring.
        if (isOauthIdentityRace(insertError)) {
          const { data: racedUser, error: racedLookupError } = await supabase
            .from("users")
            .select("*")
            .eq("oauth_provider", "hackclub")
            .eq("oauth_id", identity.id)
            .single();
          if (racedLookupError || !racedUser) {
            console.error("Post-race user lookup failed", racedLookupError);
            loginFailed(req, "db_error");
            return res.status(500).send("Database error");
          }
          const row = racedUser as UserRow & { legal_first_name?: unknown; legal_last_name?: unknown };
          userId = row.id;
          displayName = row.display_name;
          needsLegalName = needsLegalNameFor(row, fullName || row.real_name || "");
        } else {
          console.error("Supabase insert failed", insertError);
          loginFailed(req, "db_error");
          return res.status(500).send("Database error");
        }
      } else {
        isNewUser = true;
        const row = created as UserRow;
        userId = row.id;
        displayName = row.display_name;
        needsLegalName = needsLegalNameFor({}, fullName);
        if (identity.slack_id) void saveSlackAvatar(userId, identity.slack_id);

        const { error: stateError } = await supabase
          .from("player_state")
          .insert({ user_id: userId });

        if (stateError) {
          console.error("Failed to seed player_state", stateError);
        }
      }
    }

    // Fail closed: if the bans table can't be read, no login code is issued.
    const banLookup = await lookupActiveBan(userId);
    if (!banLookup.ok) {
      loginFailed(req, "ban_check_failed", { actorId: userId, slackId: identity.slack_id ?? null });
      return res
        .status(503)
        .set("Retry-After", "5")
        .send(loginErrorPage("Pixl couldn't finish logging you in", "Something went wrong on our side. Try again in a moment.", retryLoginUrl(pending)));
    }
    const ban = banLookup.ban;
    if (ban) {
      loginFailed(req, "banned", { actorId: userId, slackId: identity.slack_id ?? null });
      const heading = ban.expires_at
        ? `You've been temporarily banned from Pixl until ${new Date(ban.expires_at).toUTCString()}.`
        : "You've been permanently banned from Pixl.";
      const reason = ban.reason
        ? `<p>Reason: ${escapeHtml(ban.reason)}</p>`
        : "";
      return res
        .status(403)
        .send(
          `<html><body style="font-family:sans-serif;text-align:center;margin-top:4rem;"><h2>${heading}</h2>${reason}<p>If you believe this is a mistake, reach out to the Pixl team.</p></body></html>`,
        );
    }

    // Only a brand-new signup should get auto-invited , an existing player
    // logging back in is already (or deliberately isn't) in the channel.
    if (isNewUser && identity.slack_id) void enrollSlackPlayerInPixl(identity.slack_id);

    // The login was started with one of LOGIN_REDIRECTS, so this always
    // resolves; refuse rather than guess if it somehow doesn't.
    const loginClient = loginClientForRedirect(pending.redirect);
    if (!loginClient) {
      loginFailed(req, "bad_redirect", { actorId: userId });
      return res.status(400).json({ ok: false, error: "invalid_redirect" });
    }
    const grant: LoginGrant = {
      userId,
      displayName,
      slackId: identity.slack_id ?? null,
      isNew: isNewUser,
      needsLegalName,
      client: loginClient,
    };
    const loginCode = loginCodes.issue(grant);
    audit({
      ...requestActor(req),
      actorType: "player",
      actorId: userId,
      slackId: grant.slackId,
      action: "auth.login",
      target: `user:${userId}`,
      result: "ok",
      meta: { isNew: isNewUser, redirectOrigin: new URL(pending.redirect).origin },
    });

    const dest = new URL(pending.redirect);
    dest.searchParams.set("code", loginCode);
    if (pending.clientState) dest.searchParams.set("state", pending.clientState);
    res.redirect(dest.toString());
  },
);

export default router;
