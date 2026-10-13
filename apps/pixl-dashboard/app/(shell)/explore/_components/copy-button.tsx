"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/primitives";

/** Copies `text` to the clipboard; if that's blocked, shows the text instead. */
export function CopyButton({
  text,
  label,
  className = buttonVariants({ variant: "ghost" }),
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [shown, setShown] = useState<string | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setShown("COPIED!");
    } catch {
      setShown(text);
    }
    setTimeout(() => setShown(null), 2500);
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {shown ?? label}
    </button>
  );
}
