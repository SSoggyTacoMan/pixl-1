"use client";

import { useState } from "react";
import { connectHackatime } from "@/lib/actions/flows";
import { goTo, useAction } from "@/components/use-action";
import { Button, buttonVariants, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { DEFAULT_CUTOFF_MS, hours, shortDate } from "../format";
import type { HtStats } from "../types";
import { hint } from "./styles";

const htBar = cn(panel, "mb-[14px] flex flex-wrap items-center gap-[10px] px-[14px] py-[10px] font-pixel text-[13px] tracking-[1px]");
const htDot = "inline-block size-[10px] border border-stroke";

/** Connect / reconnect Hackatime through the server's flow (Bearer POST -> url). */
export function ConnectHackatimeButton({
  returnTo,
  label = "CONNECT",
  className = buttonVariants(),
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
      {error ? <span className={hint("bad")}>{error}</span> : null}
    </span>
  );
}

export function HackatimeStrip({ stats }: { stats: HtStats | null }) {
  const [open, setOpen] = useState(false);
  if (!stats) return null;
  if (!stats.connected) {
    return (
      <div className={htBar}>
        <span className={cn(htDot, "bg-bad")} />
        <span>
          HACKATIME NOT CONNECTED, hours can&apos;t be counted until you link it.
          {stats.error ? <span className="text-faint"> ({stats.error})</span> : null}
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
      <div className={htBar}>
        <span className={cn(htDot, "bg-good")} />
        <span>HACKATIME CONNECTED</span>
        <span className="text-teal">
          {hours(since)} since {shortDate(DEFAULT_CUTOFF_MS)}
        </span>
        <span className="text-muted">{stats.projects.length} tracked</span>
        <Button variant="ghost" className="ml-auto" onClick={() => setOpen((v) => !v)}>
          TIME PER PROJECT {open ? "▴" : "▾"}
        </Button>
        <ConnectHackatimeButton returnTo="/projects" label="RECONNECT" className={buttonVariants({ variant: "ghost" })} />
      </div>
      {open ? (
        <div className="mb-[14px] grid gap-[8px]">
          {sorted.map((p) => (
            <div className={cn(panel, "px-[12px] py-[8px] text-[13px]")} key={p.name}>
              <div className="flex justify-between">
                <span>{p.name}</span>
                <span className="text-teal">{hours(p.seconds)}</span>
              </div>
              <div className="mt-[6px] h-[8px] border border-stroke bg-panel-2">
                <div className="h-full bg-teal" style={{ width: `${top ? (p.seconds / top) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
