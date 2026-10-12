import Link from "next/link";

const TABS = [
  { key: "projects", label: "PROJECTS", href: "/explore" },
  { key: "players", label: "PLAYERS", href: "/explore/players" },
  { key: "leaderboard", label: "LEADERBOARD", href: "/explore/leaderboard" },
] as const;

export type ExploreTab = (typeof TABS)[number]["key"];

export function ExploreTabs({ active }: { active: ExploreTab }) {
  return (
    <nav className="ex-tabs" aria-label="Explore">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`ex-tab${t.key === active ? " active" : ""}`}
          aria-current={t.key === active ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
