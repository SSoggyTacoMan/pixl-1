import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { Badge, buttonVariants, pageTitle, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { safeHttpUrl } from "@/lib/safe-url";
import { statusInfo } from "../../explore/lib";
import { hours, shortDate } from "../format";
import { CopyLinkButton } from "./copy-link";
import { backLink, projHero, projHeroImg, sectionH } from "./styles";

/** GET /api/explore/projects/:id - only the fields the server marks public. */
export interface PublicProject {
  project: {
    id: number;
    name: string;
    description: string | null;
    repo_url: string | null;
    demo_url: string | null;
    image_url: string | null;
    status: string;
    level: number | null;
    is_peak: boolean | null;
    hackatime_seconds: number | null;
    approved_hours: number | null;
    pixels_earned: number | null;
    created_at: string;
    shipped_at: string | null;
  };
  owner: { id: string; display_name: string } | null;
  entries: { id: number; title: string | null; content: string | null; hours: number | null; created_at: string }[];
  reviews: { verdict: string; note: string; created_at: string }[];
  upvotes: number;
}

/** Read-only page for someone else's project. Nothing here is editable. */
export function PublicView({ data }: { data: PublicProject }) {
  const { project, owner, entries, reviews } = data;
  const st = statusInfo(project.status);
  const repo = safeHttpUrl(project.repo_url);
  const demo = safeHttpUrl(project.demo_url);
  return (
    <div>
      <Link className={backLink} href="/explore">
        ← ALL PROJECTS
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className={cn(pageTitle, "text-3xl")}>{project.name}</h1>
        <Badge>{st.label}</Badge>
        {project.level != null ? <Badge>LV {project.level}</Badge> : null}
        {project.is_peak ? (
          <Badge tone="gold" title="Nominated as a standout project by a reviewer">
            BEACON
          </Badge>
        ) : null}
        <Badge tone="teal">{hours(project.hackatime_seconds)} TRACKED</Badge>
        <Badge>{data.upvotes} UPVOTES</Badge>
        <span className="ml-auto">
          <CopyLinkButton id={project.id} />
        </span>
      </div>
      {owner ? (
        <p className="mb-4 text-sm text-faint">
          by{" "}
          <Link className="text-gold underline-offset-2 hover:underline" href={`/explore/players/${owner.id}`}>
            {owner.display_name}
          </Link>{" "}
          · started {shortDate(project.created_at)}
        </p>
      ) : null}
      <div className={projHero}>
        <SafeImage
          player
          src={project.image_url}
          className={projHeroImg}
          fallback={<span className="text-sm text-faint">No thumbnail yet</span>}
        />
      </div>
      {project.description ? <Markdown source={project.description} className="mb-4" /> : null}
      <div className="mb-5 flex gap-2">
        {repo ? (
          <a className={buttonVariants({ variant: "ghost" })} href={repo} target="_blank" rel="noopener noreferrer">
            REPO
          </a>
        ) : null}
        {demo ? (
          <a className={buttonVariants({ variant: "ghost" })} href={demo} target="_blank" rel="noopener noreferrer">
            DEMO
          </a>
        ) : null}
      </div>
      {reviews.length ? (
        <>
          <div className={sectionH}>REVIEWS</div>
          {reviews.map((r, i) => (
            <div key={i} className={cn(panel, "mb-2 p-4")}>
              <div className="mb-1 text-sm">
                <b>{r.verdict === "approved" ? "APPROVED" : "CHANGES REQUESTED"}</b>{" "}
                <span className="text-faint">{shortDate(r.created_at)}</span>
              </div>
              {r.note ? <Markdown source={r.note} /> : null}
            </div>
          ))}
        </>
      ) : null}
      <div className={sectionH}>JOURNAL</div>
      {entries.length ? (
        entries.map((e) => (
          <div key={e.id} className={cn(panel, "mb-2 p-4")}>
            <div className="mb-1 text-sm">
              <b>{e.title || "Entry"}</b> <span className="text-faint">{shortDate(e.created_at)}</span>
              {e.hours ? <span className="text-faint"> · {Number(e.hours).toFixed(1)}h</span> : null}
            </div>
            {e.content ? <Markdown source={e.content} /> : null}
          </div>
        ))
      ) : (
        <p className="text-sm text-faint">No journal entries yet.</p>
      )}
    </div>
  );
}
