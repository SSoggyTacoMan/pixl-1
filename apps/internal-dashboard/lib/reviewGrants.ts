import { db } from "@/lib/db";

// Reviewer Food Grant progress (drizzle/0222). The SQL function
// reviewer_food_grant_status owns the milestones and the counting, this only
// reads it and turns it into what the review stats page shows.

export interface ReviewGrantStatus {
  reviews: number;
  milestones: number[];
  earned: number;
  claimed: number;
  available: number;
  next_at: number | null;
  to_go: number | null;
}

export interface ReviewGrantView {
  userId: string;
  status: ReviewGrantStatus;
  itemId: number | null;
}

// A reviewer's own Pixl account (the oldest one if a slack id somehow has
// several), their grant status and the shop item the claim buys. null when
// they have no account, or the migration isn't applied.
export async function getReviewGrantView(slackId: string): Promise<ReviewGrantView | null> {
  const { data: accounts } = await db
    .from("users")
    .select("id")
    .eq("slack_id", slackId)
    .order("created_at", { ascending: true })
    .limit(1);
  const userId = (accounts as { id: string }[] | null)?.[0]?.id;
  if (!userId) return null;
  const [status, item] = await Promise.all([
    db.rpc("reviewer_food_grant_status", { p_user_id: userId }),
    db.from("shop_items").select("id").eq("review_locked", true).eq("active", true).limit(1),
  ]);
  if (status.error || !status.data) {
    if (status.error) console.error("reviewer_food_grant_status", status.error.message);
    return null;
  }
  return {
    userId,
    status: status.data as ReviewGrantStatus,
    itemId: (item.data as { id: number }[] | null)?.[0]?.id ?? null,
  };
}

// 0..100 progress between the milestone they last passed and the next one.
// 100 once every milestone is behind them.
export function progressPct(status: ReviewGrantStatus): number {
  if (status.next_at == null) return 100;
  const prev = [...status.milestones].reverse().find((m) => m <= status.reviews) ?? 0;
  const span = status.next_at - prev;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((status.reviews - prev) / span) * 100)));
}

// The one-line "where you are" summary.
export function progressLine(status: ReviewGrantStatus): string {
  const to = status.to_go ?? 0;
  if (status.next_at == null) return `${status.reviews} reviews, every milestone reached.`;
  return `${status.reviews} reviews, ${to} to go for the next grant (at ${status.next_at}).`;
}
