import Link from "next/link";
import { Badge, buttonVariants, card, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { SafeImage } from "@/components/safe-image";
import { safeHttpUrl } from "@/lib/safe-url";
import { hours } from "../format";
import { isInReview, levelName, statusInfo, type BlackoutState, type HtStats, type Project } from "../types";
import { BlackoutChip } from "./blackout-chip";
import { CopyLinkButton } from "./copy-link";
import { noteStrip, sectionH, statusChip, statusDot, type StatusTone } from "./styles";

/** Hackatime seconds behind a project's linked names, as the server reported them. */
export function linkedSeconds(p: Project, stats: HtStats | null): number {
  // In review the clock is stopped: show the snapshot taken at ship.
  if (isInReview(p) && p.hackatime_seconds != null)
    return Math.max(Number(p.hackatime_seconds) - (p.kind === "hardware" ? Number(p.journal_seconds) || 0 : 0), 0);
  if (!stats || !stats.connected) return 0;
  const linked = new Set(p.hackatime_projects || []);
  return stats.projects.filter((h) => linked.has(h.name)).reduce((s, h) => s + (h.secondsSinceCutoff ?? h.seconds), 0);
}

const LEGEND: [string, StatusTone, (p: Project) => boolean][] = [
  ["APPROVED", "approved", (p) => p.status === "approved" && !p.rejected_at],
  ["IN REVIEW", "shipped", (p) => isInReview(p)],
  ["NEEDS CHANGES", "needs", (p) => p.status === "needs_changes" || !!p.rejected_at || !!p.banned_at],
  ["UNSHIPPED", "draft", (p) => !p.status || p.status === "draft"],
];

export function Legend({ projects }: { projects: Project[] }) {
  if (!projects.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-[12px] font-pixel text-[11px] tracking-[1px] text-dim">
      {LEGEND.map(([label, tone, match]) => (
        <span key={label}>
          <span className={statusDot(tone)} />
          {label}
          <span className="ml-[4px] text-ink">{projects.filter(match).length}</span>
        </span>
      ))}
    </div>
  );
}

function ProjectRow({ p, stats, blackout }: { p: Project; stats: HtStats | null; blackout: BlackoutState }) {
  const [label, tone] = statusInfo(p);
  const ht = linkedSeconds(p, stats);
  const journal = Number(p.journal_seconds) || 0;
  const repo = safeHttpUrl(p.repo_url);
  const demo = safeHttpUrl(p.demo_url);
  const htNames = (p.hackatime_projects || []).join(", ");
  return (
    <div className={cn(card, "grid grid-cols-[96px_1fr] gap-[14px] p-[12px] text-ink max-[720px]:grid-cols-[64px_1fr]")}>
      <Link
        href={`/projects/${p.id}`}
        className={cn(
          "flex h-[72px] w-[96px] items-center justify-center overflow-hidden border-2 border-stroke bg-(--img-slot)",
          "font-pixel text-[10px] text-muted hover:text-gold-soft max-[720px]:h-[52px] max-[720px]:w-[64px]",
        )}
        aria-label={p.name}
      >
        <SafeImage player src={p.image_url} className="size-full object-cover" fallback="NO IMAGE" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link className="font-pixel text-[18px] text-ink hover:text-gold-soft" href={`/projects/${p.id}`}>
            {p.name}
          </Link>
          <span className={statusChip(tone)}>{label}</span>
          <Badge>{levelName(p.level)}</Badge>
          {ht + journal > 0 ? (
            <Badge tone="teal" title={`Hackatime: ${hours(ht)} · Journal: ${hours(journal)}`}>
              {hours(ht + journal)}
            </Badge>
          ) : null}
          <BlackoutChip entry={blackout.entries[p.id]} />
          {p.is_owner === false ? <Badge>COLLABORATOR</Badge> : null}
          {p.trial_reward_choice === "pending" ? <Badge tone="gold">TRIAL REWARD WAITING</Badge> : null}
        </div>
        {p.description ? <p className="mt-1 line-clamp-2 text-sm text-dim">{p.description}</p> : null}
        <div className="mt-[6px] flex flex-wrap gap-[12px] text-[12px] text-dim">
          {repo ? (
            <a href={repo} target="_blank" rel="noopener noreferrer">
              CODE
            </a>
          ) : null}
          {demo ? (
            <a href={demo} target="_blank" rel="noopener noreferrer">
              DEMO
            </a>
          ) : null}
          <CopyLinkButton id={p.id} variant="link" />
          <span>{htNames ? `Hackatime: ${htNames}${ht ? ` · ${hours(ht)}` : ""}` : "no hackatime linked"}</span>
          {p.pixels_earned ? <span className="text-gold">+{Math.round(p.pixels_earned)} px earned</span> : null}
        </div>
        {p.status === "needs_changes" && p.review_note ? <div className={noteStrip}>{p.review_note}</div> : null}
        {p.rejected_at && p.reject_reason ? <div className={noteStrip}>{p.reject_reason}</div> : null}
      </div>
    </div>
  );
}

export function ProjectList({
  projects,
  stats,
  blackout,
}: {
  projects: Project[];
  stats: HtStats | null;
  blackout: BlackoutState;
}) {
  if (!projects.length) {
    return (
      <div className={cn(panel, "p-8 text-center")}>
        <h2 className="font-pixel text-2xl">NO PROJECTS YET</h2>
        <p className="mx-auto mt-2 max-w-xl text-dim">
          Log what you&apos;re building, link it to Hackatime, journal as you go, then ship it for review: approved hours
          pay out in pixels.
        </p>
        <Link className={cn(buttonVariants(), "mt-4")} href="/projects/new">
          + START YOUR FIRST PROJECT
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className={sectionH}>MY PROJECTS · {projects.length}</div>
      <div className="flex flex-col gap-[12px]">
        {projects.map((p) => (
          <ProjectRow key={p.id} p={p} stats={stats} blackout={blackout} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className={buttonVariants()} href="/projects/new">
          + NEW PROJECT
        </Link>
        <Link className={buttonVariants({ variant: "dark" })} href="/docs/shipping">
          SHIPPING GUIDE
        </Link>
      </div>
    </>
  );
}
