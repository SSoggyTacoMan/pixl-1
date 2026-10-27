"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/docs";
import { cn } from "@/lib/cn";
import { buttonVariants, railButton } from "@/components/ui/primitives";

const OPEN_KEY = "pixl-docs-open-groups";
const DARK_PALETTES = [
  { id: "cabinet", label: "Cabinet", swatches: ["#121a23", "#68c7cb", "#ffad68"] },
  { id: "graphite", label: "Graphite Arcade", swatches: ["#151715", "#fc7059", "#f4a45f"] },
];

// Same two states as the shell sidebar: ink block on hover, red block when
// current. 15px, not 16: Poppins runs wider than Pixelify at the same size,
// and 16 put the longer titles back to wrapping inside the 300px sidebar.
const sectionLink = cn(
  "block border-2 border-transparent py-[7px] pr-[12px] pl-[20px] font-sans text-[15px] font-medium leading-[1.4] text-ink no-underline",
  "[transition:color_.13s_ease,background-color_.13s_ease,border-color_.13s_ease,transform_.12s_ease]",
  "hover:border-stroke hover:bg-ink hover:text-panel-deep",
);
const sectionLinkActive = "border-stroke bg-accent font-semibold text-panel-deep hover:bg-accent";

const themeOption = cn(
  "flex w-full items-center gap-[9px] border-none bg-transparent px-[11px] py-[8px] text-left",
  "font-pixel text-[13.5px] tracking-[.3px] text-ink transition-[background-color,color] duration-[120ms] ease-[ease]",
  "hover:bg-accent hover:text-panel-deep",
);

function groupNav(nav: NavItem[]): { label: string; items: NavItem[] }[] {
  const groups: { label: string; items: NavItem[] }[] = [];
  for (const item of nav) {
    const last = groups[groups.length - 1];
    if (last && last.label === item.group) last.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }
  return groups;
}

