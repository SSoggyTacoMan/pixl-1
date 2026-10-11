import { EmptyNote } from "@/components/ui/primitives";
import { rankClass, rankLabel } from "../lib";

interface Row {
  rank: number;
  display_name: string;
  value: number;
  pixels?: number;
  you?: boolean;
}

const fmt = (n: unknown) => Math.max(0, Number(n) || 0).toLocaleString("en-US");

export function BoardRows({
  rows,
  unit,
  empty,
  showPixels = false,
  plainRanks = false,
}: {
  rows: Row[];
  unit: string;
  empty?: string;
  showPixels?: boolean;
  plainRanks?: boolean;
}) {
  if (rows.length === 0) return empty ? <EmptyNote>{empty}</EmptyNote> : null;
  const px = unit === "PX";
  return (
    <ol className="board">
      {rows.map((p) => (
        <li
          key={`${p.rank}-${p.display_name}`}
          className={`board-row ${plainRanks ? "" : rankClass(p.rank)}${p.you ? " you" : ""}`}
        >
          <span className="rank">{rankLabel(p.rank)}</span>
          <span className="bname">
            {p.display_name}
            {p.you ? <span className="gold"> ← YOU</span> : null}
          </span>
          <span className={`bpx${px ? " px" : ""}`}>
            {px ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/img/pixel.png" alt="" />
            ) : null}
            {fmt(p.value)} {unit}
            {showPixels && p.pixels != null ? <span className="faint ml-1.5 text-[11px]">{fmt(p.pixels)} PX earned</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function YouCard({ rank, value, unit, climb }: { rank?: number; value?: number; unit: string; climb: string }) {
  return (
    <div className="you-card panel">
      <span className="gold">YOUR STANDING</span>
      <span>{rank ? rankLabel(rank) : "UNRANKED"}</span>
      <span className={unit === "PX" ? "gold" : "teal"}>
        {fmt(value)} {unit}
      </span>
      <span className="faint text-xs">{climb}</span>
    </div>
  );
}
