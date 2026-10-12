"use client";

import { useState } from "react";
import { BlackoutBadge } from "@/app/_components/BlackoutBadge";
import { Callout, DescriptionList, Field, Input, Muted, Textarea } from "@/app/_ui/ui";

export interface BlackoutReviewPerson {
  userId: string;
  name: string;
  role: "owner" | "collaborator";
  hackatimeBaseSeconds: number;
  journalBaseSeconds: number;
  fixTrackedSeconds: number;
  eligibleTrackedSeconds: number;
  evidenceOk: boolean;
  proposedHours: number | null;
  claimedHours: number | null;
}

export interface BlackoutReviewData {
  operationName: string;
  rateUsd: number;
  rateMode: "floor" | "additive";
  operationStartsAt: string;
  operationEndsAt: string;
  joinedAt: string;
  windowStart: string;
  firstShipAt: string;
  reshipCount: number;
  changesRequestedAt: string | null;
  graceDeadline: string | null;
  fixWindowEnd: string | null;
  decision: "eligible" | "ineligible" | null;
  decisionNote: string;
  decisionBy: string;
  decisionStage: string;
  trialHold: { name: string } | null;
  people: BlackoutReviewPerson[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
const h2 = (seconds: number) => `${Math.round((seconds / 3600) * 100) / 100}h`;
const maxHours = (p: BlackoutReviewPerson) => Math.round((p.eligibleTrackedSeconds / 3600) * 100) / 100;

// Rendered inside ReviewForm's <form>: every field here is submitted with the
// verdict (blackoutDecision, blackoutNote, blackoutHours_<userId>).
export function BlackoutReviewSection({ data }: { data: BlackoutReviewData }) {
  const [decision, setDecision] = useState<"eligible" | "ineligible" | "">(data.decision ?? "");
  const graceActive = data.reshipCount > 0 && data.fixWindowEnd;
  const incompleteNames = data.people.filter((p) => !p.evidenceOk).map((p) => p.name);

  const facts: [string, string][] = [
    ["Operation", `${fmt(data.operationStartsAt)} → ${fmt(data.operationEndsAt)}`],
    ["Joined", fmt(data.joinedAt)],
    ["First Blackout ship", fmt(data.firstShipAt)],
    ["Counted window", `${fmt(data.windowStart)} → ${fmt(data.firstShipAt)}`],
  ];
  if (data.changesRequestedAt)
    facts.push([
      "Changes requested",
      `${fmt(data.changesRequestedAt)}${data.graceDeadline ? ` (fix by ${fmt(data.graceDeadline)})` : ""}`,
    ]);
  if (data.reshipCount > 0) facts.push(["Reships", String(data.reshipCount)]);

  return (
    <fieldset className="hc-panel flex min-w-0 flex-col gap-3">
      <legend className="flex items-center gap-2 px-1">
        <BlackoutBadge />
        <span className="hc-eyebrow">{data.operationName} entry</span>
      </legend>

      <p className="hc-caption text-sm">
        Rule on whether this counts for Blackout, and how many tracked hours inside the window are approved. You never
        set a rate: Pixl pays each person{" "}
        {data.rateMode === "additive" ? (
          <>their own rate + ${data.rateUsd.toFixed(2)}/hr</>
        ) : (
          <>max(their own rate, ${data.rateUsd.toFixed(2)}/hr)</>
        )}{" "}
        on the approved hours, once.
      </p>

      <ul className="hc-caption list-disc pl-5 text-sm">
        <li>Joined during the event, not after the fact</li>
        <li>The project genuinely fits the Blackout prompt</li>
        <li>The approved hours were worked inside the window below</li>
      </ul>

      {data.decisionBy && data.decision && (
        <Callout tone="neutral">
          {data.decisionStage === "first_pass" ? "First pass proposed" : "Previously ruled"}: <b>{data.decision}</b>
          {data.decisionNote ? `. ${data.decisionNote}` : ""}{" "}
          <Muted>({data.decisionBy.replace(/\s*\([^)]*\)\s*$/, "")})</Muted>
        </Callout>
      )}

      <DescriptionList items={facts} />
      {graceActive && (
        <p className="hc-caption text-sm">
          Work after the first ship counts only inside the fix window, and only a small slice (the greater of 1h or 25%
          of the original hours). It is already capped in the numbers below.
        </p>
      )}
      {incompleteNames.length > 0 && (
        <div role="alert">
          <Callout tone="danger" icon="important">
            <b>Time evidence incomplete.</b> Hackatime couldn&apos;t be read at ship time for{" "}
            {incompleteNames.join(", ")}, so the tracked hours below may be under-counted. Pixl can&apos;t raise the
            ceiling for you. If the work looks bigger than the numbers, leave a note rather than guessing.
          </Callout>
        </div>
      )}
      {data.trialHold && (
        <div role="alert">
          <Callout tone="warning" icon="important">
            <b>Trial payout held.</b> This ship is for the Trial &quot;{data.trialHold.name}&quot;. The owner&apos;s
            pixels are held until they pick pixels over the prize, and their Blackout top-up is skipped on this approval
            (not deferred). Collaborators are still topped up.
          </Callout>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {data.people.map((p) => {
          const cap = maxHours(p);
          const start = p.proposedHours ?? Math.min(cap, p.claimedHours ?? cap);
          return (
            <div key={p.userId} className="hc-card flex flex-col gap-2" data-density="compact">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  {p.name} <Muted className="text-xs font-normal">{p.role}</Muted>
                </span>
                <span className="hc-caption text-xs">
                  tracked in window: {h2(p.hackatimeBaseSeconds)} Hackatime + {h2(p.journalBaseSeconds)} journal
                  {p.fixTrackedSeconds > 0 ? ` · fix window ${h2(p.fixTrackedSeconds)} (capped)` : ""}
                </span>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span className="hc-label">Approved Blackout hours</span>
                <Input
                  type="number"
                  name={`blackoutHours_${p.userId}`}
                  defaultValue={decision === "ineligible" ? 0 : start}
                  step="any"
                  inputMode="decimal"
                  onBlur={(e) => {
                    const n = Number(e.currentTarget.value);
                    e.currentTarget.value = String(Number.isFinite(n) ? Math.min(Math.max(n, 0), cap) : 0);
                  }}
                  disabled={decision === "ineligible"}
                  className="w-24 tabular-nums disabled:opacity-50"
                />
                <Muted className="text-xs">
                  max {cap}h
                  {p.claimedHours != null ? ` · normal credit ${Math.round(p.claimedHours * 100) / 100}h` : ""}
                </Muted>
              </label>
              {decision === "ineligible" && <input type="hidden" name={`blackoutHours_${p.userId}`} value="0" />}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4" role="radiogroup" aria-label="Blackout eligibility">
        <label className="hc-check">
          <input
            type="radio"
            name="blackoutDecision"
            value="eligible"
            checked={decision === "eligible"}
            onChange={() => setDecision("eligible")}
          />
          <span>Eligible</span>
        </label>
        <label className="hc-check">
          <input
            type="radio"
            name="blackoutDecision"
            value="ineligible"
            checked={decision === "ineligible"}
            onChange={() => setDecision("ineligible")}
          />
          <span>Not eligible</span>
        </label>
      </div>
      {decision === "ineligible" && (
        <p className="hc-caption text-sm">
          This is the &quot;not a Blackout project, treat it as a normal Pixl project instead&quot; call: it only
          removes the Blackout bonus path. It never changes this project&apos;s normal review, decision, or payout.
        </p>
      )}
      <Field label={`Reason / adjustment note${decision === "ineligible" ? " (required)" : ""}`}>
        <Textarea
          name="blackoutNote"
          defaultValue={data.decisionNote}
          maxLength={1000}
          rows={2}
          placeholder={
            decision === "ineligible"
              ? "Why doesn't this count for Blackout?"
              : "Optional: why the hours were lowered, what you checked"
          }
        />
      </Field>
    </fieldset>
  );
}
