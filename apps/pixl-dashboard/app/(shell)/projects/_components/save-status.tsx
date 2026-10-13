import { cn } from "@/lib/cn";
import { SAVE_STATUS_TEXT, type SaveStatus } from "./autosave-state";
import { hint } from "./styles";

/** "All changes saved / Saving... / Unsaved changes" next to the editor heading. */
export function SaveStatusChip({ status }: { status: SaveStatus | null }) {
  if (!status) return null;
  const tone = status === "error" ? "font-bold text-bad" : status === "saved" ? "font-bold text-good" : null;
  return (
    <span role="status" aria-live="polite" className={cn(hint(), tone)} data-save-status={status}>
      {SAVE_STATUS_TEXT[status]}
    </span>
  );
}
