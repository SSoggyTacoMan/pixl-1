/* eslint-disable @next/next/no-img-element */
import { Suspense } from "react";
import { requirePage } from "@/lib/guard";
import { getLiveMode } from "@/lib/liveModeServer";
import { LiveBlocked } from "@/app/_components/LiveBlocked";
import { getPlayerBySlackId, playerLabel, searchPlayerHandles } from "@/lib/db";
import { getSlackUserProfile } from "@/lib/slack";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  Code,
  DescriptionList,
  EmptyState,
  Icon,
  Input,
  Mono,
  Muted,
  PageHeader,
  Table,
  TextLink,
  formatDateTime,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// The Slack call streams in behind Suspense so the search forms render
// straight away even when Slack is slow.
async function ProfileResult({ query }: { query: string }) {
  const profile = await getSlackUserProfile(query);
  if (!profile) {
    return (
      <Callout tone="danger" icon="important">
        Couldn&apos;t find a Slack user for <Code>{query}</Code>. Double-check the ID. This needs the
        exact <Code>U0...</Code> id, not a display name.
      </Callout>
    );
  }
  const player = profile.deleted ? null : await getPlayerBySlackId(profile.id);

  return (
    <Card>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        {profile.image512 && (
          <img src={profile.image512} alt="" width={80} height={80} className="hc-avatar shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="hc-heading text-lg">{profile.displayName || profile.realName || profile.name}</h2>
            {profile.deleted && <Badge tone="danger">Deactivated</Badge>}
            {profile.isPrimaryOwner && <Badge tone="warning">Primary owner</Badge>}
            {!profile.isPrimaryOwner && profile.isOwner && <Badge tone="warning">Owner</Badge>}
            {profile.isAdmin && !profile.isOwner && <Badge tone="info">Admin</Badge>}
            {profile.isBot && <Badge>Bot</Badge>}
            {profile.isUltraRestricted && <Badge outline>Single-channel guest</Badge>}
            {!profile.isUltraRestricted && profile.isRestricted && <Badge outline>Multi-channel guest</Badge>}
          </div>
          {profile.realName && profile.realName !== profile.displayName && (
            <Muted className="text-sm">{profile.realName}</Muted>
          )}
          {(profile.statusEmoji || profile.statusText) && (
            <div className="mt-1 text-sm">
              {profile.statusEmoji ? `${profile.statusEmoji} ` : ""}
              {profile.statusText}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink
              href={`https://hackclub.slack.com/team/${profile.id}`}
              external
              variant="outline"
              size="sm"
              icon="slack-fill"
            >
              Open in Slack
            </ButtonLink>
            {player && (
              <ButtonLink href={`/players/${player.id}`} variant="outline" size="sm" icon="person">
                Pixl profile: {playerLabel(player)}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>

      <DescriptionList
        items={[
          ["Slack ID", <Mono key="id">{profile.id}</Mono>],
          ["Username", profile.name ? `@${profile.name}` : null],
          ["Team ID", profile.teamId ? <Mono key="team">{profile.teamId}</Mono> : null],
          ["Email", profile.email],
          ["Phone", profile.phone],
          ["Title", profile.title],
          ["Skype", profile.skype],
          [
            "Timezone",
            profile.timezone
              ? `${profile.timezoneLabel ? `${profile.timezoneLabel}, ` : ""}${profile.timezone}`
              : null,
          ],
          ["Profile last updated", profile.updated ? formatDateTime(profile.updated * 1000) : null],
        ]}
      />

      {!process.env.SLACK_BOT_TOKEN?.length && (
        <div className="mt-4">
          <Callout tone="warning" icon="important">
            SLACK_BOT_TOKEN is not set.
          </Callout>
        </div>
      )}
      {!profile.email && (
        <p className="hc-caption mt-4 text-xs">
          No email shown. The dashboard&apos;s Slack app doesn&apos;t have the <Code>users:read.email</Code>{" "}
          scope.
        </p>
      )}
    </Card>
  );
}

export default async function SlackLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; name?: string }>;
}) {
  await requirePage("owner");
  if (await getLiveMode()) return <LiveBlocked what="Slack lookup" />;
  const { q, name } = await searchParams;
  const query = q?.trim() ?? "";
  const nameQuery = name?.trim() ?? "";

  const matches = nameQuery ? await searchPlayerHandles(nameQuery) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Slack lookup"
        description={
          <>
            Paste a Slack user ID (the <Code>U0...</Code> id, not an @handle) to pull everything Slack
            hands back about that account.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Look up a Slack ID" icon="slack-fill" />
          <form className="flex flex-wrap gap-2">
            <Input name="q" defaultValue={query} placeholder="Slack user ID (U0...)" className="hc-mono min-w-60 flex-1" />
            <Button type="submit" icon="search">
              Look up
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Find a player by name" icon="person" />
          <form className="flex flex-wrap gap-2">
            <Input
              name="name"
              defaultValue={nameQuery}
              placeholder="Search Pixl display or real name"
              className="min-w-60 flex-1"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </Card>
      </div>

      {nameQuery && (
        <Card padding="flush">
          <CardHeader title={`Players matching "${nameQuery}"`} icon="search" count={matches.length} />
          <Table headers={["Player", "Slack ID", ""]}>
            {matches.map((m) => (
              <tr key={m.id}>
                <td className="font-bold">{playerLabel(m)}</td>
                <td>
                  <Mono>{m.slack_id}</Mono>
                </td>
                <td className="text-right">
                  <TextLink href={`/slack-lookup?q=${encodeURIComponent(m.slack_id ?? "")}`}>
                    <span className="inline-flex items-center gap-1">
                      Look up <Icon glyph="view-forward" size={16} />
                    </span>
                  </TextLink>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={3}>
                  <EmptyState title="No matches" icon="search">
                    No Pixl players with a linked Slack account match that name.
                  </EmptyState>
                </td>
              </tr>
            )}
          </Table>
        </Card>
      )}

      {query && (
        <Suspense
          key={query}
          fallback={
            <Card>
              <EmptyState title="Asking Slack..." icon="slack-fill" />
            </Card>
          }
        >
          <ProfileResult query={query} />
        </Suspense>
      )}
    </div>
  );
}
