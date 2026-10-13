"use client";

// Radix Dialog with LEDGER styling. Replaces pixl.js's confirmDialog /
// promptDialog.
import { Dialog as D } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, panel } from "./primitives";

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
        <D.Overlay className="fixed inset-0 z-100 bg-black/45" />
        <D.Content
          className={cn(
            panel,
            "fixed top-1/2 left-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 p-5",
            "max-h-[calc(100vh-48px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto",
          )}
        >
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
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          Cancel
        </Button>
        <Button variant={danger ? "red" : "default"} onClick={onConfirm} disabled={pending}>
          {pending ? "Working..." : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
