"use client";

import {
  banIdea,
  banPlayer,
  deletePlayerAccount,
  liftBan,
  resetPlayerPosition,
  sendNotification,
  unbanIdea,
  updatePlayerInfo,
  warnPlayer,
} from "@/app/actions";
import { ActionButton, Field, Input, NativeSelect } from "@/app/_ui/ui";

// Player and idea moderation forms, shared by the player, violations, bans,
// reports and ideas pages.

export function WarnForm({ userId, compact = false }: { userId: string; compact?: boolean }) {
  return (
    <form action={warnPlayer} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      {!compact && <Input name="message" placeholder="Custom warning (optional)" className="min-w-0 flex-1" />}
      <ActionButton variant="outline" size="sm" icon="important" pendingLabel="Warning...">
        Warn
      </ActionButton>
    </form>
  );
}

export function BanForm({
  userId,
  compact = false,
  isBanned = false,
}: {
  userId: string;
  compact?: boolean;
  isBanned?: boolean;
}) {
  return (
    <form action={banPlayer} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="reason"
        placeholder="Reason"
        maxLength={1000}
        className={compact ? "w-32" : "min-w-32 flex-1"}
        required
        disabled={isBanned}
      />
      <NativeSelect name="hours" defaultValue="24" disabled={isBanned} className="w-auto">
        <option value="1">1 hour</option>
        <option value="24">1 day</option>
        <option value="168">7 days</option>
        <option value="720">30 days</option>
        <option value="0">Permanent</option>
      </NativeSelect>
      <ActionButton variant="danger" size="sm" icon="private" pendingLabel="Banning..." disabled={isBanned}>
        {isBanned ? "Already banned" : "Ban"}
      </ActionButton>
    </form>
  );
}

export function NotifyForm({ userId }: { userId: string }) {
  return (
    <form action={sendNotification} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Input name="title" placeholder="Title" maxLength={100} className="w-40" required />
      <Input name="body" placeholder="Message" maxLength={500} className="min-w-40 flex-1" required />
      <ActionButton variant="outline" size="sm" icon="send" pendingLabel="Sending...">
        Notify
      </ActionButton>
    </form>
  );
}

export function LiftBanForm({ userId }: { userId: string }) {
  return (
    <form action={liftBan}>
      <input type="hidden" name="userId" value={userId} />
      <ActionButton variant="success" size="sm" pendingLabel="Lifting...">
        Lift ban
      </ActionButton>
    </form>
  );
}

export function IdeaBanForm({ ideaId }: { ideaId: number }) {
  return (
    <form action={banIdea} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="ideaId" value={ideaId} />
      <input type="hidden" name="returnTo" value="/ideas" />
      <Input name="reason" placeholder="Reason" maxLength={1000} className="w-40" required />
      <ActionButton variant="danger" size="sm" pendingLabel="Removing...">
        Remove
      </ActionButton>
    </form>
  );
}

export function IdeaUnbanForm({ ideaId }: { ideaId: number }) {
  return (
    <form action={unbanIdea}>
      <input type="hidden" name="ideaId" value={ideaId} />
      <ActionButton variant="success" size="sm" pendingLabel="Restoring...">
        Restore
      </ActionButton>
    </form>
  );
}

// Clears saved scene positions, so they spawn at each scene's default the
// next time they connect.
export function ResetPositionForm({ userId }: { userId: string }) {
  return (
    <form action={resetPlayerPosition}>
      <input type="hidden" name="userId" value={userId} />
      <ActionButton
        variant="outline"
        size="sm"
        icon="map-pin"
        pendingLabel="Resetting..."
        confirm="Clear this player's saved position? They'll spawn at the default next time they log in."
      >
        Reset position
      </ActionButton>
    </form>
  );
}

export function EditInfoForm({
  userId,
  displayName,
  realName,
  email,
}: {
  userId: string;
  displayName: string;
  realName: string;
  email: string;
}) {
  return (
    <form action={updatePlayerInfo} className="flex flex-col gap-4">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="In-game name">
          <Input name="displayName" defaultValue={displayName} maxLength={60} required />
        </Field>
        <Field label="Real name">
          <Input name="realName" defaultValue={realName} maxLength={100} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={email} maxLength={200} />
        </Field>
      </div>
      <div>
        <ActionButton size="sm" pendingLabel="Saving...">
          Save info
        </ActionButton>
      </div>
    </form>
  );
}

// Owners only. A full erasure (lib/erasure.ts): the account, everything tied
// to it, and the copies the cascade misses are gone for good once this submits.
export function DeleteAccountForm({ userId }: { userId: string }) {
  return (
    <form action={deletePlayerAccount} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="reason"
        placeholder="Reason, e.g. data removal request (sent to them first)"
        maxLength={1000}
        className="min-w-48 flex-1"
        required
      />
      <ActionButton
        variant="danger"
        size="sm"
        icon="delete"
        pendingLabel="Erasing..."
        confirm="Erase this player's account and all their data? This can't be undone. Projects, orders, pixels, chat, tickets, Pixo's memory of them and their Airtable records all go."
      >
        Erase all data
      </ActionButton>
    </form>
  );
}
