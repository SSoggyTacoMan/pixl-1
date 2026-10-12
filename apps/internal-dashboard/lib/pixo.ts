// Where the dashboard reaches Pixo (apps/pixorpheus) for DMs, ticket resolves,
// review-channel posts and shop notifications. Both run in the same Orchard
// namespace, so the default is Pixo's in-cluster service address: the call
// never leaves the cluster and never depends on a public hostname.
// PIXORPHEUS_URL / EXTERNAL_DM_URL / EXTERNAL_TICKETS_URL still override it.
export const PIXO_INTERNAL_URL = "http://pixl-pixorpheus.ysws-pixl.svc.cluster.local:3000";

export function pixorpheusUrl(): string {
  return (process.env.PIXORPHEUS_URL || PIXO_INTERNAL_URL).replace(/\/+$/, "");
}

export function externalDmUrl(): string {
  return process.env.EXTERNAL_DM_URL || `${pixorpheusUrl()}/api/external/dm`;
}

export function externalTicketsUrl(): string {
  return (process.env.EXTERNAL_TICKETS_URL || `${pixorpheusUrl()}/api/external/tickets`).replace(/\/+$/, "");
}
