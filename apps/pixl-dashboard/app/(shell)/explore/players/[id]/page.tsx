import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { config } from "@/app/_generated/config";
import { SafeImage } from "@/components/safe-image";
import { EmptyNote, buttonVariants } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { serverGet } from "@/lib/server-api";
import { isPlayerId, recentActivity, timeAgo } from "../../lib";
import type { PlayerProfile } from "../../types";
import { CopyButton } from "../../_components/copy-button";
import { ProjectCard } from "../../_components/project-card";
import { Ticket } from "../../_components/ticket";
import { sectionHeading, shipGrid } from "../../styles";

export const metadata: Metadata = { title: "Player" };

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isPlayerId(id)) notFound();

  // GET /api/explore/players/:id (session): every non-archived project plus
  // the collectibles shelf.
  const res = await serverGet<PlayerProfile>(`/api/explore/players/${encodeURIComponent(id)}`);
  if (!res.ok) {
    if (res.status === 404) notFound();
    return <EmptyNote>COULDN&apos;T LOAD THIS PLAYER. TRY AGAIN IN A BIT.</EmptyNote>;
  }
  const { player: p } = res.data;
  const projects = res.data.projects ?? [];
  const collectibles = res.data.collectibles ?? [];
  const activity = recentActivity(projects, collectibles);
  const owner = { id: p.id, display_name: p.display_name, avatar_url: p.avatar_url };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link className={buttonVariants({ variant: "dark" })} href="/explore/players">
          ← ALL PLAYERS
        </Link>
        <CopyButton text={`${config.urls.site}/explore/players/${id}`} label="COPY LINK" />
      </div>

      <div className="grid grid-cols-[460px_minmax(0,1fr)] items-start gap-[26px] max-[980px]:grid-cols-[minmax(0,1fr)]">
        <Ticket p={p} projectCount={projects.length} />

        <div>
          {activity.length ? (
            <section className="mt-[13px] mb-6">
              <h2 className={sectionHeading}>RECENT ACTIVITY</h2>
              <div className="flex flex-col gap-2">
                {activity.map((e, i) => (
                  <div
                    className="flex items-center gap-2.5 border-2 border-stroke bg-panel px-3 py-[9px] text-[13.5px]"
                    key={`${e.t}-${i}`}
                  >
                    <span className={cn("size-[9px] shrink-0 border border-stroke", e.kind === "ship" ? "bg-good" : "bg-gold")} />
                    <span className="flex-1 text-ink">
                      {e.kind === "ship" ? "Shipped " : "Earned "}
                      <b>{e.name}</b>
                    </span>
                    <span className="shrink-0 text-[11.5px] text-faint">{timeAgo(e.t)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {collectibles.length ? (
            <section className="mt-[13px] mb-6">
              <h2 className={sectionHeading}>EQUIPPED BADGES &amp; INVENTORY</h2>
              <div className="flex flex-wrap gap-2.5">
                {collectibles.map((c, i) => (
                  <div className="w-[62px]" key={String(c.id ?? i)} title={c.description || c.name || ""}>
                    <div className="grid size-[62px] place-items-center overflow-hidden border-2 border-stroke bg-panel-2 text-[22px] text-gold">
                      <SafeImage
                        src={c.image_url}
                        fallback="◆"
                        className="size-full object-contain [image-rendering:pixelated]"
                      />
                    </div>
                    <div className="mt-1 truncate text-center text-[10px] text-faint">{c.name}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-[13px] mb-6">
            <h2 className={sectionHeading}>PROJECTS ({projects.length})</h2>
            {projects.length === 0 ? (
              <EmptyNote>NO PROJECTS YET.</EmptyNote>
            ) : (
              <div className={shipGrid}>
                {projects.map((pr) => (
                  <ProjectCard key={pr.id} p={{ ...pr, owner_name: p.display_name }} owner={owner} canVote={false} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
