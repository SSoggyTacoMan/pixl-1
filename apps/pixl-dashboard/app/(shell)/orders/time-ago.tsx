"use client";

import { useEffect, useState } from "react";

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s)) return "";
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Relative time, rendered after mount so server and client markup agree. */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState("");
  useEffect(() => setText(timeAgo(iso)), [iso]);
  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
