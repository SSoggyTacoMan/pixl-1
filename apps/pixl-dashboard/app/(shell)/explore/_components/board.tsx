import { EmptyNote, panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { rankLabel } from "../lib";

interface Row {
  rank: number;
  display_name: string;
  value: number;
  pixels?: number;
  you?: boolean;
}

const fmt = (n: unknown) => Math.max(0, Number(n) || 0).toLocaleString("en-US");

// Podium colours for ranks 1-3 (rankClass in ../lib names the same tiers).
const RANK_TONE: Record<number, string> = { 1: "text-gold", 2: "text-[#8a8f96]", 3: "text-[#b5763a]" };

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
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((p) => (
        <li
          key={`${p.rank}-${p.display_name}`}
          className={cn(
            "flex items-center gap-4 border-2 border-stroke bg-panel px-[18px] pt-3 pb-2.5 text-base",
            p.you && "border-gold",
          )}
        >
          <span className={cn("w-[52px] text-lg text-faint", !plainRanks && RANK_TONE[p.rank])}>{rankLabel(p.rank)}</span>
          <span className="min-w-0 flex-1 truncate">
            {p.display_name}
            {p.you ? <span className="text-gold"> ← YOU</span> : null}
          </span>
          <span className={cn("flex flex-wrap items-center justify-end gap-1.5", px ? "text-gold" : "text-ink")}>
            {px ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/img/pixel.png" alt="" className="size-[15px]" />
            ) : null}
            {fmt(p.value)} {unit}
            {showPixels && p.pixels != null ? (
              <span className="ml-1.5 text-[11px] text-faint">{fmt(p.pixels)} PX earned</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function YouCard({ rank, value, unit, climb }: { rank?: number; value?: number; unit: string; climb: string }) {
  return (
    <div className={cn(panel, "mt-4 flex flex-wrap items-center gap-5 px-[18px] py-3.5 text-[15px]")}>
      <span className="text-gold">YOUR STANDING</span>
      <span>{rank ? rankLabel(rank) : "UNRANKED"}</span>
      <span className={unit === "PX" ? "text-gold" : "text-teal"}>
        {fmt(value)} {unit}
      </span>
      <span className="text-xs text-faint">{climb}</span>
    </div>
  );
}
