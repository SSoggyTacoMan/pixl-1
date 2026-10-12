// Shared shapes and copy for /ideas. Mirrors apps/server/src/routes/ideas.ts.

export interface Idea {
  id: number | string;
  title: string;
  body?: string | null;
  author_name: string;
  is_mine: boolean;
  created_at: string;
  upvotes: number;
  downvotes: number;
  has_upvoted: boolean;
  has_downvoted: boolean;
  is_collab?: boolean;
  roles_needed?: string[] | null;
  hours_estimate?: number | null;
  image_url?: string | null;
}

export type IdeaSort = "new" | "top";

export const ROLES = ["art", "audio", "code", "design", "writing"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_META: Record<Role, { color: string; label: string }> = {
  art: { color: "#e8a33d", label: "ART" },
  audio: { color: "#8a6fd8", label: "AUDIO" },
  code: { color: "#52aeb9", label: "CODE" },
  design: { color: "#5fa8e0", label: "DESIGN" },
  writing: { color: "#c96a8f", label: "WRITING" },
};

export function isRole(r: unknown): r is Role {
  return typeof r === "string" && (ROLES as readonly string[]).includes(r);
}

export function roleLabel(r: string): string {
  return isRole(r) ? ROLE_META[r].label : r.toUpperCase();
}

export function roleColor(r: string): string {
  return isRole(r) ? ROLE_META[r].color : "#999";
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s)) return "";
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

export function postError(code: string): string {
  if (code === "blocked_content") return "That idea contains blocked content.";
  if (code === "title_too_short") return "Give it a title (3+ characters).";
  if (code === "invalid_image_url") return "Images must be uploaded through Pixl (re-upload this image).";
  return "Couldn't post that idea.";
}

export function voteError(code: string, dir: "up" | "down"): string {
  if (code === "own_idea") return "You can't vote on your own idea.";
  if (code === "already_upvoted" || code === "already_downvoted") return "You've already voted on this idea.";
  return `Couldn't ${dir}vote right now.`;
}

export function applyError(code: string): string {
  if (code === "own_idea") return "You can't apply to your own idea.";
  if (code === "not_collab") return "This idea isn't looking for collaborators.";
  return "Couldn't apply right now.";
}
