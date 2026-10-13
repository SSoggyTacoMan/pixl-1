"use client";

// The "post an idea" box. Collab ideas also carry roles, an hours estimate
// and an optional image (uploaded through the projects upload action, the
// same guarded /api/uploads call the project editor uses).
import { useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { Button, Input, Notice, Textarea, buttonVariants, panel } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/cn";
import { FileButton } from "../projects/_components/file-button";
import { postIdea } from "./actions";
import { ROLE_META, ROLES, postError, type Role } from "./ideas-lib";

// Every field in the compose box reads a touch larger than the default.
const composeText = "text-[16.5px] leading-normal";

export function Compose() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [collab, setCollab] = useState(false);
  const [roles, setRoles] = useState<Set<Role>>(new Set());
  const [hours, setHours] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const post = useAction(postIdea);

  function toggleRole(r: Role) {
    setRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }

  function reset() {
    setTitle("");
    setBody("");
    setCollab(false);
    setRoles(new Set());
    setHours("");
    setImageUrl(null);
  }

  async function submit() {
    setMessage(null);
    const t = title.trim();
    if (t.length < 3) return setMessage(postError("title_too_short"));
    const h = Number(hours);
    const res = await post.run({
      title: t,
      body: body.trim(),
      isCollab: collab,
      rolesNeeded: [...roles],
      ...(collab && h > 0 ? { hoursEstimate: Math.min(h, 1000) } : {}),
      ...(collab && imageUrl ? { imageUrl } : {}),
    });
    if (res.ok) reset();
    else setMessage(postError(res.error));
  }

  return (
    <div className={cn(panel, "mb-[22px] flex flex-col gap-2.5 px-5 py-[18px]")}>
      <Input
        className={composeText}
        maxLength={120}
        placeholder="Idea title..."
        autoComplete="off"
        aria-label="Idea title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        className={cn(composeText, "max-h-[280px] min-h-[46px] resize-none overflow-y-auto field-sizing-content")}
        maxLength={2000}
        placeholder="What is it, why's it cool... (optional)"
        aria-label="Idea description"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex items-center gap-2.5 border-2 border-dashed border-stroke bg-panel-2 px-3 py-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={collab}
          aria-label="Looking for collaborators"
          className={cn(
            "relative h-[22px] w-[38px] flex-none cursor-px border-2 border-stroke bg-panel p-0",
            "after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:bg-faint after:content-['']",
            "after:transition-[transform,background-color] after:duration-150",
            collab && "bg-gold after:translate-x-4 after:bg-btn-ink",
          )}
          onClick={() => setCollab((v) => !v)}
        />
        <div>
          <div className="text-[13.5px] font-semibold text-ink">Looking for collaborators</div>
          <div className="text-xs text-faint">Shows what roles you need and lets people apply</div>
        </div>
      </div>
      {collab ? (
        <>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={roles.has(r)}
                className={cn(
                  "inline-flex cursor-px items-center gap-1.5 border-2 border-stroke bg-panel px-2.5 py-[5px] font-sans text-[12.5px] font-bold text-dim",
                  roles.has(r) && "bg-[var(--role-color,var(--teal))] text-btn-ink",
                )}
                style={{ "--role-color": ROLE_META[r].color } as React.CSSProperties}
                onClick={() => toggleRole(r)}
              >
                {ROLE_META[r].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <label htmlFor="idea-hours" className="text-[13px] text-faint">Approx hours of work needed</label>
            <Input
              id="idea-hours"
              className={cn(composeText, "w-[90px]")}
              type="number"
              min={1}
              max={1000}
              step={1}
              placeholder="15"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <FileButton
              kind="image"
              className={buttonVariants({ variant: "ghost" })}
              label={imageUrl ? "CHANGE IMAGE" : "ADD IMAGE"}
              onUploaded={setImageUrl}
            />
            {imageUrl ? (
              <div className="h-[34px] w-[60px] flex-none overflow-hidden border-2 border-stroke bg-panel-2">
                <SafeImage player src={imageUrl} className="block size-full object-cover" />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {message ? <Notice tone="bad">{message}</Notice> : null}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="text-[12.5px] text-faint">{title.length}/120</span>
        <Button onClick={submit} disabled={post.pending}>
          {post.pending ? "POSTING..." : "POST IDEA"}
        </Button>
      </div>
    </div>
  );
}
