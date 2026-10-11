"use client";

import { useFormStatus } from "react-dom";
import {
  banIdea,
  banPlayer,
  deletePlayerAccount,
  liftBan,
  proposeBan,
  resetPlayerPosition,
  sendNotification,
  unbanIdea,
  updatePlayerInfo,
  warnPlayer,
} from "@/app/actions";
import { PendingButton } from "@/app/_components/PendingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function SubmitBtn({
  children,
  className,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" className={className} disabled={pending || disabled}>
      {pending ? "..." : children}
    </Button>
  );
}

export function WarnForm({ userId, compact = false }: { userId: string; compact?: boolean }) {
  return (
    <form action={warnPlayer} className="flex gap-2 items-center">
      <input type="hidden" name="userId" value={userId} />
      {!compact && (
        <Input
          name="message"
          placeholder="Custom warning (optional)"
          className="text-sm flex-1"
        />
      )}
      <SubmitBtn className="bg-tang text-white hover:bg-tang/90">Warn</SubmitBtn>
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
    <form action={banPlayer} className="flex gap-2 items-center flex-wrap">
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="reason"
        placeholder="Reason"
        maxLength={1000}
        className={compact ? "text-sm w-32" : "text-sm flex-1 min-w-32"}
        required
        disabled={isBanned}
      />
      <Select name="hours" defaultValue="24" disabled={isBanned}>
        <SelectTrigger size="sm" className="text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1 hour</SelectItem>
          <SelectItem value="24">1 day</SelectItem>
          <SelectItem value="168">7 days</SelectItem>
          <SelectItem value="720">30 days</SelectItem>
          <SelectItem value="0">Permanent</SelectItem>
        </SelectContent>
      </Select>
      <SubmitBtn className="bg-brand text-white hover:bg-brand/90" disabled={isBanned}>
        {isBanned ? "Already banned" : "Ban"}
      </SubmitBtn>
    </form>
  );
}

// Moderators can't ban outright , this proposes one for an admin to confirm
// or reject (see /bans "Proposed" tab).
export function ProposeBanForm({ userId, compact = false }: { userId: string; compact?: boolean }) {
  return (
    <form action={proposeBan} className="flex gap-2 items-center flex-wrap">
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="reason"
        placeholder="Reason"
        maxLength={1000}
        className={compact ? "text-sm w-32" : "text-sm flex-1 min-w-32"}
        required
      />
      <Select name="hours" defaultValue="24">
        <SelectTrigger size="sm" className="text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1 hour</SelectItem>
          <SelectItem value="24">1 day</SelectItem>
          <SelectItem value="168">7 days</SelectItem>
          <SelectItem value="720">30 days</SelectItem>
          <SelectItem value="0">Permanent</SelectItem>
        </SelectContent>
      </Select>
      <SubmitBtn className="bg-amber-600 text-white hover:bg-amber-700">Propose ban</SubmitBtn>
    </form>
  );
}

export function NotifyForm({ userId }: { userId: string }) {
  return (
    <form action={sendNotification} className="flex gap-2 items-center flex-wrap">
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="title"
        placeholder="Title"
        maxLength={100}
        className="text-sm w-40"
        required
      />
      <Input
        name="body"
        placeholder="Message"
        maxLength={500}
        className="text-sm flex-1 min-w-40"
        required
      />
      <SubmitBtn className="bg-mint text-ink hover:bg-mint/90">Notify</SubmitBtn>
    </form>
  );
}

export function LiftBanForm({ userId }: { userId: string }) {
  return (
    <form action={liftBan}>
      <input type="hidden" name="userId" value={userId} />
      <SubmitBtn className="bg-mint text-ink hover:bg-mint/90">Lift ban</SubmitBtn>
    </form>
  );
}

export function IdeaBanForm({ ideaId }: { ideaId: number }) {
  return (
    <form action={banIdea} className="flex gap-2 items-center flex-wrap">
      <input type="hidden" name="ideaId" value={ideaId} />
      <input type="hidden" name="returnTo" value="/ideas" />
      <Input
        name="reason"
        placeholder="Reason"
        maxLength={1000}
        className="text-sm w-40"
        required
      />
      <SubmitBtn className="bg-rose-800 text-white hover:bg-rose-900">Remove</SubmitBtn>
    </form>
  );
}

export function IdeaUnbanForm({ ideaId }: { ideaId: number }) {
  return (
    <form action={unbanIdea}>
      <input type="hidden" name="ideaId" value={ideaId} />
      <SubmitBtn className="bg-mint text-ink hover:bg-mint/90">Restore</SubmitBtn>
    </form>
  );
}

// Clears saved (scene) positions , they'll spawn at each scene's default
// next time they connect.
export function ResetPositionForm({ userId }: { userId: string }) {
  return (
    <form action={resetPlayerPosition}>
      <input type="hidden" name="userId" value={userId} />
      <PendingButton
        variant="outline"
        pendingText="Resetting…"
        confirm="Clear this player's saved position? They'll spawn at the default next time they log in."
      >
        Reset position
      </PendingButton>
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
    <form action={updatePlayerInfo} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="block text-xs font-medium text-muted-foreground mb-1">In-game name</Label>
          <Input name="displayName" defaultValue={displayName} maxLength={60} required className="text-sm" />
        </div>
        <div>
          <Label className="block text-xs font-medium text-muted-foreground mb-1">Real name</Label>
          <Input name="realName" defaultValue={realName} maxLength={100} className="text-sm" />
        </div>
        <div>
          <Label className="block text-xs font-medium text-muted-foreground mb-1">Email</Label>
          <Input name="email" type="email" defaultValue={email} maxLength={200} className="text-sm" />
        </div>
      </div>
      <div>
        <PendingButton pendingText="Saving…" className="bg-brand text-white hover:bg-brand/90">
          Save info
        </PendingButton>
      </div>
    </form>
  );
}

// Owners only , the account and everything tied to it (projects, bans,
// violations, mod log…) is gone for good once this submits.
export function DeleteAccountForm({ userId }: { userId: string }) {
  return (
    <form action={deletePlayerAccount} className="flex gap-2 items-center flex-wrap">
      <input type="hidden" name="userId" value={userId} />
      <Input
        name="reason"
        placeholder="Reason (sent to them before deletion)"
        maxLength={1000}
        className="text-sm flex-1 min-w-48"
        required
      />
      <PendingButton
        pendingText="Deleting…"
        confirm="Permanently delete this player's account? This can't be undone , their projects, bans, and history all go with it."
        className="bg-rose-600 text-white hover:bg-rose-700"
      >
        Delete account
      </PendingButton>
    </form>
  );
}
