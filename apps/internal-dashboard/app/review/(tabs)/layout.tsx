import { redirect } from "next/navigation";
import { requirePage, landingFor } from "@/lib/guard";
import { countPendingReviews, countSpotCheckProjects, countProposedBanProjects } from "@/lib/db";
import { ReviewTabs } from "@/app/_components/ReviewTabs";
import { ShowReviewerNames } from "@/app/_components/ShowReviewerNames";
import { getLiveMode, getHideReviewers } from "@/lib/liveModeServer";
import { PageHeader } from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// Shared chrome for every /review/* tab. Keeping the tab bar (and its badge
// count queries) in the layout means it stays mounted across tab clicks, and
// loading.tsx only swaps the content below it.
export default async function ReviewLayout({ children }: { children: React.ReactNode }) {
  // Fraud reviewers get in too, but only to the Fraud reviews tab: every
  // other tab page re-checks requirePage("reviewer") and bounces them.
  const access = await requirePage("staff");
  if (!access.isReviewer && !access.canFraudReview) redirect(landingFor(access));
  const fraudOnly = !access.isReviewer && !access.isOwner;
  // "Needs review" is first-pass ("shipped") work only, for every viewer.
  const [pending, spotCheckCount, proposedBanCount, live, hideReviewers] = await Promise.all([
    fraudOnly ? Promise.resolve(undefined) : countPendingReviews({ viewer: access.session.slackId }),
    access.isOwner ? countSpotCheckProjects() : Promise.resolve(undefined),
    access.isOwner ? countProposedBanProjects() : Promise.resolve(undefined),
    getLiveMode(),
    getHideReviewers(),
  ]);

  return (
    <div>
      <PageHeader
        title="Review"
        description={fraudOnly ? "Robert's fraud scores." : "Ship queue, verdict history and reviewer stats."}
        // While live, other reviewers' names are hidden on every review tab;
        // this reveals (or re-hides) them.
        actions={live ? <ShowReviewerNames hidden={hideReviewers} /> : undefined}
      />
      <ReviewTabs
        isSuper={access.isOwner}
        canFraudReview={access.canFraudReview}
        fraudOnly={fraudOnly}
        pending={pending}
        spotCheckCount={spotCheckCount}
        proposedBanCount={proposedBanCount}
      />
      {children}
    </div>
  );
}
