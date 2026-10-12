"use client";

import { useState } from "react";
import { config } from "@/app/_generated/config";

/** Copies the canonical project URL (pixl.hackclub.com/projects/<id>). */
export function CopyLinkButton({ id, variant = "button" }: { id: number; variant?: "button" | "link" }) {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy() {
    const link = `${config.urls.site}/projects/${Number(id)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Copied!");
    } catch {
      setCopied(link);
    }
    setTimeout(() => setCopied(null), 2500);
  }
  if (variant === "link") {
    return (
      <button type="button" className="text-gold underline-offset-2 hover:underline" onClick={copy}>
        {copied ?? "COPY LINK"}
      </button>
    );
  }
  return (
    <button type="button" className="btn ghost" onClick={copy}>
      {copied ?? "SHARE"}
    </button>
  );
}
