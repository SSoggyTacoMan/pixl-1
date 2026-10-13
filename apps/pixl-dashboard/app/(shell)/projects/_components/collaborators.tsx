"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, Button, field, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import {
  generateJoinCode,
  inviteCollaborator,
  removeCollaborator,
  rotateJoinCode,
  saveCollabHackatime,
  searchPlayers,
} from "../collab-actions";
import type { Collaborator } from "../data";
import { projectError } from "../errors";
import { hours } from "../format";
import type { HtStats } from "../types";
import { ConnectHackatimeButton } from "./hackatime-strip";
import { checkRow, hint, htPick, htPickHours, htPickRow, smallButton } from "./styles";

function InviteSearch({ projectId, onDone }: { projectId: number; onDone: (msg: string, bad?: boolean) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ userId: string; name: string }[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setResults([]);
    const t = setTimeout(async () => {
      const r = await searchPlayers({ q: term });
      setResults(r.ok ? r.data : []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative mt-3 max-w-xs">
      <input className={field} placeholder="Invite by name..." value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      {results.length ? (
        <div className={cn(panel, "absolute left-0 top-11 z-10 w-full")}>
          {results.map((p) => (
            <button
              key={p.userId}
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-panel-2"
              onClick={async () => {
                setQ("");
                setResults([]);
                const r = await inviteCollaborator({ projectId, userId: p.userId });
                onDone(r.ok ? "Invite sent!" : projectError(r.error), !r.ok);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Collaborators({
  projectId,
  collaborators,
  isOwner,
  joinCode,
}: {
  projectId: number;
  collaborators: Collaborator[];
  isOwner: boolean;
  joinCode: string | null;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // apps/server only sends the join code to the owner; collaborators get null.
  const [code, setCode] = useState(isOwner ? joinCode : null);
  const [rotating, setRotating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  const done = (text: string, bad?: boolean) => {
    setMsg({ text, bad });
    router.refresh();
  };

  async function codeClick() {
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        setMsg({ text: "Code copied!" });
      } catch {
        setMsg({ text: code });
      }
      return;
    }
    const r = await generateJoinCode({ projectId });
    if (r.ok && r.data.code) {
      setCode(r.data.code);
      setMsg({ text: `Code generated: ${r.data.code}` });
    } else setMsg({ text: "Couldn't generate a code, try again.", bad: true });
  }

  return (
    <div className={cn(panel, "p-4")}>
      {collaborators.length ? (
        collaborators.map((c) => (
          <div key={String(c.id)} className={cn(checkRow, "justify-between py-1")}>
            <span className="flex items-center gap-2">
              {c.name} {c.status === "pending" ? <Badge>INVITED</Badge> : <Badge tone="green">JOINED</Badge>}
            </span>
            {isOwner ? (
              <button type="button" className={smallButton} onClick={() => setRemoving(String(c.id))}>
                REMOVE
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-sm text-faint">No collaborators yet. Collaborators can view and log hours only, they can&apos;t edit or ship this project.</p>
      )}
      {isOwner ? (
        <>
          <InviteSearch projectId={projectId} onDone={done} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={hint()}>or share a join code:</span>
            {code ? <Badge tone="teal">{code}</Badge> : null}
            <button type="button" className={smallButton} onClick={codeClick}>
              {code ? "COPY CODE" : "GET INVITE CODE"}
            </button>
            {code ? (
              <button type="button" className={smallButton} onClick={() => setRotating(true)}>
                ROTATE CODE
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      {msg ? <p className={hint(msg.bad ? "bad" : "ok")}>{msg.text}</p> : null}
      {isOwner ? (
        <ConfirmDialog
          open={rotating}
          onOpenChange={(o) => !o && setRotating(false)}
          title="Rotate the join code?"
          confirmLabel="Rotate"
          danger
          pending={pending}
          onConfirm={async () => {
            setPending(true);
            const r = await rotateJoinCode({ projectId });
            setPending(false);
            setRotating(false);
            if (r.ok && r.data.code) {
              setCode(r.data.code);
              setMsg({ text: `New code: ${r.data.code}. The old one no longer works.` });
            } else setMsg({ text: r.ok ? "Couldn't rotate the code, try again." : projectError(r.error), bad: true });
          }}
        >
          <p>The current code stops working right away. Anyone who already joined stays on the project.</p>
        </ConfirmDialog>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this collaborator?"
        confirmLabel="Remove"
        danger
        pending={pending}
        onConfirm={async () => {
          if (!removing) return;
          setPending(true);
          const r = await removeCollaborator({ collabId: removing });
          setPending(false);
          setRemoving(null);
          done(r.ok ? "Collaborator removed." : "Couldn't remove them, try again.", !r.ok);
        }}
      />
    </div>
  );
}

/** For a collaborator: tick which of THEIR Hackatime projects are their work on this project. */
export function MyHackatime({ self, stats, projectId }: { self: Collaborator | undefined; stats: HtStats | null; projectId: number }) {
  const [picked, setPicked] = useState<string[]>(self?.hackatimeProjects ?? []);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  if (!self) return <p className="text-sm text-faint">Couldn&apos;t load your collaborator info.</p>;
  if (!stats || !stats.connected)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-faint">Hackatime isn&apos;t connected, connect it to track your own hours on this project.</span>
        <ConnectHackatimeButton returnTo={`/projects/${projectId}`} />
      </div>
    );
  return (
    <div>
      <p className="mb-2 text-sm text-faint">Tick the Hackatime projects that are YOUR work on this project.</p>
      <div className={htPick}>
        {[...stats.projects]
          .sort((a, b) => b.seconds - a.seconds)
          .map((h) => (
            <label key={h.name} className={htPickRow}>
              <input
                type="checkbox"
                checked={picked.includes(h.name)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, h.name] : picked.filter((n) => n !== h.name))}
              />
              <span>{h.name}</span>
              <span className={htPickHours}>{hours(h.seconds)}</span>
            </label>
          ))}
      </div>
      <Button
        className="mt-2"
        onClick={async () => {
          const r = await saveCollabHackatime({ collabId: String(self.id), hackatimeProjects: picked });
          setMsg(r.ok ? { text: "Saved!" } : { text: "Couldn't save, try again.", bad: true });
        }}
      >
        SAVE
      </Button>
      {msg ? <span className={cn(hint(msg.bad ? "bad" : "ok"), "ml-2")}>{msg.text}</span> : null}
    </div>
  );
}
