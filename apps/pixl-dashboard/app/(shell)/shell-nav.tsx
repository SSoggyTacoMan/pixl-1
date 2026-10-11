"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PixelIcon, ReIcon } from "@/components/pixel-icon";
import { ICONS, MOBILE_PRIMARY, MORE_ICON, NAV_GROUPS, PALETTE_ICON } from "./nav-data";

const THEMES = [
  { id: "light", label: "Pixl Paper", panel: "#f5eed2", gold: "#ec3750" },
  { id: "dark", label: "Pixl Ink", panel: "#171615", gold: "#ff6b4a" },
];

function useDismiss(open: boolean, selector: string, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest(selector)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, selector, close]);
}

export function ShellNav({
  game,
  displayName,
  pixels,
  re,
  communityRe,
}: {
  game: string;
  displayName: string;
  pixels: number;
  re: number;
  communityRe: number;
}) {
  const pathname = usePathname();
  // Leaderboard lives under /explore but has its own nav entry.
  const activeSlug = pathname.startsWith("/explore/leaderboard")
    ? "leaderboard"
    : (pathname.split("/").filter(Boolean)[0] ?? "");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setThemeState] = useState("light");
  const [phantom, setPhantomState] = useState(false);

  useEffect(() => {
    try {
      setThemeState(localStorage.getItem("pixl_theme_v2") || "light");
    } catch {
      // keep the light default
    }
    setPhantomState(document.documentElement.dataset.font === "phantom");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useDismiss(sheetOpen, ".sidebar", () => setSheetOpen(false));
  useDismiss(themeMenuOpen, ".theme-picker", () => setThemeMenuOpen(false));

  function togglePhantom() {
    const next = !phantom;
    setPhantomState(next);
    if (next) document.documentElement.dataset.font = "phantom";
    else delete document.documentElement.dataset.font;
    try {
      if (next) localStorage.setItem("pixl_font", "phantom");
      else localStorage.removeItem("pixl_font");
    } catch {
      // best-effort persistence only
    }
  }

  function setTheme(id: string) {
    setThemeState(id);
    try {
      localStorage.setItem("pixl_theme_v2", id);
    } catch {
      // best-effort persistence only
    }
    setThemeMenuOpen(false);
  }

  const overflow = NAV_GROUPS.flatMap((g) => g.items.filter((i) => !MOBILE_PRIMARY.includes(i.slug)));

  function navLink(slug: string, label: string, href: string, secondary: boolean) {
    return (
      <Link
        key={slug}
        href={href}
        className={`${slug === activeSlug ? "active" : ""}${secondary ? " secondary" : ""}`}
      >
        <PixelIcon rects={ICONS[slug] ?? []} />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <>
      <aside className="sidebar">
        <Link className="sb-logo" href="/dashboard" title="Pixl Dashboard">
          PIXL
        </Link>
        <nav className="nav">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((i) => navLink(i.slug, i.label, i.href, !MOBILE_PRIMARY.includes(i.slug)))}
            </div>
          ))}
          <button
            className={`nav-more${sheetOpen ? " open" : ""}`}
            type="button"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((v) => !v)}
          >
            <PixelIcon rects={MORE_ICON} />
            <span>MORE</span>
          </button>
          <div className="nav-sheet" hidden={!sheetOpen}>
            <div className="nav-sheet-grid">{overflow.map((i) => navLink(i.slug, i.label, i.href, false))}</div>
          </div>
        </nav>
        <div className="sb-foot">
          <a className="btn dark back-to-game" href={game} target="_blank" rel="noopener noreferrer">
            <span className="arrow">◄</span> PLAY THE GAME
          </a>
          <form action="/api/auth/logout" method="post">
            <button className="btn ghost w-full" type="submit" title={`Signed in as ${displayName}`}>
              LOG OUT
            </button>
          </form>
        </div>
      </aside>
      <div className="toprail">
        <div className="rest-chip" title="Core Integrity: total Restoration Energy earned by the whole community">
          <span className="slot">
            <ReIcon />
          </span>
          <span className="re">{communityRe.toLocaleString()}</span>
          <span className="rl">CORE</span>
        </div>
        <div className="re-chip" title="Your Restoration Energy">
          <span className="slot">
            <ReIcon />
          </span>
          <span className="val">{re.toLocaleString()}</span>
          <span className="rl">RE</span>
        </div>
        <div className="wallet-chip" title="Your pixels">
          <span className="slot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/pixel.png" alt="px" />
          </span>
          <span className="px">{pixels.toLocaleString()}</span>
        </div>
        <button
          className="rail-btn font-toggle"
          type="button"
          title="Switch to Phantom Sans"
          aria-label="Phantom Sans font"
          aria-pressed={phantom}
          onClick={togglePhantom}
        >
          PHANTOM SANS
        </button>
        <div className="theme-picker">
          <button
            className="theme-toggle"
            type="button"
            title="Change theme"
            aria-expanded={themeMenuOpen}
            onClick={() => setThemeMenuOpen((v) => !v)}
          >
            <PixelIcon rects={PALETTE_ICON} className="" />
          </button>
          <div className="theme-menu" hidden={!themeMenuOpen}>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-opt${t.id === theme ? " active" : ""}`}
                onClick={() => setTheme(t.id)}
              >
                <span className="swatch" style={{ background: t.panel, boxShadow: `inset 0 0 0 2px ${t.gold}` }} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
