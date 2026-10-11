"use client";

import { useState } from "react";
import { connectHackatime } from "@/lib/actions/flows";
import { goTo, useAction } from "@/components/use-action";
import { DEFAULT_CUTOFF_MS, hours, shortDate } from "../format";
import type { HtStats } from "../types";

/** Connect / reconnect Hackatime through the server's flow (Bearer POST -> url). */
export function ConnectHackatimeButton({
  returnTo,
  label = "CONNECT",
  className = "btn",
}: {
  returnTo: string;
  label?: string;
  className?: string;
}) {
  const { run, pending, error } = useAction(connectHackatime);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={async () => {
          const r = await run({ returnTo });
          if (r.ok && !goTo(r.data.url)) alert("Hackatime didn't return a valid link. Try again.");
        }}
      >
        {pending ? "OPENING..." : label}
      </button>
      {error ? <span className="hint bad">{error}</span> : null}
    </span>
  );
}

export function HackatimeStrip({ stats }: { stats: HtStats | null }) {
  const [open, setOpen] = useState(false);
  if (!stats) return null;
  if (!stats.connected) {
    return (
      <div className="ht-bar panel">
        <span className="ht-dot off" />
        <span>
          HACKATIME NOT CONNECTED, hours can&apos;t be counted until you link it.
          {stats.error ? <span className="faint"> ({stats.error})</span> : null}
        </span>
        <span className="ml-auto">
          <ConnectHackatimeButton returnTo="/projects" />
        </span>
      </div>
    );
  }
  const sorted = [...stats.projects].sort((a, b) => b.seconds - a.seconds);
  const top = sorted[0]?.seconds || 0;
  const since = stats.projects.reduce((s, h) => s + (h.secondsSinceCutoff ?? h.seconds), 0);
  return (
    <>
      <div className="ht-bar panel">
        <span className="ht-dot on" />
        <span>HACKATIME CONNECTED</span>
        <span className="teal">
          {hours(since)} since {shortDate(DEFAULT_CUTOFF_MS)}
        </span>
        <span className="muted">{stats.projects.length} tracked</span>
        <button type="button" className="btn ghost ml-auto" onClick={() => setOpen((v) => !v)}>
          TIME PER PROJECT {open ? "▴" : "▾"}
        </button>
        <ConnectHackatimeButton returnTo="/projects" label="RECONNECT" className="btn ghost" />
      </div>
      {open ? (
        <div className="ht-rows">
          {sorted.map((p) => (
            <div className="ht-row panel" key={p.name}>
              <div className="flex justify-between">
                <span>{p.name}</span>
                <span className="teal">{hours(p.seconds)}</span>
              </div>
              <div className="bar">
                <div style={{ width: `${top ? (p.seconds / top) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
