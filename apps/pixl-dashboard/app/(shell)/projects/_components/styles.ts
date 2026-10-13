// Tailwind class strings shared by the /projects pages and components.
import { badgeVariants, buttonVariants, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export const sectionH = "mt-[28px] mb-[12px] flex flex-wrap items-center gap-[12px] font-pixel text-[15px] tracking-[2px] text-ink";

/** Small helper text under a field; `bad` / `ok` colour it. */
export function hint(tone?: "bad" | "ok" | null): string {
  return cn(
    "mt-[4px] block text-[11px] leading-[1.5] text-faint",
    tone === "bad" && "text-bad",
    tone === "ok" && "text-good",
  );
}

export const disclosure = "flex flex-col gap-[8px] border-2 border-stroke bg-panel-deep p-[12px]";
export const checkRow = "flex items-center gap-[8px] text-[14px]";
export const formGrid = cn(panel, "flex flex-col gap-[14px] p-[16px]");

/** The compact ghost button used for inline row actions (REMOVE, REFRESH, ...). */
export const smallButton = cn(buttonVariants({ variant: "ghost" }), "px-2 py-0.5 text-xs");
/** "← ALL PROJECTS" back link. */
export const backLink = cn(buttonVariants({ variant: "dark" }), "mb-4");

export const inviteBox =
  "mb-[14px] flex flex-wrap items-center justify-between gap-[10px] border-2 border-dashed border-stroke px-[14px] py-[12px]";
export const inviteBoxTitle = "font-pixel text-[14px] tracking-[1.5px]";
export const inviteBoxSub = "block text-[13px] text-dim";

export const projHero =
  "mb-[14px] flex min-h-[120px] items-center justify-center overflow-hidden border-2 border-stroke bg-(--img-slot)";
export const projHeroImg = "max-h-[360px] max-w-full";

export const htPick = "flex max-h-[260px] flex-col gap-[4px] overflow-y-auto border-2 border-stroke bg-panel-deep p-[8px]";
export const htPickRow = "flex items-center gap-[8px] text-[13px]";
export const htPickHours = "ml-auto text-teal";

export const trialBox =
  "mb-[14px] flex flex-col gap-[6px] border-2 border-stroke bg-[color-mix(in_srgb,var(--gold)_14%,var(--panel))] px-[14px] py-[12px] text-[14px]";

export const noteStrip =
  "mt-[8px] whitespace-pre-wrap border-2 border-stroke bg-[color-mix(in_srgb,var(--bad)_14%,var(--panel))] px-[10px] py-[8px] text-[13px]";

export type StatusTone = "approved" | "shipped" | "needs" | "draft";

const STATUS_BG: Record<StatusTone, string> = {
  approved: "bg-good text-ink",
  shipped: "bg-teal text-btn-ink",
  needs: "bg-bad text-panel-deep",
  draft: "bg-panel-2 text-dim",
};

/** Project status chip (APPROVED / IN REVIEW / NEEDS CHANGES / DRAFT). */
export function statusChip(tone: StatusTone): string {
  return cn(badgeVariants(), STATUS_BG[tone]);
}

/** The little square in the status legend. */
export function statusDot(tone: StatusTone): string {
  return cn("mr-[5px] inline-block size-[9px] border border-stroke", STATUS_BG[tone].split(" ")[0]);
}
