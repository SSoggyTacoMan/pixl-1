// Class strings shared by the project trading card (project-card.tsx) and its
// client-side upvote button, kept out of both so the server card and the
// "use client" button can import them without a client boundary in between.
import { cn } from "@/lib/cn";

// The upvote slot on the card: a button (upvote-button.tsx) or, when voting
// is off, a read-only count.
export const voteBase = cn(
  "flex items-center justify-center gap-[calc(3*var(--u))] border-0 bg-none px-[calc(4*var(--u))] pt-0 pb-[calc(2*var(--u))]",
  "text-[length:calc(9*var(--u))] tracking-[.04em] text-[#16161e]",
  "[--h:12] [--w:36] [--x:144] [--y:220]",
);

export const voteIcon = "size-[calc(8*var(--u))] [image-rendering:pixelated]";
