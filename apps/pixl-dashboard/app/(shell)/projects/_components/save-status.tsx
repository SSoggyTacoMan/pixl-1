import { SAVE_STATUS_TEXT, type SaveStatus } from "./autosave-state";

/** "All changes saved / Saving... / Unsaved changes" next to the editor heading. */
export function SaveStatusChip({ status }: { status: SaveStatus | null }) {
  if (!status) return null;
  const tone = status === "error" ? "ship-no" : status === "saved" ? "ship-ok" : "faint";
  return (
    <span role="status" aria-live="polite" className={`hint ${tone}`} data-save-status={status}>
      {SAVE_STATUS_TEXT[status]}
    </span>
  );
}
