"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { ActionButton, Button, Checkbox, Field, Input, Muted, NativeSelect, Textarea } from "@/app/_ui/ui";

// One entry per world the client will spawn NPCs into. Keep in sync with
// NPC_WORLDS in app/actions.ts and WORLDS in the server's routes/npcs.ts.
const WORLDS = [
  { id: "village", label: "The Hub village" },
  { id: "open_world", label: "Open world (Dustline)" },
  { id: "factory_island", label: "Factory Island" },
  { id: "pixel_cafe", label: "Pixl Cafe" },
];

// npc.gd resolves its modes as an if/elif chain, so exactly one applies.
const KINDS = [
  { id: "dialogue", label: "Just talks", hint: "Says its dialogue and nothing else." },
  { id: "trial", label: "Hands out a Trial", hint: "Offers a Trial the player can accept." },
  { id: "projects", label: "Opens the Builder Terminal", hint: "Sends the player to /projects." },
  { id: "explore", label: "Opens Explore", hint: "Sends the player to /explore." },
  { id: "project_quest", label: "Asks for any project", hint: "Nudges the player to ship something of their own." },
  { id: "faq", label: "Answers FAQs", hint: "Canned question picker sourced from the docs." },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(KINDS.map((k) => [k.id, k.label.toLowerCase()]));

// SkinUtil's nine pre-assembled characters. A custom cv1: composite can still be
// typed in by hand; the server validates either shape.
const PRESET_SKINS = Array.from({ length: 9 }, (_, i) => `cvc:${i + 1}`);

// NPC-only sheets (SkinUtil.NPC_SHEETS): players can't wear these, NPCs can.
// Keep in sync with apps/game/scripts/skin_util.gd and the SKIN_RE in actions.ts.
const NPC_SKINS = ["npc:pixo", "npc:cheetah"];

// Every skin the dropdown offers directly (anything else falls back to "custom").
const SELECTABLE_SKINS = [...PRESET_SKINS, ...NPC_SKINS];

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NpcDraft {
  id?: number;
  world: string;
  pos_x: number;
  pos_y: number;
  npc_name: string;
  skin: string;
  dialogue: string;
  kind: string;
  trial_checkin: boolean;
  sidequest_id: number | null;
  quest_offer: string;
  quest_done: string;
  trial_reminder: string;
  wanders: boolean;
}

interface TrialLite {
  id: number;
  name: string;
  active: boolean;
}

// The already-placed NPCs drawn as dots on the map. Carries enough to answer
// "what does that one do?" without leaving the form you're filling in.
export interface Marker {
  id: number;
  world: string;
  npc_name: string;
  pos_x: number;
  pos_y: number;
  kind: string;
  skin: string;
  trial: string | null;
  dialogue: string;
  active: boolean;
}

export function NpcForm({
  action,
  bounds,
  trials,
  others,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  bounds: Record<string, Bounds>;
  trials: TrialLite[];
  others: Marker[];
  initial?: NpcDraft;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [world, setWorld] = useState(initial?.world ?? "village");
  const [pos, setPos] = useState({
    x: initial?.pos_x ?? 0,
    y: initial?.pos_y ?? 0,
  });
  const [kind, setKind] = useState(initial?.kind ?? "dialogue");
  const [skin, setSkin] = useState(initial?.skin ?? "cvc:1");
  // The already-placed NPC whose dot was last clicked, shown as a read-only
  // card under the map so you can check what's already there mid-edit.
  const [picked, setPicked] = useState<Marker | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const b = bounds[world];

  // A click anywhere on the baked map becomes a world coordinate. The image is
  // the whole world rect, so the fraction across it maps linearly onto the
  // world's bounds, which keeps this correct at any rendered size.
  function place(e: React.MouseEvent<HTMLImageElement>) {
    const img = imgRef.current;
    if (!img || !b) return;
    const rect = img.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    setPos({
      x: Math.round(b.x + fx * b.w),
      y: Math.round(b.y + fy * b.h),
    });
  }

  const frac = b ? { left: ((pos.x - b.x) / b.w) * 100, top: ((pos.y - b.y) / b.h) * 100 } : { left: 50, top: 50 };
  const inFrame = frac.left >= 0 && frac.left <= 100 && frac.top >= 0 && frac.top <= 100;

  return (
    <form action={action} className="flex flex-col gap-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="world" value={world} />
      <input type="hidden" name="posX" value={pos.x} />
      <input type="hidden" name="posY" value={pos.y} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="skin" value={skin} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="World">
          <NativeSelect value={world} onChange={(e) => setWorld(e.target.value)}>
            {WORLDS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Name" hint="Has to be unique within its world.">
          <Input name="npcName" required maxLength={40} defaultValue={initial?.npc_name ?? ""} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="hc-label">
          Spot
          {!inFrame && <span className="hc-label-hint">Outside the map, move it back in.</span>}
        </span>
        <div
          className="relative inline-block max-w-full self-start overflow-x-auto"
          style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
        >
          <img
            ref={imgRef}
            src={`/map/${world}.png`}
            alt={`${world} map`}
            onClick={place}
            className="block max-w-full cursor-crosshair select-none"
            style={{ imageRendering: "pixelated" }}
            draggable={false}
          />
          {others
            .filter((o) => o.world === world && o.id !== initial?.id && b)
            .map((o) => {
              const isPicked = picked?.id === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  title={o.npc_name}
                  aria-label={`${o.npc_name}, ${o.kind}`}
                  onClick={(e) => {
                    // Without this the click also lands on the map underneath
                    // and moves the NPC being edited.
                    e.stopPropagation();
                    setPicked(isPicked ? null : o);
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full transition-transform hover:scale-150"
                  style={{
                    left: `${((o.pos_x - b.x) / b.w) * 100}%`,
                    top: `${((o.pos_y - b.y) / b.h) * 100}%`,
                    width: isPicked ? 14 : 10,
                    height: isPicked ? 14 : 10,
                    background: isPicked ? "var(--text)" : "var(--hc-muted)",
                    opacity: isPicked || o.active ? 1 : 0.45,
                    border: "1px solid var(--background)",
                  }}
                />
              );
            })}
          {inFrame && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${frac.left}%`,
                top: `${frac.top}%`,
                width: 12,
                height: 12,
                background: "var(--primary)",
                border: "2px solid var(--background)",
              }}
            />
          )}
        </div>
        {picked && (
          <div className="hc-panel text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-bold">{picked.npc_name}</span>
                <Muted> · {KIND_LABEL[picked.kind] ?? picked.kind}</Muted>
                {!picked.active && <Muted> · hidden</Muted>}
                <div className="mt-0.5 text-xs tabular-nums">
                  <Muted>
                    ({Math.round(picked.pos_x)}, {Math.round(picked.pos_y)}) · {picked.skin}
                    {picked.trial ? ` · ${picked.trial}` : ""}
                  </Muted>
                </div>
                {picked.dialogue && (
                  <div className="mt-1 line-clamp-2 text-xs italic">
                    <Muted>&ldquo;{picked.dialogue}&rdquo;</Muted>
                  </div>
                )}
                {picked.kind === "trial" && !picked.trial && (
                  <div className="mt-1 text-xs" style={{ color: "var(--hc-red)" }}>
                    Hands out a Trial but has none linked, so it just talks in game.
                  </div>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Close
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="hc-label flex-row items-center gap-2">
            x
            <Input
              type="number"
              value={pos.x}
              onChange={(e) => setPos((p) => ({ ...p, x: Number(e.target.value) }))}
              className="w-24"
            />
          </label>
          <label className="hc-label flex-row items-center gap-2">
            y
            <Input
              type="number"
              value={pos.y}
              onChange={(e) => setPos((p) => ({ ...p, y: Number(e.target.value) }))}
              className="w-24"
            />
          </label>
          <Muted className="text-xs">
            Click the map to place, or type exact coordinates. Click a grey dot to see what that NPC does.
          </Muted>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Skin">
          <div className="flex items-center gap-2">
            <NativeSelect
              className="flex-1"
              value={SELECTABLE_SKINS.includes(skin) ? skin : "custom"}
              onChange={(e) => setSkin(e.target.value === "custom" ? "cv1:b1h1t1o1" : e.target.value)}
            >
              {SELECTABLE_SKINS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="custom">custom...</option>
            </NativeSelect>
            {!SELECTABLE_SKINS.includes(skin) && (
              <Input value={skin} onChange={(e) => setSkin(e.target.value)} className="hc-mono w-48" />
            )}
          </div>
        </Field>
        <Field label="What it does" hint={KINDS.find((k) => k.id === kind)?.hint}>
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field label="Dialogue" hint="One line per dialogue box. Shown when the NPC has nothing more specific to say.">
        <Textarea name="dialogue" maxLength={1000} rows={2} defaultValue={initial?.dialogue ?? ""} />
      </Field>

      {kind === "trial" && (
        <div className="hc-panel flex flex-col gap-4">
          <Field
            label="Trial it hands out"
            hint="Only active Trials can actually be offered. The NPC falls back to its dialogue otherwise."
          >
            <NativeSelect name="sidequestId" defaultValue={initial?.sidequest_id ?? ""}>
              <option value="">Pick a Trial</option>
              {trials.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.active ? "" : " (hidden)"}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Checkbox
            name="trialCheckin"
            value="1"
            defaultChecked={initial?.trial_checkin ?? false}
            label={
              <>
                Check-in copy{" "}
                <Muted className="text-xs">
                  Hidden until the player accepts this Trial, then appears to nudge them along.
                </Muted>
              </>
            }
          />
          <Field label="Offer" hint="The pitch, shown before the player accepts.">
            <Textarea name="questOffer" maxLength={1500} rows={3} defaultValue={initial?.quest_offer ?? ""} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reminder" hint="Shown while the Trial is in progress.">
              <Textarea name="trialReminder" maxLength={1000} rows={3} defaultValue={initial?.trial_reminder ?? ""} />
            </Field>
            <Field label="On completion" hint="Shown once the Trial is finished.">
              <Textarea name="questDone" maxLength={1000} rows={3} defaultValue={initial?.quest_done ?? ""} />
            </Field>
          </div>
        </div>
      )}

      <Checkbox
        name="wanders"
        value="1"
        defaultChecked={initial?.wanders ?? true}
        label={
          <>
            Wanders around <Muted className="text-xs">Off pins it to the exact spot above.</Muted>
          </>
        }
      />

      <div>
        <ActionButton pendingLabel={pendingLabel}>{submitLabel}</ActionButton>
      </div>
    </form>
  );
}
