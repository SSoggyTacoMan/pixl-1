// Server Component shared by /ideas (newest) and /ideas/top (most upvoted).
import Link from "next/link";
import { EmptyNote, Notice } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { Compose } from "./compose";
import { IdeaCard, PosterCard } from "./idea-cards";
import type { Idea, IdeaSort } from "./ideas-lib";
import { SearchBar } from "./search-bar";
import "./ideas.css";

export async function IdeaBoard({ sort, q }: { sort: IdeaSort; q: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort === "top") params.set("sort", "top");
  const qs = params.toString();
  const res = await serverGet<{ ideas?: Idea[] }>(`/api/ideas${qs ? `?${qs}` : ""}`);
  const ideas = res.ok ? (res.data.ideas ?? []) : [];

  return (
    <div className="ideas-page">
      <section className="hero">
        <div>
          <h1 className="page-title">IDEAS</h1>
          <div className="page-sub">POST WHAT YOU&apos;D BUILD. BROWSE WHAT EVERYONE ELSE WOULD. STEAL FREELY.</div>
        </div>
      </section>

      <div className="mt-4">
        <Compose />
      </div>

      <nav className="tabs" aria-label="Sort ideas">
        <Link className={`tab${sort === "new" ? " active" : ""}`} href="/ideas">
          NEW
        </Link>
        <Link className={`tab${sort === "top" ? " active" : ""}`} href="/ideas/top">
          TOP
        </Link>
      </nav>
      <SearchBar key={sort} initial={q} />

      {!res.ok ? (
        <Notice tone="bad">Couldn&apos;t load ideas.</Notice>
      ) : ideas.length === 0 ? (
        <EmptyNote>{q ? "NO IDEAS MATCH THAT SEARCH." : "NO IDEAS YET, POST THE FIRST ONE!"}</EmptyNote>
      ) : (
        <div className="idea-list">
          {ideas.map((i) =>
            i.is_collab ? <PosterCard key={String(i.id)} idea={i} /> : <IdeaCard key={String(i.id)} idea={i} />,
          )}
        </div>
      )}
    </div>
  );
}

export function readQuery(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, 120);
}
