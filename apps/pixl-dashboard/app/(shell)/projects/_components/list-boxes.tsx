"use client";

// The small boxes above the project list: pending collaboration invites and
// the join-with-a-code box.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { acceptInvite, declineInvite, redeemJoinCode } from "../collab-actions";
import { projectError } from "../errors";

export interface PendingInvite {
  id: string | number;
  invitedBy: string;
  projectName: string;
}

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const router = useRouter();
  const accept = useAction(acceptInvite);
  const decline = useAction(declineInvite);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  if (!invites.length) return null;
  const busy = accept.pending || decline.pending;
  return (
    <div className="mb-4">
      <div className="section-h !mt-0">COLLABORATION INVITES</div>
      {msg ? <Notice tone={msg.bad ? "bad" : "good"} className="mb-2">{msg.text}</Notice> : null}
      {invites.map((inv) => (
        <div key={inv.id} className="panel mb-2 flex flex-wrap items-center gap-3 p-3">
          <span>
            {inv.invitedBy} invited you to collaborate on <b>{inv.projectName}</b>
          </span>
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                const r = await accept.run({ collabId: String(inv.id) });
                setMsg(r.ok ? { text: "Joined the project!" } : { text: projectError(r.error), bad: true });
                if (r.ok) router.refresh();
              }}
            >
              ACCEPT
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={async () => {
                const r = await decline.run({ collabId: String(inv.id) });
                setMsg(r.ok ? { text: "Invite declined." } : { text: projectError(r.error), bad: true });
                if (r.ok) router.refresh();
              }}
            >
              DECLINE
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

export function JoinCodeBox() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const { run, pending } = useAction(redeemJoinCode);
  async function join() {
    const c = code.trim();
    if (!c) return;
    const r = await run({ code: c });
    if (r.ok) {
      setCode("");
      setMsg({ text: `Joined "${r.data.projectName}"!` });
      router.refresh();
    } else setMsg({ text: r.error === "invalid_input" ? "That code didn't work." : projectError(r.error), bad: true });
  }
  return (
    <div className="invite-box">
      <div>
        <span className="invite-box-title">GOT AN INVITE CODE?</span>
        <span className="invite-box-sub">Join a friend&apos;s project as a collaborator.</span>
        {msg ? <span className={`hint ${msg.bad ? "bad" : "ok"}`}>{msg.text}</span> : null}
      </div>
      <div className="flex gap-2">
        <input
          className="field max-w-[200px]"
          placeholder="E.G. BLUE-FOX"
          autoComplete="off"
          value={code}
          maxLength={64}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
        <button type="button" className="btn" disabled={pending} onClick={join}>
          JOIN
        </button>
      </div>
    </div>
  );
}
