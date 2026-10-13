// Plain idea card and the "collab wanted" poster card. Player text is
// rendered as React text or through the safe Markdown component only.
import { Markdown } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
import { buttonVariants, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { ApplyButton, DeleteIdeaButton, VoteGroup } from "./idea-controls";
import { isRole, roleColor, roleLabel, timeAgo, type Idea } from "./ideas-lib";

function roleStyle(r: string): React.CSSProperties {
  return { "--role-color": roleColor(r) } as React.CSSProperties;
}

function RoleIcon({ role, className }: { role: string; className?: string }) {
  // Only known roles have an icon; anything else would be a broken path.
  if (!isRole(role)) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/img/icon-role-${role}.png`} alt="" className={className} />;
}

export function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <div className={cn(panel, "flex flex-col gap-2 px-[18px] py-4")}>
      <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-faint">
        <span>
          <span className="text-gold">{idea.author_name}</span>
          {idea.is_mine ? <span className="text-gold"> · YOU</span> : null}
        </span>
        <span>{timeAgo(idea.created_at)}</span>
      </div>
      <div className="text-lg text-ink wrap-anywhere">{idea.title}</div>
      {idea.body ? <Markdown source={idea.body} className="text-[15px] text-dim wrap-anywhere" /> : null}
      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
        <VoteGroup idea={idea} />
        {idea.is_mine ? <DeleteIdeaButton id={Number(idea.id)} /> : null}
      </div>
    </div>
  );
}

function PosterThumb({ idea, roles }: { idea: Idea; roles: string[] }) {
  const none = <span className="text-center font-pixel text-[11px] tracking-[1.5px] text-faint">NO IMAGE</span>;
  const rolesThumb = roles.length ? (
    <div className="flex gap-2.5">
      {roles.slice(0, 3).map((r) => (
        <span
          key={r}
          className="flex size-14 items-center justify-center border-2 border-stroke bg-(--role-color)"
          style={roleStyle(r)}
        >
          <RoleIcon role={r} className="size-9 [image-rendering:pixelated]" />
        </span>
      ))}
    </div>
  ) : (
    none
  );
  return <SafeImage player src={idea.image_url} fallback={rolesThumb} className="block size-full object-cover" />;
}

export function PosterCard({ idea }: { idea: Idea }) {
  const roles = Array.isArray(idea.roles_needed) ? idea.roles_needed.filter((r) => typeof r === "string") : [];
  const roleWords = roles.map(roleLabel).join(", ");
  const hours = idea.hours_estimate ? `~${Math.round(idea.hours_estimate)}H OF WORK NEEDED` : "";

  return (
    <div className="col-span-full grid grid-cols-[340px_1fr] items-start gap-7 max-[760px]:grid-cols-1">
      <div className="relative h-[438px] w-[340px] max-w-full bg-[url(/img/poster-wanted.png)] bg-[length:340px_438px] bg-no-repeat drop-shadow-[5px_5px_0_rgba(0,0,0,.18)]">
        <div className="absolute top-[172px] left-[65px] flex h-24 w-[210px] items-center justify-center overflow-hidden border-2 border-stroke bg-panel-2">
          <PosterThumb idea={idea} roles={roles} />
        </div>
        {roleWords ? <div className="absolute top-[280px] left-[26px] w-72 text-center font-sans text-[13px] font-bold tracking-[.3px] text-[#16161e]">{roleWords}</div> : null}
        {hours ? <div className="absolute top-[302px] left-[26px] w-72 text-center font-sans text-[11.5px] text-[#6f6f78]">{hours}</div> : null}
      </div>
      <div className={cn(panel, "flex flex-col gap-3.5 px-7 py-[26px]")}>
        <div className="font-pixel text-xs tracking-[1.5px] text-gold">COLLAB WANTED</div>
        <div className="text-2xl leading-[1.28] font-bold text-ink wrap-anywhere">{idea.title}</div>
        <div className="border-b border-stroke pb-3.5 text-[13px] text-faint">
          posted by <span className="text-gold">{idea.author_name}</span>
          {idea.is_mine ? <span className="text-gold"> · YOU</span> : null} · {timeAgo(idea.created_at)}
        </div>
        {idea.body ? <Markdown source={idea.body} className="max-w-[60ch] text-[15.5px] leading-[1.6] text-dim wrap-anywhere" /> : null}
        {roles.length ? (
          <>
            <div className="mt-1 font-pixel text-[11px] tracking-[1px] text-faint">ROLES NEEDED</div>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-[5px] border-2 border-stroke bg-(--role-color) py-1 pr-2.5 pl-[5px] font-sans text-[11.5px] font-bold text-btn-ink"
                  style={roleStyle(r)}
                >
                  <RoleIcon role={r} className="block size-[18px] [image-rendering:pixelated]" />
                  {roleLabel(r)}
                </span>
              ))}
            </div>
          </>
        ) : null}
        {idea.is_mine ? (
          <DeleteIdeaButton id={Number(idea.id)} className={cn(buttonVariants({ variant: "dark" }), "mt-1.5 self-start")} />
        ) : (
          <ApplyButton id={Number(idea.id)} />
        )}
      </div>
    </div>
  );
}
