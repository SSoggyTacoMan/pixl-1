"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { searchPlayers, type PlayerHit } from "@/app/actions";
import { Field, Input } from "@/app/_ui/ui";

// Two people with the same legal name are told apart by their Slack handle.
export function playerHitLabel(hit: PlayerHit): string {
  const handle = hit.slackName ? `@${hit.slackName}` : "";
  if (!handle) return hit.slackDisplayName ?? "";
  if (!hit.slackDisplayName || hit.slackDisplayName === hit.slackName) return handle;
  return `${handle} · ${hit.slackDisplayName}`;
}

// Typeahead that searches legal name, in-game name and Slack name/handle, and
// submits the chosen user's id under `name` (only once a hit is picked).
export function PlayerPicker({
  name = "userId",
  label = "Player",
  hint,
  placeholder = "Search name or @slack",
  excludeId,
  onSelect,
}: {
  name?: string;
  label?: ReactNode;
  hint?: ReactNode;
  placeholder?: string;
  excludeId?: string | null;
  onSelect?: (hit: PlayerHit | null) => void;
}) {
  const [player, setPlayer] = useState("");
  const [selected, setSelected] = useState<PlayerHit | null>(null);
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && player === selected.name) {
      setOpen(false);
      return;
    }
    const q = player.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setOpen(true);
    const t = setTimeout(async () => {
      try {
        setHits(await searchPlayers(q));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [player, selected]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const visible = excludeId ? hits.filter((h) => h.id !== excludeId) : hits;

  return (
    <Field
      label={label}
      hint={
        selected && (selected.slackName || selected.slackDisplayName)
          ? `Selected ${selected.name} · ${playerHitLabel(selected)}`
          : (hint ?? "Searches legal name, in-game display name and Slack name or handle.")
      }
    >
      <div ref={boxRef} className="relative">
        {selected && <input type="hidden" name={name} value={selected.id} />}
        <Input
          autoComplete="off"
          value={player}
          onChange={(e) => {
            setPlayer(e.target.value);
            setSelected(null);
            onSelect?.(null);
          }}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={placeholder}
          required
          className="w-full"
        />
        {open && (
          <ul className="hc-select-menu">
            {searching && visible.length === 0 && <li className="hc-select-option hc-muted">Searching...</li>}
            {visible.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="hc-select-option flex items-center gap-2"
                  onClick={() => {
                    setSelected(h);
                    setPlayer(h.name);
                    setOpen(false);
                    onSelect?.(h);
                  }}
                >
                  <span className="min-w-0 truncate">{h.name}</span>
                  {(h.slackName || h.slackDisplayName) && (
                    <span className="hc-muted ml-auto min-w-0 truncate text-xs">{playerHitLabel(h)}</span>
                  )}
                </button>
              </li>
            ))}
            {!searching && visible.length === 0 && (
              <li className="hc-select-option hc-muted">No players found.</li>
            )}
          </ul>
        )}
      </div>
    </Field>
  );
}
