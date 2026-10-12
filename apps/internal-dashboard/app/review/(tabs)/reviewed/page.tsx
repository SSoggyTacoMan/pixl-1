import { requirePage, requireGuidelinesAck } from "@/lib/guard";
import { listReviewedProjects } from "@/lib/db";
import { slackHandles } from "@/lib/slack";
import { ReviewTable } from "@/app/_components/ReviewTable";
import { Card, CardHeader } from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

export default async function ReviewedPage() {
  const access = await requirePage("reviewer");
  await requireGuidelinesAck(access);
  const rows = await listReviewedProjects();
  const handles = await slackHandles(rows.map((p) => p.users?.slack_id));

  return (
    <Card padding="flush">
      <CardHeader title="Reviewed" icon="history" count={rows.length} />
      <ReviewTable makerLinks={access.isOwner} rows={rows} handles={handles} emptyLabel="No projects reviewed yet." />
    </Card>
  );
}
