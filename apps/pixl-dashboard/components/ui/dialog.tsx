"use client";

// Radix Dialog with LEDGER styling. Replaces pixl.js's confirmDialog /
// promptDialog.
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="dialog-overlay" />
        <D.Content className="dialog-content panel p-5">
          <D.Title className="font-pixel text-xl text-ink">{title}</D.Title>
          {description ? <D.Description className="mt-2 text-dim">{description}</D.Description> : null}
          <div className="mt-4">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  pending,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {children}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </button>
        <button type="button" className={`btn${danger ? " red" : ""}`} onClick={onConfirm} disabled={pending}>
          {pending ? "Working..." : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
