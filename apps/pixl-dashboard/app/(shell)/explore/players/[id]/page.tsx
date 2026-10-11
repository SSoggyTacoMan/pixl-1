import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { config } from "@/app/_generated/config";
import { SafeImage } from "@/components/safe-image";
import { EmptyNote } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { isPlayerId, recentActivity, timeAgo } from "../../lib";
import type { PlayerProfile } from "../../types";
import { CopyButton } from "../../_components/copy-button";
import { ProjectCard } from "../../_components/project-card";
import { Ticket } from "../../_components/ticket";
import "../../explore.css";

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
        <Link className="btn dark" href="/explore/players">
          ← ALL PLAYERS
        </Link>
        <CopyButton text={`${config.urls.site}/explore/players/${id}`} label="COPY LINK" />
      </div>

      <div className="pt-layout">
        <Ticket p={p} projectCount={projects.length} />

        <div>
          {activity.length ? (
            <section className="dash-section">
              <h2 className="dash-h">RECENT ACTIVITY</h2>
              <div className="activity-list">
                {activity.map((e, i) => (
                  <div className="activity-row" key={`${e.t}-${i}`}>
                    <span className={`adot ${e.kind === "ship" ? "good" : "gold"}`} />
                    <span className="abody">
                      {e.kind === "ship" ? "Shipped " : "Earned "}
                      <b>{e.name}</b>
                    </span>
                    <span className="atime">{timeAgo(e.t)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {collectibles.length ? (
            <section className="dash-section">
              <h2 className="dash-h">EQUIPPED BADGES &amp; INVENTORY</h2>
              <div className="badge-grid">
                {collectibles.map((c, i) => (
                  <div className="badge-cell" key={String(c.id ?? i)} title={c.description || c.name || ""}>
                    <div className="b-thumb">
                      <SafeImage src={c.image_url} fallback="◆" />
                    </div>
                    <div className="b-name">{c.name}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="dash-section">
            <h2 className="dash-h">PROJECTS ({projects.length})</h2>
            {projects.length === 0 ? (
              <EmptyNote>NO PROJECTS YET.</EmptyNote>
            ) : (
              <div className="ship-grid">
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
