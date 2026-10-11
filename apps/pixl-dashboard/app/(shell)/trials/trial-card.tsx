import { bbstrip } from "@/components/markdown";

export interface TrialQuest {
  id: number | string;
  name: string;
  npc?: string | null;
  npc_name?: string | null;
  region?: string | null;
  min_hours?: number | null;
  brief?: string | null;
  description?: string | null;
  reward?: string | null;
  unlocked?: boolean;
  completed?: boolean;
}

export function TrialCard({ q }: { q: TrialQuest }) {
  const giver = (q.npc_name || q.npc || "").trim();
  const letter = giver.charAt(0).toUpperCase() || "?";
  const status = q.completed ? "DONE" : q.unlocked ? "UNLOCKED" : "LOCKED";
  // The brief is Godot BBCode authored for the game; shown as plain text.
  const brief = q.unlocked
    ? bbstrip(q.brief || q.description || "No brief written for this trial yet.")
    : "Find the right villager in the world to unlock this trial's story.";

  return (
    <div className="ticket-frame">
      <div className="ticket-head">
        <div className="tname">{q.name}</div>
      </div>
      <div className={`ticket-avatar${q.unlocked ? "" : " locked"}`}>{letter}</div>
      <Stat cls="ts-level" label="REGION" value={q.region || "-"} />
      <Stat cls="ts-hours" label="MIN HRS" value={q.min_hours ? `${q.min_hours}h` : "-"} />
      <Stat cls="ts-proj" label="GIVEN BY" value={giver || "-"} />
      <Stat cls="ts-joined" label="STATUS" value={status} />
      <div className="ticket-mask" />
      <div className={`ticket-brief whitespace-pre-line${q.unlocked ? "" : " locked-text"}`}>{brief}</div>
      <div className="ticket-foot">
        <div className="tf-class">{q.reward || "No reward listed"}</div>
        <div className="tf-sub">REWARD ON COMPLETION</div>
      </div>
    </div>
  );
}

function Stat({ cls, label, value }: { cls: string; label: string; value: string }) {
  return (
    <div className={`tstat-v ${cls}`}>
      <span className="tlabel">{label}</span>
      <span className="tval">{value}</span>
    </div>
  );
}
