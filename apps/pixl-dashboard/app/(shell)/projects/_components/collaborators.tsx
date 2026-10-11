"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/primitives";
import { generateJoinCode, inviteCollaborator, removeCollaborator, saveCollabHackatime, searchPlayers } from "../collab-actions";
import type { Collaborator } from "../data";
import { projectError } from "../errors";
import { hours } from "../format";
import type { HtStats } from "../types";
import { ConnectHackatimeButton } from "./hackatime-strip";

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
      <input className="field" placeholder="Invite by name..." value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      {results.length ? (
        <div className="panel absolute left-0 top-11 z-10 w-full">
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
  const [code, setCode] = useState(joinCode);
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
    <div className="panel p-4">
      {collaborators.length ? (
        collaborators.map((c) => (
          <div key={String(c.id)} className="check-row justify-between py-1">
            <span className="flex items-center gap-2">
              {c.name} {c.status === "pending" ? <Badge>INVITED</Badge> : <Badge tone="green">JOINED</Badge>}
            </span>
            {isOwner ? (
              <button type="button" className="btn ghost !px-2 !py-0.5 !text-xs" onClick={() => setRemoving(String(c.id))}>
                REMOVE
              </button>
            ) : null}
          </div>
        ))
      ) : (
        <p className="faint text-sm">No collaborators yet. Collaborators can view and log hours only, they can&apos;t edit or ship this project.</p>
      )}
      {isOwner ? (
        <>
          <InviteSearch projectId={projectId} onDone={done} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="hint">or share a join code:</span>
            {code ? <Badge tone="teal">{code}</Badge> : null}
            <button type="button" className="btn ghost !px-2 !py-0.5 !text-xs" onClick={codeClick}>
              {code ? "COPY CODE" : "GET INVITE CODE"}
            </button>
          </div>
        </>
      ) : null}
      {msg ? <p className={`hint ${msg.bad ? "bad" : "ok"} mt-2`}>{msg.text}</p> : null}
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
  if (!self) return <p className="faint text-sm">Couldn&apos;t load your collaborator info.</p>;
  if (!stats || !stats.connected)
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="faint text-sm">Hackatime isn&apos;t connected, connect it to track your own hours on this project.</span>
        <ConnectHackatimeButton returnTo={`/projects/${projectId}`} />
      </div>
    );
  return (
    <div>
      <p className="faint mb-2 text-sm">Tick the Hackatime projects that are YOUR work on this project.</p>
      <div className="ht-pick">
        {[...stats.projects]
          .sort((a, b) => b.seconds - a.seconds)
          .map((h) => (
            <label key={h.name}>
              <input
                type="checkbox"
                checked={picked.includes(h.name)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, h.name] : picked.filter((n) => n !== h.name))}
              />
              <span>{h.name}</span>
              <span className="h">{hours(h.seconds)}</span>
            </label>
          ))}
      </div>
      <button
        type="button"
        className="btn mt-2"
        onClick={async () => {
          const r = await saveCollabHackatime({ collabId: String(self.id), hackatimeProjects: picked });
          setMsg(r.ok ? { text: "Saved!" } : { text: "Couldn't save, try again.", bad: true });
        }}
      >
        SAVE
      </button>
      {msg ? <span className={`hint ${msg.bad ? "bad" : "ok"} ml-2`}>{msg.text}</span> : null}
    </div>
  );
}
