"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createProject, updateProject } from "../actions";
import { projectError } from "../errors";
import type { Project } from "../types";
import { AUTOSAVE_MS, formKey, saveStatus, shouldAutosave } from "./autosave-state";
import { initialForm, toFields, type FormState } from "./editor-state";
import { clipboardImage } from "./file-button";
import { uploadImageFile } from "./upload";

export type Flash = { tone: "good" | "bad"; text: string } | null;

/**
 * Editor form state + save (create or update) + paste-an-image-for-thumbnail.
 * An existing, unlocked project also autosaves through the same update
 * Server Action, AUTOSAVE_MS after the last edit (the old page did the same
 * for existing projects only; a new project is never created by typing, and
 * an in-review project is locked so it never autosaves).
 */
export function useProjectForm(project: Partial<Project> | null, trialId?: number | null, locked = false) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialForm(project ?? {}, trialId));
  const [savedKey, setSavedKey] = useState(() => formKey(initialForm(project ?? {}, trialId)));
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [pauses, setPauses] = useState(0);
  const [flash, setFlash] = useState<Flash>(null);
  const set = useCallback((patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })), []);

  const formRef = useRef(form);
  const inflight = useRef<Promise<number | null> | null>(null);
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const key = formKey(form);
  const dirty = key !== savedKey;
  const autosave = !!project?.id && !locked;

  // Paste an image anywhere outside a text field to set the thumbnail.
  useEffect(() => {
    if (locked) return;
    async function onPaste(e: ClipboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      const file = clipboardImage(e);
      if (!file) return;
      e.preventDefault();
      setFlash({ tone: "good", text: "Uploading pasted thumbnail..." });
      const r = await uploadImageFile(file);
      if (r.ok) {
        setForm((f) => ({ ...f, imageUrl: r.url }));
        setFlash({ tone: "good", text: autosave ? "Thumbnail uploaded." : "Thumbnail uploaded. Save to keep it." });
      } else setFlash({ tone: "bad", text: r.message });
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [locked, autosave]);

  /** One save at a time: a manual save waits for a running autosave first. */
  const persist = useCallback(
    async (silent: boolean): Promise<number | null> => {
      if (inflight.current) await inflight.current.catch(() => null);
      const f = formRef.current;
      if (!f.name.trim()) {
        if (!silent) setFlash({ tone: "bad", text: projectError("name_required") });
        return null;
      }
      const fields = toFields(f);
      const sentKey = JSON.stringify(fields);
      const setBusy = silent ? setAutoSaving : setSaving;
      const run = (async (): Promise<number | null> => {
        setBusy(true);
        if (!silent) setFlash(null);
        try {
          if (project?.id) {
            const r = await updateProject({ id: project.id, fields });
            if (!r.ok) {
              if (silent) setFailedKey(sentKey);
              else setFlash({ tone: "bad", text: projectError(r.error) });
              return null;
            }
            setSavedKey(sentKey);
            setFailedKey(null);
            // An autosave fires mid-edit: no refresh, so focus and scroll stay put.
            if (!silent) {
              setFlash({ tone: "good", text: "Saved!" });
              router.refresh();
            }
            return project.id;
          }
          const r = await createProject(fields);
          if (!r.ok || !r.data.id) {
            setFlash({ tone: "bad", text: projectError(r.ok ? "save_failed" : r.error) });
            return null;
          }
          setSavedKey(sentKey);
          router.push(`/projects/${r.data.id}`);
          return r.data.id;
        } catch {
          if (silent) setFailedKey(sentKey);
          else setFlash({ tone: "bad", text: projectError("network") });
          return null;
        } finally {
          setBusy(false);
        }
      })();
      inflight.current = run;
      try {
        return await run;
      } finally {
        if (inflight.current === run) inflight.current = null;
      }
    },
    [project?.id, router],
  );

  /** Saves the form. Returns the project id on success (navigates after a create). */
  const save = useCallback(() => persist(false), [persist]);

  /** Holds autosave off while fn runs (e.g. a ship or unship request). */
  const pauseAutosave = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setPauses((n) => n + 1);
    try {
      return await fn();
    } finally {
      setPauses((n) => n - 1);
    }
  }, []);

  const busy = saving || autoSaving;
  const armed = shouldAutosave({
    enabled: autosave,
    dirty,
    paused: pauses > 0 || busy,
    key,
    lastAttemptedKey: failedKey,
    hasName: !!form.name.trim(),
  });

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => void persist(true), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [armed, key, persist]);

  // Leaving with edits the server doesn't have yet: let the browser warn.
  useEffect(() => {
    if (locked || !(dirty || busy)) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [locked, dirty, busy]);

  const status = autosave ? saveStatus({ saving: busy, dirty, failed: failedKey === key }) : null;

  return { form, set, save, saving, flash, setFlash, status, pauseAutosave };
}
