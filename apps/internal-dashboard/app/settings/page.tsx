import { requirePage } from "@/lib/guard";
import { getStaffSettings } from "@/lib/db";
import { getLiveMode } from "@/lib/liveModeServer";
import { PageHeader } from "@/app/_ui/ui";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const access = await requirePage("staff");
  const [settings, live] = await Promise.all([getStaffSettings(access.session.slackId), getLiveMode()]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" description="Saved to your account, so they follow you to any browser." />
      <SettingsClient
        initial={settings}
        // Live mode hides personal details on screen, the Slack ID included.
        account={{ name: access.session.name, slackId: live ? null : access.session.slackId }}
      />
    </div>
  );
}
