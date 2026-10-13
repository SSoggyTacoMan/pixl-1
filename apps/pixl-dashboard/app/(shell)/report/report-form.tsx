"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Input, Label, Notice, Textarea } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { fileReport, searchPlayers, type PlayerHit } from "./actions";
import { ANON_DEFAULT, ANON_LABEL } from "./copy";

export function ReportForm() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [picked, setPicked] = useState<PlayerHit | null>(null);
  const [reason, setReason] = useState("");
  const [anonymous, setAnonymous] = useState(ANON_DEFAULT);
  const [done, setDone] = useState(false);
  const search = useAction(searchPlayers);
  const submit = useAction(fileReport);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runSearch = search.run;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (picked || term.length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const res = await runSearch({ q: term });
      setHits(res.ok ? res.data : []);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, picked, runSearch]);

  async function onSubmit() {
    if (!picked) return;
    setDone(false);
    const res = await submit.run({ targetId: picked.id, reason: reason.trim(), anonymous });
    if (res.ok) {
      setDone(true);
      setReason("");
      setPicked(null);
      setQ("");
    }
  }

  const submitError =
    submit.error && submit.error.toLowerCase().includes("slow down")
      ? "You're reporting too often, try again later."
      : submit.error;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="report-q">Who are you reporting?</Label>
        {picked ? (
          <div className="flex items-center gap-2.5 text-sm">
            Reporting: <Badge tone="gold">{picked.display_name}</Badge>
            <Button size="sm" variant="dark" onClick={() => setPicked(null)}>
              change
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              id="report-q"
              autoComplete="off"
              placeholder="Search a player's name..."
              value={q}
              maxLength={64}
              onChange={(e) => setQ(e.target.value)}
            />
            {hits.length ? (
              <div
                className="absolute right-0 left-0 z-10 mt-[2px] max-h-[220px] overflow-y-auto border-2 border-stroke bg-panel-deep"
                role="listbox"
              >
                {hits.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="block w-full border-0 bg-transparent px-[12px] py-[9px] text-left text-ink [font:inherit] hover:bg-panel-2"
                    onClick={() => setPicked(p)}
                  >
                    {p.display_name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="report-reason">What happened? (optional but helps a lot)</Label>
        <Textarea
          id="report-reason"
          maxLength={500}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. they kept insulting me in chat near the village..."
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm leading-normal">
        <input
          type="checkbox"
          className="mt-1"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
        />
        <span>{ANON_LABEL}</span>
      </label>

      {done ? <Notice tone="good">Report filed, thanks for keeping Pixl safe.</Notice> : null}
      {submitError ? <Notice tone="bad">{submitError}</Notice> : null}

      <div>
        <Button onClick={onSubmit} disabled={!picked || submit.pending}>
          {submit.pending ? "SUBMITTING..." : "SUBMIT REPORT"}
        </Button>
      </div>
    </div>
  );
}
