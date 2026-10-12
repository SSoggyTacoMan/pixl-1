"use server";

// Journal, collaborator, import and Operation Blackout actions. One
// apps/server endpoint per action, all through guardedAction.
import { z } from "zod";
import { guardedAction, json } from "@/lib/guarded-action";

const pid = z.coerce.number().int().positive().max(2_147_483_647);
// Collaborator / journal ids: bigint-as-string or uuid. Encoded into the path.
const rowId = z.union([z.number().int().positive(), z.string().regex(/^[A-Za-z0-9-]{1,64}$/)]).transform(String);
const enc = encodeURIComponent;

// ---- journal ---------------------------------------------------------------

const entry = z.object({
  title: z.string().trim().max(120),
  content: z.string().trim().min(1).max(5000),
  hours: z.number().min(0).max(100),
});

export const postJournal = guardedAction(
  "journal.create",
  z.object({ projectId: pid, entry }),
  ({ projectId, entry: body }) => ({
    method: "POST",
    path: `/api/projects/${projectId}/journal`,
    body: json(body),
    target: `project:${projectId}`,
  }),
  { revalidate: ["/projects"], pick: () => ({ posted: true }) },
);

export const editJournal = guardedAction(
  "journal.update",
  z.object({ projectId: pid, entryId: rowId, entry }),
  ({ projectId, entryId, entry: body }) => ({
    method: "PATCH",
    path: `/api/projects/${projectId}/journal/${enc(entryId)}`,
    body: json(body),
    target: `journal:${entryId}`,
  }),
  { revalidate: ["/projects"], pick: () => ({ saved: true }) },
);

export const deleteJournal = guardedAction(
  "journal.delete",
  z.object({ projectId: pid, entryId: rowId }),
  ({ projectId, entryId }) => ({
    method: "DELETE",
    path: `/api/projects/${projectId}/journal/${enc(entryId)}`,
    target: `journal:${entryId}`,
  }),
  { revalidate: ["/projects"], pick: () => ({ deleted: true }) },
);

// ---- collaborators ---------------------------------------------------------

export const searchPlayers = guardedAction(
  "players.search",
  z.object({ q: z.string().trim().min(2).max(64) }),
  ({ q }) => ({ method: "GET", path: `/api/players/search?q=${enc(q)}` }),
  {
    pick: (d: { players?: { userId: string; name: string }[] }) =>
      (d?.players ?? []).slice(0, 20).map((p) => ({ userId: String(p.userId), name: String(p.name) })),
  },
);

export const inviteCollaborator = guardedAction(
  "collab.invite",
  z.object({ projectId: pid, userId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }),
  ({ projectId, userId }) => ({
    method: "POST",
    path: `/api/projects/${projectId}/collaborators/invite`,
    body: json({ userId }),
    target: `project:${projectId}`,
  }),
  { revalidate: ["/projects"], pick: () => ({ invited: true }) },
);

export const removeCollaborator = guardedAction(
  "collab.remove",
  z.object({ collabId: rowId }),
  ({ collabId }) => ({ method: "POST", path: `/api/collaborators/${enc(collabId)}/remove`, target: `collab:${collabId}` }),
  { revalidate: ["/projects"], pick: () => ({ removed: true }) },
);

export const generateJoinCode = guardedAction(
  "collab.code",
  z.object({ projectId: pid }),
  ({ projectId }) => ({
    method: "POST",
    path: `/api/projects/${projectId}/collaborators/code`,
    target: `project:${projectId}`,
  }),
  { revalidate: ["/projects"], pick: (d: { code?: unknown }) => ({ code: typeof d?.code === "string" ? d.code : "" }) },
);

// Owner only (apps/server enforces it): replaces the join code so an old,
// leaked code stops working. Collaborators never see the code at all
// (apps/server sends join_code: null to non-owners).
export const rotateJoinCode = guardedAction(
  "collab.code_rotate",
  z.object({ projectId: z.number().int().positive().max(2_147_483_647) }),
  ({ projectId }) => ({
    method: "POST",
    path: `/api/projects/${projectId}/collaborators/code/rotate`,
    target: `project:${projectId}`,
  }),
  { revalidate: ["/projects"], pick: (d: { code?: unknown }) => ({ code: typeof d?.code === "string" ? d.code : "" }) },
);

export const acceptInvite = guardedAction(
  "collab.accept",
  z.object({ collabId: rowId }),
  ({ collabId }) => ({ method: "POST", path: `/api/collaborators/${enc(collabId)}/accept`, target: `collab:${collabId}` }),
  { revalidate: ["/projects"], pick: () => ({ accepted: true }) },
);

export const declineInvite = guardedAction(
  "collab.decline",
  z.object({ collabId: rowId }),
  ({ collabId }) => ({ method: "POST", path: `/api/collaborators/${enc(collabId)}/decline`, target: `collab:${collabId}` }),
  { revalidate: ["/projects"], pick: () => ({ declined: true }) },
);

export const redeemJoinCode = guardedAction(
  "collab.redeem",
  z.object({ code: z.string().trim().min(1).max(64) }),
  ({ code }) => ({ method: "POST", path: "/api/collaborators/redeem", body: json({ code }) }),
  { revalidate: ["/projects"], pick: (d: { projectName?: unknown }) => ({ projectName: String(d?.projectName ?? "") }) },
);

export const saveCollabHackatime = guardedAction(
  "collab.hackatime",
  z.object({ collabId: rowId, hackatimeProjects: z.array(z.string().max(200)).max(200) }),
  ({ collabId, hackatimeProjects }) => ({
    method: "PUT",
    path: `/api/collaborators/${enc(collabId)}/hackatime`,
    body: json({ hackatimeProjects }),
    target: `collab:${collabId}`,
  }),
  { revalidate: ["/projects"], pick: () => ({ saved: true }) },
);

// ---- imports ---------------------------------------------------------------

const imported = (d: { project?: { id?: unknown }; journalsImported?: unknown }) => ({
  id: Number(d?.project?.id),
  journalsImported: Number(d?.journalsImported) || 0,
});

export const importYsws = guardedAction(
  "project.import_ysws",
  z.object({ entryId: z.string().trim().min(1).max(128) }),
  ({ entryId }) => ({ method: "POST", path: "/api/projects/import-ysws", body: json({ entryId }) }),
  { revalidate: ["/projects"], pick: imported },
);

export const importMacondo = guardedAction(
  "project.import_macondo",
  z.object({ ref: z.string().trim().min(1).max(256) }),
  ({ ref }) => ({ method: "POST", path: "/api/projects/import-macondo", body: json({ ref }) }),
  { revalidate: ["/projects"], pick: imported },
);

// ---- Operation Blackout ----------------------------------------------------

const SLUG = "operation-blackout";

export const enterBlackout = guardedAction(
  "operation.enter",
  z.object({ projectId: pid }),
  ({ projectId }) => ({
    method: "POST",
    path: `/api/operations/${SLUG}/entries`,
    body: json({ projectId }),
    target: `project:${projectId}`,
  }),
  { revalidate: ["/projects"], pick: () => ({ entered: true }) },
);

export const leaveBlackout = guardedAction(
  "operation.withdraw",
  z.object({ projectId: pid }),
  ({ projectId }) => ({
    method: "DELETE",
    path: `/api/operations/${SLUG}/entries/${projectId}`,
    target: `project:${projectId}`,
  }),
  { revalidate: ["/projects"], pick: () => ({ withdrawn: true }) },
);
