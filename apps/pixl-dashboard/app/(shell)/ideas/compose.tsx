"use client";

// The "post an idea" box. Collab ideas also carry roles, an hours estimate
// and an optional image (uploaded through the projects upload action, the
// same guarded /api/uploads call the project editor uses).
import { useState } from "react";
import { SafeImage } from "@/components/safe-image";
import { Button, Input, Notice, Textarea } from "@/components/ui/primitives";
import { useAction } from "@/components/use-action";
import { FileButton } from "../projects/_components/file-button";
import { postIdea } from "./actions";
import { ROLE_META, ROLES, postError, type Role } from "./ideas-lib";

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
    <div className="panel compose">
      <Input
        maxLength={120}
        placeholder="Idea title..."
        autoComplete="off"
        aria-label="Idea title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        maxLength={2000}
        placeholder="What is it, why's it cool... (optional)"
        aria-label="Idea description"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="collab-row">
        <button
          type="button"
          role="switch"
          aria-checked={collab}
          aria-label="Looking for collaborators"
          className={`switch${collab ? " on" : ""}`}
          onClick={() => setCollab((v) => !v)}
        />
        <div>
          <div className="switch-label">Looking for collaborators</div>
          <div className="switch-sub">Shows what roles you need and lets people apply</div>
        </div>
      </div>
      {collab ? (
        <>
          <div className="role-picker">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={roles.has(r)}
                className={`role-opt${roles.has(r) ? " on" : ""}`}
                style={{ "--role-color": ROLE_META[r].color } as React.CSSProperties}
                onClick={() => toggleRole(r)}
              >
                {ROLE_META[r].label}
              </button>
            ))}
          </div>
          <div className="hours-row">
            <label htmlFor="idea-hours">Approx hours of work needed</label>
            <Input
              id="idea-hours"
              type="number"
              min={1}
              max={1000}
              step={1}
              placeholder="15"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="image-row">
            <FileButton
              kind="image"
              className="btn ghost"
              label={imageUrl ? "CHANGE IMAGE" : "ADD IMAGE"}
              onUploaded={setImageUrl}
            />
            {imageUrl ? (
              <div className="thumb-preview">
                <SafeImage player src={imageUrl} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
      {message ? <Notice tone="bad">{message}</Notice> : null}
      <div className="compose-foot">
        <span className="count">{title.length}/120</span>
        <Button onClick={submit} disabled={post.pending}>
          {post.pending ? "POSTING..." : "POST IDEA"}
        </Button>
      </div>
    </div>
  );
}
