"use client";

// "Shipped something elsewhere?" - import a project from another YSWS or
// from Macondo as a draft.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/cn";
import { importMacondo, importYsws } from "../collab-actions";
import { projectError } from "../errors";
import { hint, inviteBox, inviteBoxSub, inviteBoxTitle } from "./styles";

const importPick =
  "flex w-full flex-col gap-[2px] border-2 border-stroke bg-panel px-[10px] py-[8px] text-left text-ink disabled:opacity-50";

export interface YswsShip {
  id: string;
  name: string;
  ysws?: string;
  hours?: number;
  approvedAt?: number;
  description?: string;
}
export interface MacondoProject {
  ref: string;
  name: string;
  hasShipped?: boolean;
  description?: string;
}

export function ImportBox({ ships, macondo }: { ships: YswsShip[]; macondo: MacondoProject[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ysws = useAction(importYsws);
  const mac = useAction(importMacondo);
  const count = ships.length + macondo.length;
  if (!count) return null;
  const busy = ysws.pending || mac.pending;

  async function done(r: Awaited<ReturnType<typeof importYsws>>) {
    if (r.ok && Number.isSafeInteger(r.data.id) && r.data.id > 0) {
      setOpen(false);
      router.push(`/projects/${r.data.id}`);
    } else setError(r.ok ? "Couldn't import that, try again." : projectError(r.error));
  }

  return (
    <>
      <div className={inviteBox}>
        <div>
          <span className={inviteBoxTitle}>SHIPPED SOMETHING ELSEWHERE?</span>
          <span className={inviteBoxSub}>
            {count} project{count === 1 ? "" : "s"} available to import, keep building it here.
          </span>
        </div>
        <Button onClick={() => setOpen(true)}>IMPORT</Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="IMPORT A PROJECT"
        description="Pick a project to bring in as a draft. Its links, description, thumbnail and available journal history get filled in for you. Historical hours don't carry over: only new time you track from here counts."
      >
        {error ? <p className={cn(hint("bad"), "mb-2")}>{error}</p> : null}
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {ships.map((s) => (
            <button
              key={`y${s.id}`}
              type="button"
              className={importPick}
              disabled={busy}
              onClick={async () => done(await ysws.run({ entryId: String(s.id) }))}
            >
              <b>{s.name}</b>
              <span className="text-xs text-dim">
                {[s.ysws, s.hours ? `${s.hours}h there` : "", s.approvedAt ? new Date(s.approvedAt * 1000).toISOString().slice(0, 10) : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {s.description ? <span className="text-xs text-faint">{s.description.slice(0, 140)}</span> : null}
            </button>
          ))}
          {macondo.map((p) => (
            <button
              key={`m${p.ref}`}
              type="button"
              className={importPick}
              disabled={busy}
              onClick={async () => done(await mac.run({ ref: p.ref }))}
            >
              <b>{p.name}</b>
              <span className="text-xs text-dim">MACONDO{p.hasShipped ? " · SHIPPED" : ""}</span>
              {p.description ? <span className="text-xs text-faint">{p.description.slice(0, 140)}</span> : null}
            </button>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="dark" onClick={() => setOpen(false)}>
            CANCEL
          </Button>
        </div>
      </Dialog>
    </>
  );
}
