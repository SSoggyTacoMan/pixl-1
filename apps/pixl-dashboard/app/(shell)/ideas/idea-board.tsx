// Server Component shared by /ideas (newest) and /ideas/top (most upvoted).
import Link from "next/link";
import { EmptyNote, Notice, pageSub, pageTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { serverGet } from "@/lib/server-api";
import { Compose } from "./compose";
import { IdeaCard, PosterCard } from "./idea-cards";
import type { Idea, IdeaSort } from "./ideas-lib";
import { SearchBar } from "./search-bar";

export async function IdeaBoard({ sort, q }: { sort: IdeaSort; q: string }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort === "top") params.set("sort", "top");
  const qs = params.toString();
  const res = await serverGet<{ ideas?: Idea[] }>(`/api/ideas${qs ? `?${qs}` : ""}`);
  const ideas = res.ok ? (res.data.ideas ?? []) : [];

  return (
    <div>
      <section>
        <div>
          <h1 className={pageTitle}>IDEAS</h1>
          <div className={pageSub}>POST WHAT YOU&apos;D BUILD. BROWSE WHAT EVERYONE ELSE WOULD. STEAL FREELY.</div>
        </div>
      </section>

      <div className="mt-4">
        <Compose />
      </div>

      <nav className="mb-[18px] flex flex-wrap gap-1.5" aria-label="Sort ideas">
        <Link className={tabClass(sort === "new")} href="/ideas">
          NEW
        </Link>
        <Link className={tabClass(sort === "top")} href="/ideas/top">
          TOP
        </Link>
      </nav>
      <SearchBar key={sort} initial={q} />

      {!res.ok ? (
        <Notice tone="bad">Couldn&apos;t load ideas.</Notice>
      ) : ideas.length === 0 ? (
        <EmptyNote>{q ? "NO IDEAS MATCH THAT SEARCH." : "NO IDEAS YET, POST THE FIRST ONE!"}</EmptyNote>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
          {ideas.map((i) =>
            i.is_collab ? <PosterCard key={String(i.id)} idea={i} /> : <IdeaCard key={String(i.id)} idea={i} />,
          )}
        </div>
      )}
    </div>
  );
}

function tabClass(active: boolean): string {
  return cn(
    "inline-block border-2 border-stroke bg-panel px-[18px] pt-2.5 pb-2 text-[15px] tracking-[1px] text-dim no-underline",
    "transition-[border-color,color,background-color] duration-150 hover:border-gold hover:text-gold",
    active && "border-gold bg-gold text-btn-ink hover:text-btn-ink",
  );
}

export function readQuery(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, 120);
}
