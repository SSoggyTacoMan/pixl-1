// One project as the pixel-art trading card from the old explore page.
// The title links to the project page (full view for your own projects,
// read-only public view for everyone else's).
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { hours, statusInfo, timeAgo } from "../lib";
import type { ExploreProject, Owner } from "../types";
import { Avatar } from "./avatar";
import { UpvoteButton } from "./upvote-button";

const icon = (name: string) => `/img/pixl-ui/icon_${name}.png`;

function Pill({ cls, iconName, text, title }: { cls: string; iconName: string; text: string; title?: string }) {
  return (
    <div className={`pc-pill ${cls}${text ? "" : " off"}`} title={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon(iconName)} alt="" />
      <span>{text}</span>
    </div>
  );
}

export function ProjectCard({ p, owner, canVote = true }: { p: ExploreProject; owner?: Owner | null; canVote?: boolean }) {
  const who: Owner = owner ?? p.owner ?? { display_name: p.owner_name };
  const st = statusInfo(p.status);
  return (
    <article className="proj-card" aria-label={p.name}>
      <div className="pc-photo">
        <SafeImage player src={p.image_url} />
      </div>
      <div className="pc-avatar">
        <Avatar name={who.display_name} url={who.avatar_url} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pc-frame" src="/img/pixl-ui/card_template.png" alt="" />
      <div className="pc-title">
        <Link href={`/projects/${Number(p.id)}`}>{p.name}</Link>
      </div>
      {p.is_peak ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pc-star" src={icon("star")} alt="Beacon" />
      ) : null}
      <div className="pc-by">
        by <b>{p.owner_name || who.display_name || "?"}</b>
      </div>
      <div className="pc-date">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon("calendar")} alt="" />
        <span>{timeAgo(p.created_at)}</span>
      </div>
      <div className={`pc-status pc-${st.tone}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon(st.icon)} alt="" />
        <span>{st.label}</span>
      </div>
      <Pill cls="pc-level" iconName="level" text={p.level != null ? `LV ${p.level}` : ""} />
      <Pill
        cls="pc-beacon"
        iconName="beacon"
        text={p.is_peak ? "BEACON" : ""}
        title={p.is_peak ? "Nominated as a standout project by a reviewer" : undefined}
      />
      <Pill cls="pc-hours" iconName="clock" text={hours(p.hackatime_seconds)} />
      {canVote ? (
        <UpvoteButton projectId={Number(p.id)} count={Number(p.upvotes ?? 0)} voted={!!p.has_upvoted} />
      ) : p.upvotes == null ? null : (
        <span className="pc-vote">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon("upvote")} alt="" />
          <span>{Number(p.upvotes ?? 0)}</span>
        </span>
      )}
    </article>
  );
}
