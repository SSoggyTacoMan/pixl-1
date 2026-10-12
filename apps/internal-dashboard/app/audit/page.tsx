import Link from "next/link";
import { requirePage } from "@/lib/guard";
import { listActivityFeed, type FeedItem } from "@/lib/db";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyRow,
  Icon,
  Input,
  LinkTabs,
  Muted,
  PageHeader,
  Pagination,
  Table,
  formatDateTime,
  type Tone,
} from "@/app/_ui/ui";

export const dynamic = "force-dynamic";

// How deep each source is read before the merge. Everything the filters can
// match lives inside this window - see listActivityFeed's header comment.
const DEPTH = 500;
const PER = 50;

const KINDS: { key: FeedItem["kind"]; label: string; tone: Tone }[] = [
  { key: "mod", label: "Moderation", tone: "danger" },
  { key: "review", label: "Review", tone: "info" },
  { key: "team", label: "Team & perms", tone: "warning" },
  { key: "payout", label: "Payouts", tone: "success" },
  { key: "pixels", label: "Pixels", tone: "purple" },
];

const RANGES = [
  { key: "1", label: "24h" },
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "", label: "All" },
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; days?: string; page?: string }>;
}) {
  // Everything here crosses permission boundaries - bans next to
  // a reviewer's verdicts next to permission grants - so it stays owner-only
  // rather than being assembled per-viewer like the overview widget is.
  await requirePage("owner");
  const { kind, q, days, page } = await searchParams;

  const activeKinds = KINDS.filter((k) => k.key === kind).map((k) => k.key);
  const search = (q ?? "").slice(0, 100);
  const dayRange = RANGES.some((r) => r.key === days && r.key) ? Number(days) : null;
  const since = dayRange ? new Date(Date.now() - dayRange * 86_400_000).toISOString() : undefined;

  const items = await listActivityFeed({
    mod: true,
    review: true,
    team: true,
    pixels: true,
    payouts: true,
    limit: DEPTH,
    kinds: activeKinds.length ? activeKinds : undefined,
    q: search || undefined,
    since,
  });

  const pages = Math.max(1, Math.ceil(items.length / PER));
  const cur = Math.min(Math.max(parseInt(page ?? "1", 10) || 1, 1), pages);
  const start = (cur - 1) * PER;
  const slice = items.slice(start, start + PER);

  const qp = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { kind, q: search, days, page: cur, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "" || (k === "page" && v === 1)) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/audit?${s}` : "/audit";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        count={items.length}
        description="Every moderation action, review verdict, permission change, reviewer payout and pixel movement in one stream, newest first."
      />

      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="hc-segmented w-fit" role="tablist">
            {RANGES.map((r) => (
              <Link
                key={r.key || "all"}
                href={qp({ days: r.key || undefined, page: 1 })}
                role="tab"
                aria-selected={(days ?? "") === r.key}
                className="hc-segmented-item inline-flex items-center justify-center px-3 no-underline"
              >
                {r.label}
              </Link>
            ))}
          </div>

          {/* A plain GET form so the filter survives a reload and is linkable,
              same as every other filter on this page. */}
          <form action="/audit" className="flex min-w-60 flex-1 flex-wrap items-center gap-2">
            {kind && <input type="hidden" name="kind" value={kind} />}
            {days && <input type="hidden" name="days" value={days} />}
            <div className="relative min-w-60 flex-1">
              <Icon
                glyph="search"
                size={20}
                className="hc-muted pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
              />
              <Input
                name="q"
                type="search"
                defaultValue={search}
                placeholder="Search actor, target, detail"
                className="hc-input-search"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
            {search && (
              <ButtonLink href={qp({ q: undefined, page: 1 })} variant="ghost">
                Clear
              </ButtonLink>
            )}
          </form>
        </div>

        <Card padding="flush">
          <LinkTabs
            active={kind && KINDS.some((k) => k.key === kind) ? kind : "all"}
            tabs={[
              { key: "all", href: qp({ kind: undefined, page: 1 }), label: "All" },
              ...KINDS.map((k) => ({ key: k.key, href: qp({ kind: k.key, page: 1 }), label: k.label })),
            ]}
          />
          <Table headers={["Kind", "What happened", "When"]}>
            {slice.map((i) => {
              const k = KINDS.find((x) => x.key === i.kind);
              return (
                <tr key={`${i.kind}-${i.when}-${i.text}`}>
                  <td>
                    <Badge tone={k?.tone ?? "neutral"}>{k?.label ?? i.kind}</Badge>
                  </td>
                  <td className="max-w-2xl">
                    {i.href ? (
                      <Link href={i.href} className="hc-link font-bold">
                        {i.text}
                      </Link>
                    ) : (
                      <span className="font-bold">{i.text}</span>
                    )}
                    {i.detail && <div className="mt-1 text-xs break-words"><Muted>{i.detail}</Muted></div>}
                  </td>
                  <td className="whitespace-nowrap">
                    <time dateTime={i.when}>
                      <Muted>{formatDateTime(i.when)}</Muted>
                    </time>
                  </td>
                </tr>
              );
            })}
            {slice.length === 0 && (
              <EmptyRow colSpan={3} title="Nothing matches those filters" icon="search" />
            )}
          </Table>
        </Card>

        {items.length >= DEPTH && (
          <p className="hc-caption mt-2 text-xs">Capped at the most recent {DEPTH} entries per source.</p>
        )}
        <Pagination page={cur} totalPages={pages} hrefFor={(p) => qp({ page: p })} />
      </div>
    </div>
  );
}
