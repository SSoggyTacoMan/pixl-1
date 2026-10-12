// Pure pieces of the project editor's autosave, kept out of the hook so they
// can be unit tested without a DOM.
import { toFields, type FormState } from "./editor-state";

/** Debounce: autosave this long after the last edit. */
export const AUTOSAVE_MS = 1500;

/** Stable key for "what would be sent to the server" - equal keys = nothing to save. */
export function formKey(f: FormState): string {
  return JSON.stringify(toFields(f));
}

export type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export function saveStatus(s: { saving: boolean; dirty: boolean; failed: boolean }): SaveStatus {
  if (s.saving) return "saving";
  if (s.failed && s.dirty) return "error";
  return s.dirty ? "unsaved" : "saved";
}

export const SAVE_STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "All changes saved",
  saving: "Saving...",
  unsaved: "Unsaved changes",
  error: "Autosave failed, click SAVE to retry.",
};

/**
 * Whether the debounce timer should be armed for the current form. Never
 * for a locked (in review) or not-yet-created project, never while a save or
 * ship is running, never for a key that already failed (so a failing save
 * doesn't loop), and never without a name (the server would reject it).
 */
export function shouldAutosave(s: {
  enabled: boolean;
  dirty: boolean;
  paused: boolean;
  key: string;
  lastAttemptedKey: string | null;
  hasName: boolean;
}): boolean {
  return s.enabled && s.dirty && !s.paused && s.hasName && s.key !== s.lastAttemptedKey;
}
