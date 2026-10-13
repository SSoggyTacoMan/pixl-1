"use client";

import { useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/primitives";
import { hint } from "./styles";
import { uploadBomFile, uploadImageFile, type UploadOutcome } from "./upload";

/** A button that opens a file picker and uploads the chosen file. */
export function FileButton({
  label,
  kind,
  projectId,
  disabled,
  onUploaded,
  className = buttonVariants({ variant: "dark" }),
}: {
  label: string;
  kind: "image" | "bom";
  projectId?: number;
  disabled?: boolean;
  onUploaded: (url: string) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setMsg(null);
    const r: UploadOutcome =
      kind === "image" ? await uploadImageFile(file) : await uploadBomFile(file, projectId ?? 0);
    setBusy(false);
    if (r.ok) onUploaded(r.url);
    else setMsg(r.message);
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" className={className} disabled={disabled || busy} onClick={() => input.current?.click()}>
        {busy ? "UPLOADING..." : label}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={kind === "image" ? "image/png,image/jpeg,image/webp" : ".csv,text/csv"}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void handle(f);
        }}
      />
      {msg ? <span className={hint("bad")}>{msg}</span> : null}
    </span>
  );
}

/** Shared paste-an-image support: returns the first image file on the clipboard. */
export function clipboardImage(e: React.ClipboardEvent | ClipboardEvent): File | null {
  const items = Array.from(e.clipboardData?.items ?? []);
  return items.find((i) => i.type.startsWith("image/"))?.getAsFile() ?? null;
}
