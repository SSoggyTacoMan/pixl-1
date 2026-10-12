/* eslint-disable @next/next/no-img-element */
import { publicStats, publicGallery } from "@/lib/db";
import { GrowthChart } from "@/app/_components/GrowthChart";
import { Card, Icon, Muted, Stat, StatGrid, TextLink } from "@/app/_ui/ui";
import { config } from "@/app/_generated/config";

export const dynamic = "force-dynamic";

const SITE_URL = config.urls.site;
const SITE_HOST = new URL(SITE_URL).host;

export const metadata = {
  title: "Pixl live stats",
  description: "Ships, hours and pixels from the Pixl YSWS, live.",
};

export default async function StatsPage() {
  const [stats, gallery] = await Promise.all([publicStats(30), publicGallery(12)]);
  const n = (v: number) => v.toLocaleString("en-US");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <a href={SITE_URL} className="hc-title inline-block" style={{ color: "var(--primary)" }}>
          PIXL
        </a>
        <h1 className="hc-heading mt-2 text-xl">Live stats</h1>
        <p className="hc-caption mt-1">
          Teenagers building games, getting paid in pixels.{" "}
          <TextLink href={SITE_URL} external>
            Join in
          </TextLink>
        </p>
      </header>

      <StatGrid>
        <Stat label="Players" value={n(stats.players)} icon="people-3" />
        <Stat label="Projects approved" value={n(stats.approvedProjects)} icon="check-circle" tone="success" />
        <Stat label="In review right now" value={n(stats.inReview)} icon="view" tone="warning" />
        <Stat label="Hours of making" value={n(stats.totalHours)} icon="clock" />
        <Stat label="Pixels in circulation" value={n(stats.pixelsCirculating)} icon="grid" tone="info" />
        <Stat label="Reviews done" value={n(stats.reviews)} icon="checkmark-all" />
      </StatGrid>

      <Card>
        <GrowthChart
          title="Ships per day (last 30 days)"
          series="projects"
          kind="daily"
          points={stats.shipsSeries}
        />
      </Card>

      {gallery.length > 0 && (
        <section>
          <h2 className="hc-heading mb-4 text-base">Fresh off the press</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((p) => (
              <a
                key={p.id}
                href={p.demo_url || SITE_URL}
                target="_blank"
                rel="noreferrer"
                className="hc-card block overflow-hidden"
                data-variant="interactive"
                data-density="flush"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-36 w-full object-cover" />
                ) : (
                  <div className="hc-muted grid h-36 w-full place-items-center" style={{ background: "var(--sunken)" }}>
                    <Icon glyph="game-controller" size={40} />
                  </div>
                )}
                <div className="p-3">
                  <div className="truncate font-bold">{p.name}</div>
                  <div className="truncate text-xs hc-muted">
                    by {p.owner}
                    {p.approved_hours != null ? `, ${p.approved_hours}h` : ""}
                  </div>
                  {p.description && <div className="mt-1 line-clamp-2 text-xs hc-muted">{p.description}</div>}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="pb-6 text-center text-xs">
        <Muted>
          Updated live,{" "}
          <TextLink href={SITE_URL} external>
            {SITE_HOST}
          </TextLink>
        </Muted>
      </p>
    </div>
  );
}
