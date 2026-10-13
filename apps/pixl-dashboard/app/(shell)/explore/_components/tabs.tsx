import Link from "next/link";
import { cn } from "@/lib/cn";

// A row of pill tabs (also the leaderboard's sub-tabs, with `small`).
export const tabRow = "mb-[18px] flex flex-wrap gap-1.5";
export function tabClass(active: boolean, small = false): string {
  return cn(
    "inline-block border-2 border-stroke bg-panel px-[18px] pt-2.5 pb-2 text-[15px] tracking-[1px] text-dim no-underline",
    "transition-[border-color,color,background-color] duration-150 hover:border-gold hover:text-gold",
    small && "px-3.5 pt-2 pb-1.5 text-[13px]",
    active && "border-gold bg-gold text-btn-ink hover:text-btn-ink",
  );
}

const TABS = [
  { key: "projects", label: "PROJECTS", href: "/explore" },
  { key: "players", label: "PLAYERS", href: "/explore/players" },
  { key: "leaderboard", label: "LEADERBOARD", href: "/explore/leaderboard" },
] as const;

export type ExploreTab = (typeof TABS)[number]["key"];

export function ExploreTabs({ active }: { active: ExploreTab }) {
  return (
    <nav className={tabRow} aria-label="Explore">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={tabClass(t.key === active)}
          aria-current={t.key === active ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
