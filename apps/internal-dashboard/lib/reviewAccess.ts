// Pure review-permission rules (no Next, no DB) so they're unit-testable.
// app/actions.ts feeds them the session, the project row and the lookups.

import type { ReviewQueueScope } from "./roles";

export interface ReviewViewer {
  isOwner: boolean;
  canSecondPass: boolean;
  reviewQueues: ReviewQueueScope;
  session: { slackId: string };
}

// A reviewer restricted to one queue (REVIEW_HARDWARE_ONLY /
// REVIEW_SOFTWARE_ONLY) may only act on projects of that kind - the same rule
// app/review/[id]/page.tsx applies when rendering, enforced again inside the
// actions so a hand-crafted form post can't reach the other queue. A project
// with no kind is treated like the page treats it: not in a restricted queue.
export function queueAllows(scope: ReviewQueueScope, kind: string | null | undefined): boolean {
  return scope === "both" || kind === scope;
}

// Self-review: the viewer (every users row carrying their Slack id) owns the
// project, or is an ACCEPTED collaborator on it. Either way they're paid when
// it's approved, so they may not review it.
export function isOwnOrCollaborator(
  viewerUserIds: readonly string[],
  ownerUserId: string | null | undefined,
  acceptedCollaboratorUserIds: readonly string[],
): boolean {
  if (viewerUserIds.length === 0) return false;
  const mine = new Set(viewerUserIds.filter(Boolean));
  if (ownerUserId && mine.has(ownerUserId)) return true;
  return acceptedCollaboratorUserIds.some((id) => mine.has(id));
}

// A verdict on a first-pass BAN PROPOSAL (stage second_review,
// first_pass_verdict = "banned").
// - Ban decisions are owner-only (spec): confirming the ban, or approving the
//   project outright, is a final decision only an owner makes.
// - A non-owner final reviewer who disagrees with the ban ("approved") does
//   NOT final-approve: the project goes back into the normal pipeline
//   (fraud_review -> Robert -> owner Spot check), exactly like a first-pass
//   approval.
// - "needs_changes" bounces it to the maker, as from any stage.
// - Nobody may decide on a project they own or collaborate on, owners included
//   (it would be approving or banning their own work).
export type ProposedBanDecision =
  | { kind: "deny"; reason: string }
  | { kind: "final" } // owner: the verdict applies as-is
  | { kind: "reroute_to_pipeline" } // non-owner overturn: treat as first-pass approval
  | { kind: "needs_changes" };

export function proposedBanDecision(
  viewer: ReviewViewer,
  verdict: string,
  opts: { own: boolean; proposedBy: string; actor: string },
): ProposedBanDecision {
  if (opts.own) return { kind: "deny", reason: "You can't decide on a project you own or collaborate on." };
  if (!viewer.canSecondPass && !viewer.isOwner)
    return { kind: "deny", reason: "You don't have second-pass review access." };
  if (!viewer.isOwner && opts.proposedBy === opts.actor)
    return { kind: "deny", reason: "A different reviewer must confirm or overturn this ban proposal." };
  if (verdict === "needs_changes") return { kind: "needs_changes" };
  if (viewer.isOwner) return { kind: "final" };
  if (verdict === "ban") return { kind: "deny", reason: "Only an owner can confirm a ban." };
  if (verdict === "approved") return { kind: "reroute_to_pipeline" };
  return { kind: "deny", reason: "Unknown verdict." };
}

// Putting a review on hold must not clobber somebody else's active hold
// (that would silently take over their hold and its reason). No hold, or a
// hold that's already yours: fine. Someone else's (or one whose setter can't
// be identified): owners only.
export function canSetHold(
  current: { held: boolean; holderSlackId: string | null | undefined },
  viewer: { isOwner: boolean; session: { slackId: string } },
): boolean {
  if (!current.held || viewer.isOwner) return true;
  const holder = (current.holderSlackId ?? "").trim();
  return holder !== "" && holder === viewer.session.slackId;
}

// ---- Builder PII on the review page (app/review/[id]) ----
//
// Contact/identity PII (legal name, email, exact birth date, mailing address)
// is only for final (second-pass) reviewers and owners. A first-pass reviewer
// reviews code and hours; for the eligibility check they get the builder's
// AGE (not the birth date) plus whether each unified-DB field is on file,
// never the values themselves.
export function canSeeBuilderPII(viewer: { isOwner: boolean; canSecondPass: boolean }): boolean {
  return viewer.isOwner || viewer.canSecondPass;
}

export interface BuilderRaw {
  fullName: string;
  email: string;
  birthday: string; // decrypted ISO date or ""
  age: number | null;
  country: string;
  address: string; // joined, "" when none
}

export interface BuilderView {
  privileged: boolean;
  fullName: string;
  email: string;
  ageLabel: string;
  country: string;
  // null = don't render the address row at all.
  address: string | null;
}

const onFile = (v: string) => (v.trim() && v.trim() !== "-" ? "on file" : "missing");

export function builderDetailsView(
  viewer: { isOwner: boolean; canSecondPass: boolean },
  isFinalStage: boolean,
  raw: BuilderRaw,
): BuilderView {
  const ageText = raw.age != null ? String(raw.age) : "-";
  if (!canSeeBuilderPII(viewer)) {
    return {
      privileged: false,
      fullName: onFile(raw.fullName),
      email: onFile(raw.email),
      ageLabel: ageText,
      country: onFile(raw.country),
      address: null,
    };
  }
  return {
    privileged: true,
    fullName: raw.fullName || "-",
    email: raw.email || "-",
    ageLabel: raw.age != null ? `${raw.age}${isFinalStage && raw.birthday ? ` (born ${raw.birthday})` : ""}` : "-",
    country: raw.country || "-",
    address: isFinalStage ? raw.address || "-" : null,
  };
}
