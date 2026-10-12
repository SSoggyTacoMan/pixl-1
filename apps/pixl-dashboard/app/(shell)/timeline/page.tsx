import type { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import { SEED_NODES, kindClass, outcomeParts, revealCut, type StoryNode } from "./timeline-lib";
import "./timeline.css";

export const metadata: Metadata = { title: "The Chronicle" };

function Node({ n, index }: { n: StoryNode; index: number }) {
  const dur = n.duration || n.dur;
  const quote = n.quote || n.q;
  return (
    <div className={`node ${kindClass(n.kind)}`} style={{ animationDelay: `${Math.min(index * 70, 700)}ms` }}>
      <div className="seal">
        <span>{n.seal || "◆"}</span>
      </div>
      <div className="card">
        <div className="card-bar">
          {n.tag || ""}
          {dur ? <span className="dur">{dur}</span> : null}
        </div>
        <div className="card-body">
          <h2>{n.title}</h2>
          <p>
            {quote ? <span className="q">&ldquo;{quote}&rdquo; </span> : null}
            {n.body ?? ""}
          </p>
          {n.outcome ? (
            <div className="outcome">
              <span className="lbl">OUTCOME</span>
              <span>
                {outcomeParts(n.outcome).map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LockedNode() {
  return (
    <div className="node locked">
      <div className="seal">
        <span />
      </div>
      <div className="card">
        <div className="card-bar">
          SEALED<span className="dur">SOON</span>
        </div>
        <div className="card-body">
          <h2>The story continues…</h2>
          <p>
            The next page of the Chronicle has not been written yet. Return as the season unfolds: a new Chapter is
            revealed the moment it begins.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function TimelinePage() {
  // Dashboard-authored nodes; the seed content stands in if the API is
  // unreachable or empty, same as the old page.
  const d = await serverApi<{ nodes?: StoryNode[] }>("/api/story");
  const nodes = d && Array.isArray(d.nodes) && d.nodes.length ? d.nodes : SEED_NODES;
  const cut = revealCut(nodes);
  const shown = nodes.slice(0, cut + 1);

  return (
    <div className="chron-page">
      <div className="chron">
        <section className="chron-hero">
          <div className="eyebrow">SEASON ONE</div>
          <h1 className="chron-title">
            THE CHRONICLE<span className="thin">OF PIXL</span>
          </h1>
          <p className="chron-intro">
            Origin was the greatest digital civilization ever built, until the Core overloaded and{" "}
            <b>The Great Static</b> shattered it into islands adrift in the Void. Builders were called across universes
            to rebuild it, one Chapter at a time. <b>The Chronicle writes itself as the season unfolds</b>: return each
            week to read what has been uncovered.
          </p>
          <div className="ornament">
            <span>◆</span>
          </div>
        </section>

        <div className="rail">
          {shown.map((n, i) => (
            <Node key={n.id ?? i} n={n} index={i} />
          ))}
          {cut + 1 < nodes.length ? <LockedNode /> : null}
        </div>
      </div>
    </div>
  );
}
