import type { Metadata } from "next";
import { EmptyNote, PageHeader } from "@/components/ui/primitives";
import { serverGet } from "@/lib/server-api";
import { filtersQuery, isFiltered, parseFilters } from "./lib";
import type { ExploreProject } from "./types";
import { ProjectCard } from "./_components/project-card";
import { SearchBar } from "./_components/search-bar";
import { ExploreTabs } from "./_components/tabs";
import { sectionHeading, shipGrid } from "./styles";

export const metadata: Metadata = { title: "Explore projects" };

type Projects = { projects?: ExploreProject[] };

export default async function ExploreProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = parseFilters(await searchParams);
  const filtered = isFiltered(f);
  // GET /api/explore/projects (session, for has_upvoted) and, unfiltered,
  // GET /api/explore/showcase (session): the four newest approved ships.
  const [list, showcase] = await Promise.all([
    serverGet<Projects>(`/api/explore/projects${filtersQuery(f)}`),
    filtered ? Promise.resolve(null) : serverGet<Projects>("/api/explore/showcase"),
  ]);
  const projects = list.ok ? (list.data.projects ?? []) : [];
  const recent = showcase?.ok ? (showcase.data.projects ?? []) : [];

  return (
    <>
      <PageHeader title="PROJECTS" sub="EVERY BUILD SHIPPED ON PIXL." />
      <ExploreTabs active="projects" />

      {recent.length ? (
        <section className="mb-[26px]" aria-labelledby="ex-recent">
          <h2 id="ex-recent" className={sectionHeading}>
            JUST SHIPPED
          </h2>
          <div className={shipGrid}>
            {recent.map((p) => (
              <ProjectCard key={`s${p.id}`} p={p} canVote={false} />
            ))}
          </div>
        </section>
      ) : null}

      <SearchBar initial={{ q: f.q, tier: f.tier, shipped: f.shipped }} placeholder="Find a project..." filters />

      {!list.ok ? (
        <EmptyNote>COULDN&apos;T LOAD PROJECTS. TRY AGAIN IN A BIT.</EmptyNote>
      ) : projects.length === 0 ? (
        <EmptyNote>{filtered ? "NO PROJECTS MATCH THOSE FILTERS." : "NO PROJECTS YET, GO MAKE THE FIRST ONE!"}</EmptyNote>
      ) : (
        <div className={shipGrid}>
          {projects.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </>
  );
}
