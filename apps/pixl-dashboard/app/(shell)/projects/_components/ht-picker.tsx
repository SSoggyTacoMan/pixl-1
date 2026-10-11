"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { hours, htTotals } from "../format";
import type { HtStats } from "../types";
import { ConnectHackatimeButton } from "./hackatime-strip";

/** Hackatime project checkboxes (proof of hours) for the editor. */
export function HtPicker({
  stats,
  value,
  onChange,
  disabled,
  returnTo,
}: {
  stats: HtStats | null;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const picked = new Set(value);
  const { counted, total } = htTotals(stats, value);

  if (!stats || !stats.connected) {
    return (
      <div id="ht-connect" className="flex flex-wrap items-center gap-3">
        <span className="faint text-sm">Hackatime isn&apos;t connected, connect it so your hours can count.</span>
        <ConnectHackatimeButton returnTo={returnTo} className="btn dark" />
      </div>
    );
  }

  // Keep linked names that Hackatime no longer reports so a save doesn't drop them.
  const names = new Set(stats.projects.map((h) => h.name));
  const rows = [
    ...[...stats.projects].sort((a, b) => b.seconds - a.seconds),
    ...value.filter((n) => !names.has(n)).map((name) => ({ name, seconds: 0, secondsSinceCutoff: 0 })),
  ];

  function toggle(name: string, on: boolean) {
    onChange(on ? [...value, name] : value.filter((n) => n !== name));
  }

  return (
    <div id="ht-connect">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="teal">
          {value.length ? `${hours(counted)} counted${total !== counted ? ` (${hours(total)} total)` : ""}` : "none ticked"}
        </span>
        <button
          type="button"
          className="btn ghost !px-2 !py-0.5 !text-xs"
          disabled={refreshing}
          title="Just tracked new time? Re-check Hackatime without reloading."
          onClick={() => startRefresh(() => router.refresh())}
        >
          {refreshing ? "CHECKING..." : "REFRESH"}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="faint text-sm">No Hackatime projects yet. Code a little with Hackatime running, then refresh.</p>
      ) : (
        <div className="ht-pick">
          {rows.map((h) => (
            <label key={h.name}>
              <input
                type="checkbox"
                checked={picked.has(h.name)}
                disabled={disabled}
                onChange={(e) => toggle(h.name, e.target.checked)}
              />
              <span>{h.name}</span>
              <span className="h">{hours(h.secondsSinceCutoff ?? h.seconds)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
