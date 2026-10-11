// Plain idea card and the "collab wanted" poster card. Player text is
// rendered as React text or through the safe Markdown component only.
import { Markdown } from "@/components/markdown";
import { SafeImage } from "@/components/safe-image";
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
    <div className="panel idea-card">
      <div className="idea-meta">
        <span>
          <span className="text-gold">{idea.author_name}</span>
          {idea.is_mine ? <span className="own-badge"> · YOU</span> : null}
        </span>
        <span>{timeAgo(idea.created_at)}</span>
      </div>
      <div className="idea-title">{idea.title}</div>
      {idea.body ? <Markdown source={idea.body} className="idea-body" /> : null}
      <div className="idea-foot">
        <VoteGroup idea={idea} />
        {idea.is_mine ? <DeleteIdeaButton id={Number(idea.id)} /> : null}
      </div>
    </div>
  );
}

function PosterThumb({ idea, roles }: { idea: Idea; roles: string[] }) {
  const none = <span className="poster-thumb-none">NO IMAGE</span>;
  const rolesThumb = roles.length ? (
    <div className="poster-thumb-roles">
      {roles.slice(0, 3).map((r) => (
        <span key={r} className="poster-thumb-role" style={roleStyle(r)}>
          <RoleIcon role={r} />
        </span>
      ))}
    </div>
  ) : (
    none
  );
  return <SafeImage src={idea.image_url} fallback={rolesThumb} />;
}

export function PosterCard({ idea }: { idea: Idea }) {
  const roles = Array.isArray(idea.roles_needed) ? idea.roles_needed.filter((r) => typeof r === "string") : [];
  const roleWords = roles.map(roleLabel).join(", ");
  const hours = idea.hours_estimate ? `~${Math.round(idea.hours_estimate)}H OF WORK NEEDED` : "";

  return (
    <div className="poster-layout">
      <div className="poster-card">
        <div className="poster-thumb">
          <PosterThumb idea={idea} roles={roles} />
        </div>
        {roleWords ? <div className="poster-seeking">{roleWords}</div> : null}
        {hours ? <div className="poster-hours">{hours}</div> : null}
      </div>
      <div className="panel poster-desc">
        <div className="poster-desc-eyebrow">COLLAB WANTED</div>
        <div className="poster-desc-title">{idea.title}</div>
        <div className="poster-desc-meta">
          posted by <span className="text-gold">{idea.author_name}</span>
          {idea.is_mine ? <span className="own-badge"> · YOU</span> : null} · {timeAgo(idea.created_at)}
        </div>
        {idea.body ? <Markdown source={idea.body} className="poster-desc-body" /> : null}
        {roles.length ? (
          <>
            <div className="poster-desc-roles-h">ROLES NEEDED</div>
            <div className="poster-desc-roles">
              {roles.map((r) => (
                <span key={r} className="poster-desc-role" style={roleStyle(r)}>
                  <RoleIcon role={r} />
                  {roleLabel(r)}
                </span>
              ))}
            </div>
          </>
        ) : null}
        {idea.is_mine ? (
          <DeleteIdeaButton id={Number(idea.id)} className="btn dark poster-desc-apply" />
        ) : (
          <ApplyButton id={Number(idea.id)} />
        )}
      </div>
    </div>
  );
}
