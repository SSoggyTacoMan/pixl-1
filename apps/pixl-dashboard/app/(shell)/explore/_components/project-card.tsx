// One project as the pixel-art trading card from the old explore page.
// The title links to the project page (full view for your own projects,
// read-only public view for everyone else's).
//
// Layout: the card is a 196x244 design scaled to its width. --u is one design
// pixel (100cqw / 196); every direct child is absolutely placed from its own
// --x/--y/--w/--h in design pixels.
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { cn } from "@/lib/cn";
import { hours, statusInfo, timeAgo } from "../lib";
import type { ExploreProject, Owner } from "../types";
import { Avatar } from "./avatar";
import { voteBase, voteIcon } from "./card-styles";
import { UpvoteButton } from "./upvote-button";

const icon = (name: string) => `/img/pixl-ui/icon_${name}.png`;

const pixelated = "[image-rendering:pixelated]";

// Shared by the status bar and the stat pills.
const strip = cn(
  "flex items-center gap-[calc(3*var(--u))] px-[calc(4*var(--u))] pt-0 pb-[calc(2*var(--u))]",
  "text-[length:calc(9*var(--u))] tracking-[.04em] text-white [text-shadow:var(--u)_var(--u)_0_rgba(22,22,30,.45)]",
);

const STATUS_TONE: Record<string, string> = {
  review: "bg-[#52aeb9] [box-shadow:inset_0_calc(-2*var(--u))_#3b8a94]",
  shipped: "bg-[#3faa5f] [box-shadow:inset_0_calc(-2*var(--u))_#2f8248]",
  changes: "bg-[#d9822b] [box-shadow:inset_0_calc(-2*var(--u))_#b0661d]",
  draft: "bg-[#9a9aa2] [box-shadow:inset_0_calc(-2*var(--u))_#7a7a82]",
};

// Night-sky grid with three sparkles behind the project photo.
const PHOTO_BG =
  "[background:url(/img/pixl-ui/pixel_sparkle.png)_calc(152*var(--u))_calc(6*var(--u))_/_calc(8*var(--u))_no-repeat,url(/img/pixl-ui/pixel_sparkle_dim.png)_calc(4*var(--u))_calc(20*var(--u))_/_calc(8*var(--u))_no-repeat,url(/img/pixl-ui/pixel_sparkle_dim.png)_calc(124*var(--u))_calc(10*var(--u))_/_calc(8*var(--u))_no-repeat,repeating-linear-gradient(90deg,#24324f_0_var(--u),transparent_0_calc(12*var(--u))),repeating-linear-gradient(0deg,#24324f_0_var(--u),transparent_0_calc(12*var(--u))),#1b2640]";

function Pill({ place, iconName, text, title }: { place: string; iconName: string; text: string; title?: string }) {
  return (
    <div
      className={cn(
        strip,
        "gap-[calc(2*var(--u))] pr-[calc(2*var(--u))] pl-[calc(3*var(--u))] tracking-normal [--h:14] [--y:190]",
        place,
        !text && "bg-[#ece0bd] [box-shadow:inset_0_calc(-2*var(--u))_#dccb9c]",
      )}
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={icon(iconName)}
        alt=""
        className={cn("size-[calc(10*var(--u))] flex-none", pixelated, !text && "opacity-30")}
      />
      <span className="truncate">{text}</span>
    </div>
  );
}

export function ProjectCard({ p, owner, canVote = true }: { p: ExploreProject; owner?: Owner | null; canVote?: boolean }) {
  const who: Owner = owner ?? p.owner ?? { display_name: p.owner_name };
  const st = statusInfo(p.status);
  return (
    <article
      className={cn(
        "@container relative block aspect-[196/244] font-pixel font-bold text-[#16161e] [--u:calc(100cqw/196)]",
        "*:absolute *:m-0 *:box-border",
        "*:top-[calc(var(--y)*var(--u))] *:left-[calc(var(--x)*var(--u))]",
        "*:h-[calc(var(--h)*var(--u))] *:w-[calc(var(--w)*var(--u))]",
      )}
      aria-label={p.name}
    >
      <div className={cn("overflow-hidden [--h:100] [--w:172] [--x:10] [--y:10]", PHOTO_BG)}>
        <SafeImage player src={p.image_url} className="size-full object-cover" />
      </div>
      <div className="overflow-hidden [--h:18] [--w:18] [--x:18] [--y:136] [&_img]:[image-rendering:pixelated]">
        <Avatar
          name={who.display_name}
          url={who.avatar_url}
          className="size-full border-0 bg-[#ece0bd] text-[length:calc(10*var(--u))] text-[#16161e]"
        />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={cn("pointer-events-none [--h:244] [--w:196] [--x:0] [--y:0]", pixelated)}
        src="/img/pixl-ui/card_template.png"
        alt=""
      />
      <div className="truncate text-[length:calc(13*var(--u))] leading-[calc(18*var(--u))] [--h:18] [--w:150] [--x:12] [--y:114]">
        <Link href={`/projects/${Number(p.id)}`} className="text-inherit no-underline hover:text-inherit hover:underline">
          {p.name}
        </Link>
      </div>
      {p.is_peak ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={cn("[--h:16] [--w:16] [--x:165] [--y:115]", pixelated)} src={icon("star")} alt="Beacon" />
      ) : null}
      <div
        className={cn(
          "truncate text-[length:calc(9*var(--u))] leading-[calc(14*var(--u))] text-[#6f6f78]",
          "[--h:14] [--w:86] [--x:44] [--y:138]",
        )}
      >
        by <b className="text-[#16161e]">{p.owner_name || who.display_name || "?"}</b>
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-[calc(2*var(--u))] text-[length:calc(8*var(--u))] text-[#6f6f78]",
          "[--h:14] [--w:52] [--x:130] [--y:138]",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon("calendar")} alt="" className={cn("size-[calc(10*var(--u))] flex-none opacity-70", pixelated)} />
        <span className="truncate">{timeAgo(p.created_at)}</span>
      </div>
      <div className={cn(strip, "uppercase [--h:14] [--w:168] [--x:12] [--y:166]", STATUS_TONE[st.tone])}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon(st.icon)} alt="" className={cn("size-[calc(12*var(--u))] flex-none", pixelated)} />
        <span className="truncate">{st.label}</span>
      </div>
      <Pill place="[--w:48] [--x:12]" iconName="level" text={p.level != null ? `LV ${p.level}` : ""} />
      <Pill
        place="[--w:60] [--x:68]"
        iconName="beacon"
        text={p.is_peak ? "BEACON" : ""}
        title={p.is_peak ? "Nominated as a standout project by a reviewer" : undefined}
      />
      <Pill place="[--w:44] [--x:136]" iconName="clock" text={hours(p.hackatime_seconds)} />
      {canVote ? (
        <UpvoteButton projectId={Number(p.id)} count={Number(p.upvotes ?? 0)} voted={!!p.has_upvoted} />
      ) : p.upvotes == null ? null : (
        <span className={cn(voteBase, "cursor-default")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon("upvote")} alt="" className={voteIcon} />
          <span>{Number(p.upvotes ?? 0)}</span>
        </span>
      )}
    </article>
  );
}
