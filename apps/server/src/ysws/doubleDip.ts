import type { ArchiveMatch } from "./archive.js";
import { config } from "../config.generated.js";

export interface ImportProvenance {
  imported_ysws_entry_id: string | null;
  imported_from_ysws: string | null;
  imported_ysws_hours: number | null;
  imported_ysws_approved_at: string | null;
}

// One person on the current ship (owner or an accepted collaborator), with
// their own independently-tracked hours - never a team total. label is a
// display name when we have one, otherwise the Slack ID.
export interface TeamMember {
  slackId: string;
  label: string;
  claimedHours: number;
}

export interface DoubleDipInput {
  project: { name: string } & ImportProvenance;
  // Every archive row sharing this repo/demo URL - a team's prior submission
  // has one row per collaborator, not one lumped total.
  matches: ArchiveMatch[];
  otherYsws: boolean;
  // The ship owner's own claimed time (Hackatime plus their journal hours,
  // the total the review page shows) - kept separate from `collaborators`
  // since the owner is always on the ship even with zero collaborators.
  trackedSeconds: number;
  // Accepted collaborators only (not the owner - see trackedSeconds above).
  collaborators: TeamMember[];
  ownerLabel: string;
  ownerSlackId: string | null;
}

export interface DoubleDipResult {
  systemNote: string;
  flagDetail?: string;
}

function hoursOf(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}

function fmtDate(unixSeconds: number | null): string {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString().slice(0, 10) : "unknown date";
}

function suggestedCapLine(label: string, claimed: number, prior: number): string {
  const cap = Math.max(0, Math.round((claimed - prior) * 10) / 10);
  return `${label}: claims ${claimed}h here, got ${prior}h before , suggest crediting at most ${cap}h unless the new work is clearly separate.`;
}

// This program's own earlier approvals land in the same archive, so a re-ship
// of a project that was already approved here matches itself.
function isOwnProgram(m: ArchiveMatch): boolean {
  return m.ysws.trim().toLowerCase() === config.name.toLowerCase();
}

// Renders the per-person breakdown block shared by every "matches found"
// case below: every prior archive entry (who got what, when), then every
// current team member (owner + collaborators) matched against those entries
// by Slack ID where possible, so a reviewer never has to guess who on the
// team already got credited for how much of this repo elsewhere.
//
// Many archive rows carry no Slack ID at all. When the ship has a single person
// on it, a row without a Slack ID on the same repo can only be theirs, so it is
// attributed to them (with a team, an anonymous row stays "someone").
function teamBreakdown(matches: ArchiveMatch[], team: TeamMember[]): string {
  const solo = team.length === 1 ? team[0] : null;
  const isTheirs = (m: ArchiveMatch, t: TeamMember) =>
    (m.slackId !== "" && m.slackId === t.slackId) || (solo === t && m.slackId === "");
  const priorLines = matches
    .map((m) => {
      const known = team.find((t) => isTheirs(m, t));
      const who = known ? known.label : m.slackId ? `Slack user ${m.slackId}` : "someone";
      return `${who} got ${m.hours}h (approved ${fmtDate(m.approvedAt)})`;
    })
    .join("; ");

  const teamLines = team
    .map((t) => {
      // Every prior entry for this person counts: a project approved twice
      // already has two archive rows, and only the sum is credited time.
      const priors = matches.filter((m) => isTheirs(m, t));
      const prior = Math.round(priors.reduce((s, m) => s + m.hours, 0) * 10) / 10;
      return priors.length > 0
        ? suggestedCapLine(t.label, t.claimedHours, prior)
        : `${t.label}: claims ${t.claimedHours}h here, no prior entry found for them specifically , no overlap to deflate.`;
    })
    .join(" ");

  return `Prior entries for this repo: ${priorLines}. Per person on this ship: ${teamLines}`;
}

export function buildDoubleDip(input: DoubleDipInput): DoubleDipResult {
  const { project, matches, otherYsws, trackedSeconds, collaborators, ownerLabel, ownerSlackId } =
    input;
  const claimedHours = hoursOf(trackedSeconds);
  const team: TeamMember[] = [
    { slackId: ownerSlackId ?? "", label: ownerLabel, claimedHours },
    ...collaborators,
  ];

  if (matches.length > 0) {
    // Name the other program, not this one, whenever there is one.
    const outside = matches.filter((m) => !isOwnProgram(m));
    const first = outside[0] ?? matches[0];
    const breakdown = teamBreakdown(matches, team);
    if (project.imported_ysws_entry_id) {
      return {
        systemNote: `SYSTEM: Imported from "${first.ysws}" (${first.url}) through the YSWS importer, so the prior ship was declared up front. ${breakdown}`,
      };
    }
    if (outside.length === 0) {
      return {
        systemNote: `SYSTEM: ${first.url} was already approved in ${config.name} before, so this is a re-ship: only the work since then should count. ${breakdown}`,
      };
    }
    if (otherYsws) {
      return {
        systemNote: `SYSTEM: Player disclosed this was submitted to "${first.ysws}" (${first.url}). ${breakdown}`,
      };
    }
    return {
      systemNote: `SYSTEM: ${first.url} already appears in the Hack Club YSWS archive under "${first.ysws}" but the player did NOT disclose it. Possible double dip. ${breakdown}`,
      flagDetail: `"${project.name}" shipped without disclosure: ${first.url} found in the YSWS archive (${first.ysws}, ${outside.map((m) => `${m.hours}h`).join("+")})`,
    };
  }

  if (project.imported_ysws_entry_id) {
    const priorHours = Number(project.imported_ysws_hours) || 0;
    const when = project.imported_ysws_approved_at
      ? String(project.imported_ysws_approved_at).slice(0, 10)
      : "unknown date";
    return {
      systemNote: `SYSTEM: Imported from "${project.imported_from_ysws}" through the YSWS importer, but its links no longer match the archive (edited since import). ${suggestedCapLine(ownerLabel, claimedHours, priorHours)} (approved ${when})`,
    };
  }

  return { systemNote: "" };
}
