"use client";

import { useState } from "react";
import { ActionButton, Card, Checkbox, Field, Input, Muted, NativeSelect } from "@/app/_ui/ui";

// Kept in sync with PROJECT_TYPES in apps/server/src/routes/projects.ts.
const PROJECT_TYPES = [
  "web",
  "windows",
  "mac",
  "linux",
  "cross_platform",
  "python",
  "android",
  "ios",
  "hardware",
  "cad",
  "other",
];

interface ShopItemLite {
  id: number;
  name: string;
  active: boolean;
}

export function CreateEventForm({
  action,
  types,
  shopItems,
}: {
  action: (fd: FormData) => void;
  types: Record<string, string>;
  shopItems: ShopItemLite[];
}) {
  const keys = Object.keys(types);
  const [type, setType] = useState(keys[0]);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event type">
          <NativeSelect name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {keys.map((k) => (
              <option key={k} value={k}>
                {types[k]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Name (players see this)">
          <Input name="name" required maxLength={100} placeholder="Double Streak Weekend" />
        </Field>
        <Field label="Starts (UTC)" hint="Blank means now.">
          <Input name="startsAt" type="datetime-local" />
        </Field>
        <Field label="Ends (UTC)">
          <Input name="endsAt" type="datetime-local" required />
        </Field>
      </div>

      {/* Only the settings this event type actually uses. */}
      {type === "bounty" && (
        <Card sunken padding="compact">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reward (px per project)">
              <Input name="reward" type="number" min={0} max={500} placeholder="50" />
            </Field>
            <Field label="What to build">
              <Input name="description" maxLength={500} placeholder="ship something multiplayer" />
            </Field>
          </div>
        </Card>
      )}

      {type === "community_goal" && (
        <Card sunken padding="compact">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ships target">
              <Input name="target" type="number" min={0} placeholder="25" />
            </Field>
            <Field label="Bonus % for every shipper">
              <Input name="bonusPct" type="number" min={0} max={50} placeholder="10" />
            </Field>
            <Field label="Only for project type" hint="For themed mini-events, e.g. a hardware weekend.">
              <NativeSelect name="projectType" defaultValue="">
                <option value="">Any project type</option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </Card>
      )}

      {type === "review_blitz" && (
        <Card sunken padding="compact" className="sm:max-w-xs">
          <Field label="Reviewer payout multiplier">
            <Input name="mult" type="number" step="0.1" min={1} max={3} placeholder="1.5" />
          </Field>
        </Card>
      )}

      {type === "mystery_merchant" && (
        <Card sunken padding="compact">
          <h3 className="hc-heading text-sm">Items to reveal while the event runs</h3>
          <p className="hc-caption mt-1 mb-3 text-xs">
            Keep these inactive in the shop. They only appear during the event.
          </p>
          {shopItems.length === 0 ? (
            <Muted className="text-sm">No shop items yet.</Muted>
          ) : (
            <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {shopItems.map((i) => (
                <Checkbox
                  key={i.id}
                  name="itemIds"
                  value={String(i.id)}
                  label={
                    <>
                      {i.name}
                      {i.active && <Muted className="ml-1 text-xs">(active anyway)</Muted>}
                    </>
                  }
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {type === "leaderboard_sprint" && (
        <Card sunken padding="compact">
          <p className="hc-caption text-sm">
            No extra settings. This just runs a window-only leaderboard in the in-game explore menu.
          </p>
        </Card>
      )}

      <div>
        <ActionButton icon="plus" pendingLabel="Creating...">
          Create event
        </ActionButton>
      </div>
    </form>
  );
}
