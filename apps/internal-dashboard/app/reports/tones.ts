import type { Tone } from "@/app/_ui/ui";

// Reporters and targets at or above this many reports get flagged.
export const REPEAT_THRESHOLD = 3;

export const REPORT_STATUS_TONE: Record<string, Tone> = {
  open: "warning",
  resolved: "success",
  dismissed: "neutral",
};

export function aiTone(verdict: string): Tone {
  const v = verdict.toLowerCase();
  if (v === "severe") return "danger";
  if (v === "concerning") return "warning";
  return "neutral";
}
