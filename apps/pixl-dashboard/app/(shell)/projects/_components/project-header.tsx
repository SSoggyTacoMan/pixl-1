import { SafeImage } from "@/components/safe-image";
import { Badge, Notice } from "@/components/ui/primitives";
import { hours, shortDate } from "../format";
import { statusInfo, type BlackoutEntry, type Project } from "../types";
import { BlackoutChip } from "./blackout-chip";
import type { ProjectEstimate } from "../../calc/estimates";
import { CopyLinkButton } from "./copy-link";

/**
 * Title, status chips, hero image and reviewer notes. Every number shown is
 * a server value (or a plain sum of two server values); the payout estimate
 * chips are computed by the Server Component (calc/estimates.ts) and arrive
 * as plain numbers.
 */
export function ProjectHeader({
  project,
  imageUrl,
  htSeconds,
  journalSeconds,
  blackoutEntry,
  collaborator,
  estimate,
}: {
  project: Project;
  imageUrl: string;
  htSeconds: number;
  journalSeconds: number;
  blackoutEntry?: BlackoutEntry;
  collaborator?: boolean;
  estimate?: ProjectEstimate | null;
}) {
  const [label, cls] = statusInfo(project);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="page-title !text-3xl">{project.name}</h1>
        <span className={`chip ${cls}`}>{label}</span>
        {collaborator ? <Badge>COLLABORATOR</Badge> : null}
        <span className="chip teal" title={`Hackatime: ${hours(htSeconds)} · Journal: ${hours(journalSeconds)}`}>
          {hours(htSeconds + journalSeconds)} TRACKED
        </span>
        {estimate ? <EstimateChips estimate={estimate} /> : null}
        {project.pixels_earned ? <Badge tone="gold">+{Math.round(project.pixels_earned)} PX EARNED</Badge> : null}
        {project.is_peak ? (
          <Badge tone="gold" title="Nominated as a standout project by a reviewer">
            BEACON
          </Badge>
        ) : null}
        {project.sidequest_name ? <Badge tone="teal">TRIAL: {project.sidequest_name}</Badge> : null}
        <BlackoutChip entry={blackoutEntry} />
        <span className="ml-auto">
          <CopyLinkButton id={project.id} />
        </span>
      </div>
      <div className="proj-hero mb-4">
        <SafeImage src={imageUrl} fallback={<span className="faint text-sm">No thumbnail yet</span>} />
      </div>
      {project.status === "needs_changes" && project.review_note ? (
        <Notice tone="bad" className="mb-3">
          REVIEWER: {project.review_note}
        </Notice>
      ) : null}
      {project.rejected_at ? (
        <Notice tone="bad" className="mb-3">
          REJECTED{project.reject_reason ? `: ${project.reject_reason}` : ""}, fix it up and ship again.
        </Notice>
      ) : null}
      {project.hours_extended_since ? (
        <Notice className="mb-3">
          Your hours cutoff was extended: we&apos;re counting your coding time from {shortDate(project.hours_extended_since)} onward.
        </Notice>
      ) : null}
    </>
  );
}

function EstimateChips({ estimate }: { estimate: ProjectEstimate }) {
  const tracked = hours(estimate.trackedSeconds);
  const hoursNote =
    estimate.approvedHours > 0 ? `${tracked} tracked − ${estimate.approvedHours}h already paid out` : `${tracked} tracked`;
  const pxNote = `At your current rate ($${estimate.usdPerHour.toFixed(2)}/hr). Rough estimate, actual review may differ.`;
  return (
    <>
      <span className="chip teal" title={hoursNote} aria-label={`${hours(estimate.netHours * 3600)} new hours: ${hoursNote}`}>
        {hours(estimate.netHours * 3600)} NEW
      </span>
      <span className="chip gold" title={pxNote} aria-label={`About ${estimate.px} pixels estimated. ${pxNote}`}>
        ≈{estimate.px} PX EST.
      </span>
    </>
  );
}
