import { describe, expect, test } from "bun:test";
import { formKey, saveStatus, shouldAutosave } from "./autosave-state";
import { initialForm } from "./editor-state";

const base = { enabled: true, dirty: true, paused: false, key: "k2", lastAttemptedKey: null, hasName: true };

describe("autosave decisions", () => {
  test("arms only for a dirty, enabled, unpaused, named form", () => {
    expect(shouldAutosave(base)).toBe(true);
    expect(shouldAutosave({ ...base, enabled: false })).toBe(false); // locked / new project
    expect(shouldAutosave({ ...base, dirty: false })).toBe(false);
    expect(shouldAutosave({ ...base, paused: true })).toBe(false); // ship/save in flight
    expect(shouldAutosave({ ...base, hasName: false })).toBe(false);
  });
  test("doesn't retry a key that just failed, but does once it changes", () => {
    expect(shouldAutosave({ ...base, lastAttemptedKey: "k2" })).toBe(false);
    expect(shouldAutosave({ ...base, key: "k3", lastAttemptedKey: "k2" })).toBe(true);
  });
  test("status precedence", () => {
    expect(saveStatus({ saving: true, dirty: true, failed: true })).toBe("saving");
    expect(saveStatus({ saving: false, dirty: true, failed: true })).toBe("error");
    expect(saveStatus({ saving: false, dirty: true, failed: false })).toBe("unsaved");
    expect(saveStatus({ saving: false, dirty: false, failed: false })).toBe("saved");
  });
  test("formKey ignores whitespace-only differences the server trims away", () => {
    const a = initialForm({ name: "Robot" });
    expect(formKey(a)).toBe(formKey({ ...a, name: "Robot  " }));
    expect(formKey(a)).not.toBe(formKey({ ...a, name: "Robot 2" }));
  });
});
