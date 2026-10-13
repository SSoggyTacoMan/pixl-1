"use client";

import { useState } from "react";
import { Button, field, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { MdEditor } from "./md-editor";
import { hint } from "./styles";

export interface JournalDraft {
  title: string;
  content: string;
  hours: number;
}

/** Title + markdown body + extra hours, used for both new and edited entries. */
export function JournalForm({
  initial,
  submitLabel,
  pending,
  disabled,
  onSubmit,
  onCancel,
  onDraft,
}: {
  initial: JournalDraft;
  submitLabel: string;
  pending?: boolean;
  disabled?: boolean;
  onSubmit: (d: JournalDraft) => Promise<boolean>;
  onCancel?: () => void;
  onDraft?: (d: JournalDraft) => void;
}) {
  const [d, setD] = useState<JournalDraft>(initial);
  const update = (patch: Partial<JournalDraft>) => {
    const next = { ...d, ...patch };
    setD(next);
    onDraft?.(next);
  };

  return (
    <div className={cn(panel, "flex flex-col gap-2 p-3")}>
      <input
        className={field}
        maxLength={120}
        placeholder="Title (optional)"
        value={d.title}
        disabled={disabled}
        onChange={(e) => update({ title: e.target.value })}
      />
      <MdEditor value={d.content} onChange={(content) => update({ content })} hours={d.hours} disabled={disabled} />
      <div className="mt-[8px] flex flex-wrap items-center gap-[10px]">
        <span className={hint()} title="Only hours Hackatime didn't already track, it logs your coding time automatically.">
          extra hours (not tracked by Hackatime):
        </span>
        <input
          className={cn(field, "w-[90px]")}
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={d.hours}
          disabled={disabled}
          onChange={(e) => update({ hours: Math.min(Math.max(Number(e.target.value) || 0, 0), 100) })}
        />
        <span className="ml-auto flex gap-2">
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              CANCEL
            </Button>
          ) : null}
          <Button
            disabled={disabled || pending || !d.content.trim()}
            onClick={async () => {
              if (await onSubmit({ ...d, title: d.title.trim(), content: d.content.trim() }) && !onCancel) {
                setD({ title: "", content: "", hours: 0 });
              }
            }}
          >
            {pending ? "SAVING..." : submitLabel}
          </Button>
        </span>
      </div>
    </div>
  );
}
