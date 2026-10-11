"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { cancelOrder } from "./actions";

export function CancelOrderButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [refunded, setRefunded] = useState<number | null>(null);
  const { run, pending, error } = useAction(cancelOrder);

  async function confirm() {
    const r = await run({ id });
    setOpen(false);
    if (r.ok) setRefunded(r.data.refunded);
  }

  if (refunded !== null) return <Notice tone="good">Order cancelled, {refunded} pixels refunded.</Notice>;

  return (
    <div className="ml-auto flex flex-col items-end gap-2">
      <button type="button" className="btn ghost" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? "CANCELLING…" : "CANCEL & REFUND"}
      </button>
      {error ? <Notice tone="bad">Couldn&apos;t cancel that order: {error}</Notice> : null}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this order?"
        description="Cancel this order and get your pixels back?"
        confirmLabel="Cancel & refund"
        danger
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}
