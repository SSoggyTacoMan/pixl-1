import { setShowReviewerNames } from "@/app/actions";
import { ActionButton } from "@/app/_ui/ui";

// Only rendered while live: reveals other reviewers' names (hidden by default
// on stream), or hides them again.
export function ShowReviewerNames({ hidden }: { hidden: boolean }) {
  return (
    <form action={setShowReviewerNames}>
      <input type="hidden" name="show" value={hidden ? "1" : "0"} />
      <ActionButton variant="outline" size="sm" icon={hidden ? "view" : "view-hide"} pendingLabel="Switching...">
        {hidden ? "Show reviewer names" : "Hide reviewer names"}
      </ActionButton>
    </form>
  );
}
