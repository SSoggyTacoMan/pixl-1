// Display pieces of /vault. All server-rendered, no interaction.
import { SEGMENTS, filledSegments, fmt, hasTopReward, type VaultData, type VaultLevel } from "./vault-lib";

export function Gauge({ data }: { data: VaultData }) {
  const { energy, levels, nextRequired, currentLevel } = data;
  const pending = data.pendingEnergy || 0;
  const filled = filledSegments(data);
  return (
    <section className="gauge">
      <div className="gauge-eyebrow">RESTORATION ENERGY</div>
      <div className="gauge-num">
        {fmt(energy)} <small>COMMUNITY TOTAL</small>
      </div>
      {pending > 0 ? (
        <div className="gauge-pending">
          +<b>{fmt(pending)}</b> RE in review, passed first pass, awaiting final confirmation
        </div>
      ) : null}
      {nextRequired ? (
        <div className="gauge-next">
          <b>{fmt(nextRequired - energy)}</b> more to recover <b>Vault Level {currentLevel + 1}</b>
        </div>
      ) : levels.length ? (
        <div className="gauge-next">
          <b>Vault fully recovered.</b> Every chamber is open.
        </div>
      ) : null}
      <div className="segbar" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <div key={i} className={`seg${i < filled ? " on" : ""}`} />
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
    <div className="lb-card">
      <div className="lb-head">THIS CHAPTER&apos;S TOP RESTORERS</div>
      <div className="lb-sub">
        {reward
          ? `Top 3 when this chapter's Vault level unlocks get bonus RE: +${fmt(reward.first)} / +${fmt(reward.second)} / +${fmt(reward.third)}`
          : "Ship the most Restoration Energy this chapter to top the list."}
      </div>
      <div>
        {board.map((p, i) => (
          <div key={i} className="lb-row">
            <span className="lb-rank">#{i + 1}</span>
            <span className="lb-name">{p.displayName}</span>
            <span className="lb-re">{fmt(p.re)} RE</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Chamber({ level: l, energy, index }: { level: VaultLevel; energy: number; index: number }) {
  const winners = l.winners ?? [];
  return (
    <div className={`chamber panel ${l.unlocked ? "on" : "off"}`} style={{ animationDelay: `${Math.min(index * 70, 600)}ms` }}>
      <div className="ch-seal">
        <span className="lv-word">VAULT LV</span>
        <span className="lv-num">{l.level}</span>
        <span className="lv-state">{l.unlocked ? "UNLOCKED" : "LOCKED"}</span>
      </div>
      <div className="ch-body">
        <div className="ch-head">
          <span className="ch-title">{l.title}</span>
          <span className={`v-stamp ${l.unlocked ? "on" : "off"}`}>{l.unlocked ? "RECOVERED" : "SEALED"}</span>
        </div>
        <div className="ch-blurb">{l.blurb}</div>
        <div className="rewards">
          <span className="rw energy">{fmt(l.energyRequired)}</span>
          {(l.rewards ?? []).map((r, i) => (
            <span key={i} className="rw">
              {String(r?.icon ?? "")} {String(r?.label ?? "")}
            </span>
          ))}
        </div>
        {!l.unlocked ? (
          <div className="ch-need">◆ {fmt(Math.max(0, l.energyRequired - energy))} more energy to recover</div>
        ) : null}
        {winners.length ? (
          <div className="winners">
            {winners.map((w) => (
              <span key={w.rank} className="win-chip">
                #{w.rank} {w.displayName} +{fmt(w.re)} RE
              </span>
            ))}
          </div>
        ) : hasTopReward(l.topReward) ? (
          <div className="top-reward">
            <span className="tr-chip">
              Top restorer: <b>+{fmt(l.topReward.first)} RE</b>
            </span>
            <span className="tr-chip">
              #2: <b>+{fmt(l.topReward.second)} RE</b>
            </span>
            <span className="tr-chip">
              #3: <b>+{fmt(l.topReward.third)} RE</b>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
