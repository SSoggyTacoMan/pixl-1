"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Notice } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { applyReferral } from "./actions";
import { applyError, normalizeCode } from "./lib";

export function ApplyForm({ prefill }: { prefill: string }) {
  const router = useRouter();
  const [code, setCode] = useState(normalizeCode(prefill));
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const { run, pending } = useAction(applyReferral);

  async function submit() {
    const c = normalizeCode(code);
    if (!c) return;
    setErr(null);
    const res = await run({ code: c });
    if (res.ok) {
      setDone(res.data.referrerName ? `Referral applied, thanks, ${res.data.referrerName}!` : "Referral applied!");
      router.refresh();
    } else {
      setErr(applyError(res.error));
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="rf-apply-row">
        <Input
          aria-label="Referral code"
          maxLength={6}
          placeholder="CODE"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
        />
        <Button type="submit" disabled={pending || !code}>
          {pending ? "APPLYING..." : "APPLY"}
        </Button>
      </div>
      {done ? <Notice tone="good">{done}</Notice> : null}
      {err ? <Notice tone="bad">{err}</Notice> : null}
    </form>
  );
}