export function DocsShell({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  // The shell outlives any single doc now (see layout.tsx), so the active
  // page can't come in as a prop - it changes underneath a mounted shell.
  const activeSlug = usePathname().replace(/^\/docs\/?/, "").replace(/\/$/, "");
  const groups = groupNav(nav);
  const activeGroup = groups.find((g) => g.items.some((i) => i.slug === activeSlug))?.label;

  // Only groups opened by hand live in this state - the active group is
  // never written in here (see isGroupOpen below). Starts empty (not from
  // localStorage) because localStorage isn't available during SSR and
  // reading it in the initializer would desync the server-rendered HTML
  // from the first client render; the effect below hydrates it right after
  // mount instead.
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [backHref, setBackHref] = useState("/dashboard");
  const [theme, setThemeState] = useState("light");
  const [darkPalette, setDarkPaletteState] = useState("graphite");
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Whether a group renders expanded: manually opened (persisted in `open`)
  // OR it's the group holding the page you're currently on. The active-group
  // half is a plain derivation, not state written by an effect - on the old
  // static site (no client router) this only had to work once per full page
  // load; a client router (and layouts that don't remount between sibling
  // routes) makes an effect based version prone to a visible flash where the
  // page's own group renders collapsed for a frame after navigating before
  // an effect catches up and reopens it. Deriving it at render time instead
  // means the current page's group is correct on the very first paint,
  // every time, full reload or client-side navigation alike.
  function isGroupOpen(label: string): boolean {
    return open.has(label) || label === activeGroup;
  }

  // Manually-opened groups persist across a fresh page load via localStorage
  // - hydrated once after mount (see the empty state above for why not in
  // the initializer).
  useEffect(() => {
    try {
      setOpen(new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || "[]")));
    } catch {
      // malformed storage - leave `open` empty, isGroupOpen still covers
      // the active group correctly
    }
  }, []);

  useEffect(() => {
    try {
      const ref = document.referrer;
      if (ref && new URL(ref).origin === location.origin && !/\/docs(\/|$)/.test(new URL(ref).pathname)) {
        setBackHref(ref);
      }
    } catch {
      // keep the /dashboard default
    }
  }, []);

  useEffect(() => {
    try {
      setThemeState(localStorage.getItem("pixl_theme_v2") === "dark" ? "dark" : "light");
      const savedPalette = localStorage.getItem("pixl_dark_palette_v1");
      const matchingPalette = DARK_PALETTES.find((palette) => palette.id === savedPalette);
      if (matchingPalette) setDarkPaletteState(matchingPalette.id);
    } catch {
      // keep the light default
    }
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (theme === "dark") root.dataset.palette = darkPalette;
    else delete root.dataset.palette;
  }, [theme, darkPalette, themeLoaded]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-theme-picker]")) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function toggleGroup(label: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...next]));
      } catch {
        // best-effort persistence only
      }
      return next;
    });
  }

  function setTheme(id: string) {
    try {
      if (id === "light") {
        setThemeState("light");
        localStorage.setItem("pixl_theme_v2", "light");
      } else if (DARK_PALETTES.some((palette) => palette.id === id)) {
        setThemeState("dark");
        setDarkPaletteState(id);
        localStorage.setItem("pixl_theme_v2", "dark");
        localStorage.setItem("pixl_dark_palette_v1", id);
      }
    } catch {
      // best-effort persistence only
    }
    setMenuOpen(false);
  }

  const selectedTheme = theme === "light" ? "light" : darkPalette;

  return (
    // Nav | article | on-this-page. --sidebar is wider than the dash's own:
    // these are page titles, not icon-sized nav labels, and at 260px the
    // longer ones wrapped onto two lines. The body:has() variant swaps the
    // global overflow-y: scroll for auto on the docs only.
    <div
      className={cn(
        "grid min-h-screen grid-cols-[var(--sidebar)_minmax(0,1fr)_240px] items-start [--sidebar:300px]",
        "max-[1080px]:grid-cols-[var(--sidebar)_minmax(0,1fr)] max-[820px]:grid-cols-1",
        "[body:has(&)]:overflow-y-auto!",
      )}
    >
      <aside
        className={cn(
          "sticky top-0 h-screen overflow-y-auto border-r-4 border-stroke bg-panel px-[12px] pt-[22px] pb-[32px]",
          "max-[820px]:static max-[820px]:h-auto max-[820px]:border-r-0 max-[820px]:border-b-4",
        )}
      >
        <div className="flex items-center justify-between gap-[8px] pt-[2px] pr-[6px] pb-[18px] pl-[8px]">
          <Link
            className="flex items-center gap-[9px] font-pixel text-[19px] font-bold tracking-[.3px] text-ink no-underline hover:text-gold-soft"
            href="/"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/docs/icon.svg" alt="" className="size-[26px] [image-rendering:pixelated]" />
            PIXL <span className="text-gold">DOCS</span>
          </Link>
          <div className="relative" data-theme-picker>
            <button
              className={railButton}
              type="button"
              aria-label="Change theme"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <rect x="4" y="2" width="8" height="2" />
                <rect x="2" y="4" width="2" height="7" />
                <rect x="12" y="4" width="2" height="6" />
                <rect x="4" y="11" width="7" height="2" />
                <rect x="10" y="10" width="2" height="2" />
                <rect x="5" y="5" width="2" height="2" />
                <rect x="9" y="5" width="2" height="2" />
                <rect x="5" y="8" width="2" height="2" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute top-[calc(100%+6px)] right-0 z-60 flex min-w-[200px] flex-col overflow-hidden border-2 border-stroke bg-panel shadow-drop">
                <button
                  className={cn(themeOption, "whitespace-nowrap", selectedTheme === "light" && "bg-theme-selected text-theme-selected-ink hover:bg-theme-selected")}
                  type="button"
                  aria-pressed={selectedTheme === "light"}
                  onClick={() => setTheme("light")}
                >
                  <span aria-hidden className="flex shrink-0 border border-stroke">
                    {["#f5eed2", "#ec3750", "#ff8c37"].map((color) => (
                      <span key={color} className="size-[11px] border-r border-stroke last:border-r-0" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span>Pixl Paper</span>
                </button>
                <div aria-hidden className="h-[2px] bg-stroke" />
                {DARK_PALETTES.map((t) => (
                  <button
                    key={t.id}
                    className={cn(themeOption, "whitespace-nowrap", selectedTheme === t.id && "bg-theme-selected text-theme-selected-ink hover:bg-theme-selected")}
                    type="button"
                    aria-pressed={selectedTheme === t.id}
                    onClick={() => setTheme(t.id)}
                  >
                    <span aria-hidden className="flex shrink-0 border border-stroke">
                      {t.swatches.map((color) => (
                        <span key={color} className="size-[11px] border-r border-stroke last:border-r-0" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          className={cn(buttonVariants({ variant: "dark" }), "mx-[6px] mb-[16px] justify-center")}
          type="button"
          onClick={() => (location.href = backHref)}
        >
          ◄ BACK
        </button>
        <nav>
          {groups.map((g) => {
            const groupOpen = isGroupOpen(g.label);
            return (
              <div key={g.label} className="mt-[4px]">
                <button
                  className={cn(
                    "flex w-full items-center gap-[8px] border-0 bg-transparent px-[10px] py-[9px] text-left",
                    "font-sans text-[13px] font-semibold uppercase tracking-[1.4px] text-muted",
                    "transition-[color,background-color] duration-[130ms] ease-[ease] hover:bg-panel-2 hover:text-ink",
                  )}
                  type="button"
                  onClick={() => toggleGroup(g.label)}
                >
                  <span className="flex-1">{g.label}</span>
                  <span className="text-[11px] font-semibold text-muted">{g.items.length}</span>
                  <span
                    className={cn(
                      "text-[10px] opacity-70 transition-transform duration-[180ms] ease-[ease]",
                      !groupOpen && "-rotate-90",
                    )}
                  >
                    ▼
                  </span>
                </button>
                {/* No trailing slash: this app runs with Next's default
                    trailingSlash: false, so /docs/<slug>/ answers an RSC
                    request with a bare 308 instead of a flight payload. The
                    client router reads that as "not a Next route" and falls
                    back to a full browser navigation - which is what made
                    every sidebar click reload the page. */}
                <div
                  className={cn(
                    "flex max-h-[600px] flex-col gap-[2px] overflow-hidden pb-[6px] opacity-100",
                    "[transition:max-height_.24s_ease,opacity_.2s_ease,padding-bottom_.24s_ease]",
                    !groupOpen && "max-h-0 pb-0 opacity-0",
                  )}
                >
                  {g.items.map((i) => (
                    <Link
                      key={i.slug}
                      className={cn(sectionLink, i.slug === activeSlug && sectionLinkActive)}
                      href={`/docs/${i.slug}`}
                    >
                      {i.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* The page renders both remaining grid columns (the article and the
          on-this-page rail) - neither Next's layout plumbing nor a fragment
          emits DOM, so they land as direct children of this grid. The rail
          has to come from the page because its headings are per-doc. */}
      {children}
    </div>
  );
}
