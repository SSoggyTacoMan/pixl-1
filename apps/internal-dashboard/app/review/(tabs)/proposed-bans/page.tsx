import { redirect } from "next/navigation";
import { requirePage, requireGuidelinesAck } from "@/lib/guard";
import { listProposedBanProjects } from "@/lib/db";
import { slackHandles } from "@/lib/slack";
import { ReviewTable } from "@/app/_components/ReviewTable";
import { Card, CardHeader } from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// Super-admin-only view of projects where a first-pass reviewer's verdict was
// "ban". reviewProject's first-pass branch never bans outright: it parks the
// project in second_review with first_pass_verdict='banned' for a different,
// final reviewer to confirm or overturn. This just makes those easy to find;
// the decision still happens on the project's own review page, with the same
// required audit-note fields as any other second-pass verdict.
export default async function ProposedBansPage() {
  const access = await requirePage("reviewer");
  await requireGuidelinesAck(access);
  if (!access.isOwner) redirect("/review");

  const rows = await listProposedBanProjects();
  const handles = await slackHandles(rows.map((p) => p.users?.slack_id));

  return (
    <div className="flex flex-col gap-6">
      <p className="hc-caption max-w-2xl text-sm">
        Projects a first-pass reviewer proposed banning, waiting on a final reviewer to confirm or
        overturn it, oldest first. Either way still needs the same audit notes as any other second-pass
        verdict.
      </p>
      <Card padding="flush">
        <CardHeader title="Proposed bans" icon="flag" count={rows.length} />
        <ReviewTable makerLinks={access.isOwner} rows={rows} handles={handles} emptyLabel="Nothing waiting on a ban decision right now." />
      </Card>
    </div>
  );
}
