"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@hackclub/icons";
import type { NavModel } from "./nav";

interface PlayerHit {
  id: string;
  label: string;
  sub: string;
}
interface ProjectHit {
  id: number;
  label: string;
}
interface Hit {
  href: string;
  label: string;
  sub?: string;
  group: string;
}

// Ctrl/Cmd+K: jump to a page, player or project.
export default function CommandPalette({ nav }: { nav: NavModel }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState<PlayerHit[]>([]);
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [cursor, setCursor] = useState(0);

  function open() {
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
    setQ("");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) close();
        else open();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    setCursor(0);
    if (term.length < 2) {
      setPlayers([]);
      setProjects([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const d = (await res.json()) as { players?: PlayerHit[]; projects?: ProjectHit[] };
        setPlayers(d.players ?? []);
        setProjects(d.projects ?? []);
      } catch {
        // aborted by the next keystroke
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const ql = q.trim().toLowerCase();
  const pages: Hit[] = [
    ...nav.primary.map((item) => ({ ...item, group: "Pages" })),
    ...nav.groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))),
  ]
    .filter((item) => !ql || item.label.toLowerCase().includes(ql))
    .map(({ href, label, group }) => ({ href, label, group }));
  const hits: Hit[] = [
    ...pages,
    ...players.map((p) => ({ href: `/players/${p.id}`, label: p.label, sub: p.sub, group: "Players" })),
    ...projects.map((p) => ({ href: `/projects/${p.id}`, label: p.label, group: "Projects" })),
  ];

  function go(href: string) {
    close();
    router.push(href);
  }

  return (
    <>
      <button type="button" className="hc-btn hc-btn-outline hc-btn-sm" onClick={open}>
        <Icon glyph="search" size={18} aria-hidden />
        Search
        <span className="hc-kbd">Ctrl K</span>
      </button>

      <dialog
        ref={dialog}
        className="hc-dialog m-auto mt-[12vh]"
        onClose={() => setQ("")}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="relative border-b border-[var(--border)] p-3">
          <Icon
            glyph="search"
            size={20}
            className="hc-muted pointer-events-none absolute top-1/2 left-5 -translate-y-1/2"
            aria-hidden
          />
          <input
            autoFocus
            className="hc-input hc-input-search"
            placeholder="Search pages, players, projects..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && hits[cursor]) {
                e.preventDefault();
                go(hits[cursor].href);
              }
            }}
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1">
          {hits.length === 0 && <li className="hc-caption p-4 text-center text-sm">No results.</li>}
          {hits.map((hit, i) => (
            <li key={`${hit.group}:${hit.href}`}>
              {(i === 0 || hits[i - 1].group !== hit.group) && (
                <p className="hc-eyebrow px-2 pt-3 pb-1">{hit.group}</p>
              )}
              <button
                type="button"
                className="hc-select-option"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(hit.href)}
              >
                <span className="truncate">{hit.label}</span>
                {hit.sub && <span className="hc-muted truncate text-xs">{hit.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
