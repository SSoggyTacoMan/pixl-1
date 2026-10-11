"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createProject, updateProject } from "../actions";
import { projectError } from "../errors";
import type { Project } from "../types";
import { initialForm, toFields, type FormState } from "./editor-state";
import { clipboardImage } from "./file-button";
import { uploadImageFile } from "./upload";

export type Flash = { tone: "good" | "bad"; text: string } | null;

/** Editor form state + save (create or update) + paste-an-image-for-thumbnail. */
export function useProjectForm(project: Partial<Project> | null, trialId?: number | null, locked = false) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialForm(project ?? {}, trialId));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const set = useCallback((patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch })), []);

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
        setFlash({ tone: "good", text: "Thumbnail uploaded. Save to keep it." });
      } else setFlash({ tone: "bad", text: r.message });
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [locked]);

  /** Saves the form. Returns the project id on success (navigates after a create). */
  const save = useCallback(async (): Promise<number | null> => {
    if (!form.name.trim()) {
      setFlash({ tone: "bad", text: projectError("name_required") });
      return null;
    }
    setSaving(true);
    setFlash(null);
    try {
      const fields = toFields(form);
      if (project?.id) {
        const r = await updateProject({ id: project.id, fields });
        if (!r.ok) {
          setFlash({ tone: "bad", text: projectError(r.error) });
          return null;
        }
        setFlash({ tone: "good", text: "Saved!" });
        router.refresh();
        return project.id;
      }
      const r = await createProject(fields);
      if (!r.ok || !r.data.id) {
        setFlash({ tone: "bad", text: projectError(r.ok ? "save_failed" : r.error) });
        return null;
      }
      router.push(`/projects/${r.data.id}`);
      return r.data.id;
    } catch {
      setFlash({ tone: "bad", text: projectError("network") });
      return null;
    } finally {
      setSaving(false);
    }
  }, [form, project?.id, router]);

  return { form, set, save, saving, flash, setFlash };
}
