// The raffle-ticket player card from the old profile view. Every number is
// what apps/server returned (level, RE, approved hours, pixels); the XP fill
// bar from the old page is left out because it needed the level-band
// formula client side.
import { classForLevel, joinedYear } from "../lib";
import type { PlayerProfile } from "../types";
import { Avatar } from "./avatar";

const fmt = (n: unknown) => Math.round(Number(n) || 0).toLocaleString("en-US");

export function Ticket({ p, projectCount }: { p: PlayerProfile["player"]; projectCount: number }) {
  const year = joinedYear(p.created_at);
  return (
    <div className="pt-frame">
      <div className="pt-head">
        <span className="tname">{p.display_name}</span>
      </div>
      <div className="pt-avatar">
        <Avatar name={p.display_name} url={p.avatar_url} />
      </div>
      <Stat cls="ts-level" label="LEVEL" value={String(p.level ?? 1)} />
      <Stat cls="ts-hours" label="HOURS" value={`${Number(p.xp_hours || 0).toFixed(0)}h`} />
      <Stat cls="ts-proj" label="PROJECTS" value={String(projectCount)} />
      <Stat cls="ts-joined" label="JOINED" value={year} />
      <div className="pt-currency">
        <div className="tc-row tc-re">× {fmt(p.re)} RE</div>
        <div className="tc-row tc-px">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/pixel_currency.png" alt="" />
          {fmt(p.pixels)}
        </div>
      </div>
      <div className="pt-foot">
        <div className="tf-class">CLASS: {classForLevel(p.level)}</div>
        <div className="tf-sub">PIXELIAN · MEMBER SINCE {year}</div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pt-sticker sticker-red" src="/img/sticker_currency_red.png" alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pt-sticker sticker-gold" src="/img/sticker_currency_gold.png" alt="" />
    </div>
  );
}

function Stat({ cls, label, value }: { cls: string; label: string; value: string }) {
  return (
    <div className={`pt-stat ${cls}`}>
      <span className="tlabel">{label}</span>
      <span className="tval">{value}</span>
    </div>
  );
}
