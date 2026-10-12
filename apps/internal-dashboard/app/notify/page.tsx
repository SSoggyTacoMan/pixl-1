import { requirePage } from "@/lib/guard";
import { NotifyForm } from "@/app/_components/NotifyForm";
import { Flash, PageHeader } from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

export default async function NotifyPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  await requirePage("owner");
  const { sent, error } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notify"
        description="Drop a message into players' in-game inbox (the [N] menu). Choose everyone or a single player."
      />

      <Flash error={error} ok={sent ? `Sent to ${sent === "1" ? "1 player" : `${sent} players`}.` : null} />

      <NotifyForm />
    </div>
  );
}
