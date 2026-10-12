import { Suspense } from "react";
import { requirePage, can } from "@/lib/guard";
import { getLiveMode } from "@/lib/liveModeServer";
import { listProjects, collaboratorsByProject } from "@/lib/db";
import { builderNameFor, redactBuilderUser } from "@/lib/reviewAccess";
import { slackHandles } from "@/lib/slack";
import { isSafeUrl } from "@/lib/safeUrl";
import { BeaconBadge } from "@/app/_components/ProjectBadges";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyRow,
  FilterBar,
  Icon,
  Mono,
  Muted,
  PageHeader,
  StatusBadge,
  Table,
  TextLink,
  buttonClass,
  formatDate,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

type Access = Parameters<typeof builderNameFor>[0];
type Owner = Parameters<typeof builderNameFor>[1];

// Slack handles stream in after the table renders, so a slow Slack never
// holds the page. Until then the name falls back to the in-game one.
async function OwnerName({
  access,
  user,
  handles,
}: {
  access: Access;
  user: Owner & { slack_id?: string | null };
  handles: Promise<Map<string, string>>;
}) {
  const map = await handles;
  return <>{builderNameFor(access, user, { handle: user?.slack_id ? map.get(user.slack_id) : null })}</>;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const access = await requirePage("reviewer");
  const live = await getLiveMode();
  // Admins see archived projects mixed into the main list; plain reviewers
  // only see active ones.
  const isAdmin = can(access, "owner");
  const { q, view } = await searchParams;
  const archived = view === "archived";
  // Legal names are for owners/final reviewers only (lib/reviewAccess.ts),
  // stripped here before anything renders.
  const projects = (
    await listProjects(q, {
      archived,
      includeArchived: !archived && isAdmin,
    })
  ).map((p) => ({ ...p, users: redactBuilderUser(access, p.users) }));
  // Live mode shows no player names at all here (not even in-game ones) and
  // no Hackatime projects, so the Slack handle lookup is skipped too.
  const handles = live
    ? Promise.resolve(new Map<string, string>())
    : slackHandles(projects.map((p) => p.users?.slack_id));
  const collaborators = await collaboratorsByProject(projects.map((p) => p.id));

  const headers = ["Project", "Status", "Owner", "Links", ...(live ? [] : ["Hackatime"]), "Created"];

  return (
    <div>
      <PageHeader
        title={archived ? "Archived projects" : "Projects"}
        count={projects.length}
        actions={
          <>
            {access.isOwner && (
              <a href="/api/projects/export" className={buttonClass("outline", "sm")}>
                <Icon glyph="download" size={18} />
                Export approved (CSV)
              </a>
            )}
            <ButtonLink
              href={archived ? "/projects" : "/projects?view=archived"}
              variant="outline"
              size="sm"
              icon={archived ? "view-back" : "archive"}
            >
              {archived ? "Active projects" : "View archive"}
            </ButtonLink>
          </>
        }
      />

      <FilterBar q={q} placeholder="Search project names">
        {archived && <input type="hidden" name="view" value="archived" />}
      </FilterBar>

      <Card padding="flush">
        <Table headers={headers}>
          {projects.map((p) => {
            const collabCount = collaborators.get(p.id)?.length ?? 0;
            return (
              <tr key={p.id}>
                <td className="max-w-72">
                  <TextLink href={`/projects/${p.id}`} className="font-bold">
                    {p.name}
                  </TextLink>
                  {p.description && <div className="truncate text-xs hc-muted">{p.description}</div>}
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={p.status} />
                    {p.is_peak && <BeaconBadge />}
                    {p.archived_at && <Badge>Archived</Badge>}
                  </div>
                </td>
                <td>
                  {p.users ? (
                    <TextLink href={`/players/${p.user_id}`} className="font-bold">
                      {live ? (
                        "Builder"
                      ) : (
                        <Suspense fallback={builderNameFor(access, p.users)}>
                          <OwnerName access={access} user={p.users} handles={handles} />
                        </Suspense>
                      )}
                    </TextLink>
                  ) : (
                    <Muted>{live ? "Builder" : p.user_id}</Muted>
                  )}
                  {collabCount > 0 && (
                    <div className="text-xs hc-muted">
                      +{collabCount} collaborator{collabCount === 1 ? "" : "s"}
                    </div>
                  )}
                </td>
                <td>
                  <div className="flex gap-3">
                    {isSafeUrl(p.repo_url) && (
                      <TextLink href={p.repo_url} external>
                        Repo
                      </TextLink>
                    )}
                    {isSafeUrl(p.demo_url) && (
                      <TextLink href={p.demo_url} external>
                        Demo
                      </TextLink>
                    )}
                    {!isSafeUrl(p.repo_url) && !isSafeUrl(p.demo_url) && <Muted>-</Muted>}
                  </div>
                </td>
                {!live && (
                  <td className="text-sm">
                    {p.hackatime_projects?.length ? p.hackatime_projects.join(", ") : <Muted>-</Muted>}
                  </td>
                )}
                <td>
                  <Muted>
                    <Mono>{formatDate(p.created_at)}</Mono>
                  </Muted>
                </td>
              </tr>
            );
          })}
          {projects.length === 0 && (
            <EmptyRow colSpan={headers.length} title="No projects found" icon="search">
              Try a different search.
            </EmptyRow>
          )}
        </Table>
      </Card>
    </div>
  );
}
