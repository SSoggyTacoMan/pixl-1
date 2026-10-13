// Display pieces of /vault. All server-rendered, no interaction.
import { panel } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { SEGMENTS, filledSegments, fmt, hasTopReward, type VaultData, type VaultLevel } from "./vault-lib";

const gaugeNext = "mt-[4px] text-[14px] text-dim";
const rankColor = ["text-gold", "text-teal", "text-gold-soft"];
const smallChip = "border border-stroke px-[8px] pt-[4px] pb-[3px] text-[12px]";

export function Gauge({ data }: { data: VaultData }) {
  const { energy, levels, nextRequired, currentLevel } = data;
  const pending = data.pendingEnergy || 0;
  const filled = filledSegments(data);
  return (
    <section className={cn(panel, "relative mt-[14px] overflow-hidden px-[26px] py-[24px]")}>
      <div className="mb-[8px] font-pixel text-[12px] tracking-[4px] text-teal">RESTORATION ENERGY</div>
      <div className="font-pixel text-[length:clamp(38px,8vw,64px)] leading-none text-gold">
        {fmt(energy)}{" "}
        <small className="mt-[8px] block font-pixel text-[.28em] tracking-[3px] text-teal">COMMUNITY TOTAL</small>
      </div>
      {pending > 0 ? (
        <div className="mt-[2px] text-[13px] text-teal">
          +<b>{fmt(pending)}</b> RE in review, passed first pass, awaiting final confirmation
        </div>
      ) : null}
      {nextRequired ? (
        <div className={gaugeNext}>
          <b className="text-gold-soft">{fmt(nextRequired - energy)}</b> more to recover{" "}
          <b className="text-gold-soft">Vault Level {currentLevel + 1}</b>
        </div>
      ) : levels.length ? (
        <div className={gaugeNext}>
          <b className="text-gold-soft">Vault fully recovered.</b> Every chamber is open.
        </div>
      ) : null}
      <div className="mt-[18px] flex h-[24px] gap-[3px]" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div
            key={i}
            className={cn("flex-1 border-2 border-stroke", i < filled ? "bg-teal" : "bg-panel-deep")}
          />
        ))}
      </div>
    </section>
  );
}

export function Leaderboard({ data }: { data: VaultData }) {
  const board = data.chapterLeaderboard ?? [];
  if (!board.length) return null;
  const next = data.levels.find((l) => !l.unlocked);
  const reward = next?.topReward;
  return (
    <div className={cn(panel, "mt-[22px] px-[20px] py-[18px]")}>
      <div className="mb-[4px] font-pixel text-[13px] tracking-[2px] text-teal">THIS CHAPTER&apos;S TOP RESTORERS</div>
      <div className="mb-[14px] text-[13px] text-dim">
        {reward
          ? `Top 3 when this chapter's Vault level unlocks get bonus RE: +${fmt(reward.first)} / +${fmt(reward.second)} / +${fmt(reward.third)}`
          : "Ship the most Restoration Energy this chapter to top the list."}
      </div>
      <div>
        {board.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-[10px] border-t border-stroke py-[7px] first:border-t-0"
          >
            <span className={cn("w-[26px] text-center font-pixel text-[14px] text-faint", rankColor[i])}>#{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[14px]">{p.displayName}</span>
            <span className="font-pixel text-[13px] text-gold">{fmt(p.re)} RE</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Chamber({ level: l, energy, index }: { level: VaultLevel; energy: number; index: number }) {
  const winners = l.winners ?? [];
  const on = !!l.unlocked;
  const rw = cn(
    "inline-flex items-center gap-[6px] border-2 border-stroke bg-panel-deep px-[10px] pt-[5px] pb-[4px] text-[13px] text-ink",
    !on && "text-faint",
  );
  return (
    <div
      className={cn(
        panel,
        "relative flex animate-vault-rise overflow-hidden motion-reduce:animate-none",
        on
          ? "hover:-translate-x-[2px] hover:-translate-y-[2px] hover:border-teal hover:shadow-drop"
          : "opacity-78 brightness-[.97] saturate-[.7]",
      )}
      style={{ animationDelay: `${Math.min(index * 70, 600)}ms` }}
    >
      <div
        className={cn(
          "flex w-[108px] shrink-0 flex-col items-center justify-center gap-[4px] border-r-2 border-stroke font-pixel max-[560px]:w-[76px]",
          on ? "bg-teal text-panel-deep" : "bg-panel-deep text-faint",
        )}
      >
        <span className="text-[10px] tracking-[3px]">VAULT LV</span>
        <span className="text-[40px] leading-none max-[560px]:text-[30px]">{l.level}</span>
        <span className={cn("font-sans text-[15px]", !on && "opacity-80")}>{on ? "UNLOCKED" : "LOCKED"}</span>
      </div>
      <div className="min-w-0 flex-1 px-[20px] py-[16px]">
        <div className="mb-[7px] flex flex-wrap items-center gap-[10px]">
          <span className={cn("font-pixel text-[21px] tracking-[1px]", on ? "text-gold" : "text-dim")}>{l.title}</span>
          <span
            className={cn(
              "ml-auto border-2 px-[9px] pt-[4px] pb-[3px] font-pixel text-[11px] tracking-[2px]",
              on ? "border-teal bg-[rgba(82,174,185,.10)] text-teal" : "border-faint text-faint",
            )}
          >
            {on ? "RECOVERED" : "SEALED"}
          </span>
        </div>
        <div className={cn("mb-[12px] text-[14.5px] leading-[1.6] whitespace-pre-wrap", on ? "text-dim" : "text-faint")}>
          {l.blurb}
        </div>
        <div className="flex flex-wrap gap-[8px]">
          <span className={cn(rw, "border-[rgba(236,72,153,.4)]", on && "text-gold")}>{fmt(l.energyRequired)}</span>
          {(l.rewards ?? []).map((r, i) => (
            <span key={i} className={rw}>
              {String(r?.icon ?? "")} {String(r?.label ?? "")}
            </span>
          ))}
        </div>
        {!on ? (
          <div className="mt-[10px] text-[12.5px] tracking-[.5px] text-teal">
            ◆ {fmt(Math.max(0, l.energyRequired - energy))} more energy to recover
          </div>
        ) : null}
        {winners.length ? (
          <div className="mt-[10px] flex flex-wrap gap-[6px]">
            {winners.map((w) => (
              <span
                key={w.rank}
                className="border border-teal bg-[rgba(82,174,185,.08)] px-[8px] pt-[4px] pb-[3px] text-[12px] text-teal"
              >
                #{w.rank} {w.displayName} +{fmt(w.re)} RE
              </span>
            ))}
          </div>
        ) : hasTopReward(l.topReward) ? (
          <div className={cn("mt-[10px] flex flex-wrap gap-[6px]", !on && "opacity-80")}>
            <span className={cn(smallChip, "text-dim")}>
              Top restorer: <b className="text-gold">+{fmt(l.topReward.first)} RE</b>
            </span>
            <span className={cn(smallChip, "text-dim")}>
              #2: <b className="text-gold">+{fmt(l.topReward.second)} RE</b>
            </span>
            <span className={cn(smallChip, "text-dim")}>
              #3: <b className="text-gold">+{fmt(l.topReward.third)} RE</b>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
