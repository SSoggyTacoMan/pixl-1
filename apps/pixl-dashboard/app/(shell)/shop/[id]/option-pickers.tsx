"use client";

import { safeHttpUrl } from "@/lib/safe-url";
import type { ConfigPicks, ShopItem } from "../shop-lib";
import { optionGroups, stockGroupIndex, stockMap } from "./item-lib";

/** Plain options ("Size: S, M"), with live per-choice stock where tracked. */
export function PlainOptions({
  item,
  picks,
  onPick,
}: {
  item: ShopItem;
  picks: Record<number, string>;
  onPick: (group: number, choice: string) => void;
}) {
  const groups = optionGroups(item);
  const stock = stockMap(item);
  const sIdx = stockGroupIndex(groups, stock);
  if (!groups.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g, gi) => (
        <div className="opt-group" key={gi}>
          {g.name ? <div className="opt-group-name">{g.name.toUpperCase()}</div> : null}
          <div className="opt-choices">
            {g.choices.map((c) => {
              const s = gi === sIdx ? stock.get(c) : undefined;
              const soldOut = !!s && s.remaining <= 0;
              return (
                <button
                  type="button"
                  key={c}
                  className={`chip opt-choice${picks[gi] === c ? " on" : ""}${soldOut ? " sold-out" : ""}`}
                  disabled={soldOut}
                  aria-pressed={picks[gi] === c}
                  onClick={() => onPick(gi, c)}
                >
                  {c.toUpperCase()}
                  {s ? <span className="stock-tag">{soldOut ? "SOLD OUT" : `${s.remaining} LEFT`}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Price-varying configurator (Framework DIY etc.). */
export function Configurator({
  item,
  picks,
  onChange,
}: {
  item: ShopItem;
  picks: ConfigPicks;
  onChange: (next: ConfigPicks) => void;
}) {
  const cfg = item.config_options;
  if (!cfg) return null;
  const ref = safeHttpUrl(cfg.reference_url);
  return (
    <div className="flex flex-col gap-3">
      {ref ? (
        <div className="cfg-ref-note">
          Want the exact spec sheet?{" "}
          <a href={ref} target="_blank" rel="noopener noreferrer">
            Check the real configurator ↗
          </a>{" "}
          then pick the matching options below.
        </div>
      ) : null}
      {(cfg.groups ?? []).map((g) => {
        const multi = g.type === "multi";
        const chosen = multi
          ? new Set((picks[g.name] as string[] | undefined) ?? [])
          : new Set([(picks[g.name] as string | undefined) ?? g.choices[0]?.label]);
        return (
          <div className="opt-group" key={g.name}>
            <div className="opt-group-name">
              {g.name.toUpperCase()}
              {multi ? " (pick any)" : ""}
            </div>
            <div className="opt-choices">
              {g.choices.map((c) => (
                <button
                  type="button"
                  key={c.label}
                  className={`chip opt-choice${chosen.has(c.label) ? " on" : ""}`}
                  aria-pressed={chosen.has(c.label)}
                  onClick={() => {
                    if (multi) {
                      const set = new Set(chosen);
                      if (set.has(c.label)) set.delete(c.label);
                      else set.add(c.label);
                      onChange({ ...picks, [g.name]: [...set] });
                    } else {
                      onChange({ ...picks, [g.name]: c.label });
                    }
                  }}
                >
                  {c.label}
                  {c.price ? <span className="cfg-delta">+{c.price}px</span> : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
