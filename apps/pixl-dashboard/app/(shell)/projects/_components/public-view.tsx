import Link from "next/link";
import { Markdown } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { Badge } from "@/components/ui/primitives";
import { safeHttpUrl } from "@/lib/safe-url";
import { statusInfo } from "../../explore/lib";
import { hours, shortDate } from "../format";
import { CopyLinkButton } from "./copy-link";

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
      <Link className="btn dark mb-4 inline-block" href="/explore">
        ← ALL PROJECTS
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="page-title !text-3xl">{project.name}</h1>
        <span className="chip">{st.label}</span>
        {project.level != null ? <Badge>LV {project.level}</Badge> : null}
        {project.is_peak ? (
          <Badge tone="gold" title="Nominated as a standout project by a reviewer">
            BEACON
          </Badge>
        ) : null}
        <span className="chip teal">{hours(project.hackatime_seconds)} TRACKED</span>
        <Badge>{data.upvotes} UPVOTES</Badge>
        <span className="ml-auto">
          <CopyLinkButton id={project.id} />
        </span>
      </div>
      {owner ? (
        <p className="faint mb-4 text-sm">
          by{" "}
          <Link className="text-gold underline-offset-2 hover:underline" href={`/explore/players/${owner.id}`}>
            {owner.display_name}
          </Link>{" "}
          · started {shortDate(project.created_at)}
        </p>
      ) : null}
      <div className="proj-hero mb-4">
        <SafeImage player src={project.image_url} fallback={<span className="faint text-sm">No thumbnail yet</span>} />
      </div>
      {project.description ? <Markdown source={project.description} className="mb-4" /> : null}
      <div className="mb-5 flex gap-2">
        {repo ? (
          <a className="btn ghost" href={repo} target="_blank" rel="noopener noreferrer">
            REPO
          </a>
        ) : null}
        {demo ? (
          <a className="btn ghost" href={demo} target="_blank" rel="noopener noreferrer">
            DEMO
          </a>
        ) : null}
      </div>
      {reviews.length ? (
        <>
          <div className="section-h">REVIEWS</div>
          {reviews.map((r, i) => (
            <div key={i} className="panel mb-2 p-4">
              <div className="mb-1 text-sm">
                <b>{r.verdict === "approved" ? "APPROVED" : "CHANGES REQUESTED"}</b>{" "}
                <span className="faint">{shortDate(r.created_at)}</span>
              </div>
              {r.note ? <Markdown source={r.note} /> : null}
            </div>
          ))}
        </>
      ) : null}
      <div className="section-h">JOURNAL</div>
      {entries.length ? (
        entries.map((e) => (
          <div key={e.id} className="panel mb-2 p-4">
            <div className="mb-1 text-sm">
              <b>{e.title || "Entry"}</b> <span className="faint">{shortDate(e.created_at)}</span>
              {e.hours ? <span className="faint"> · {Number(e.hours).toFixed(1)}h</span> : null}
            </div>
            {e.content ? <Markdown source={e.content} /> : null}
          </div>
        ))
      ) : (
        <p className="faint text-sm">No journal entries yet.</p>
      )}
    </div>
  );
}
