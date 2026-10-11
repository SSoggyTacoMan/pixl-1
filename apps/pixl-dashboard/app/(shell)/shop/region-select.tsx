"use client";

import { useState } from "react";
import { useAction } from "@/components/use-action";
import { setRegion } from "./actions";
import { REGIONS } from "./shop-lib";

/** Which catalog the player shops from. The action revalidates /shop. */
export function RegionSelect({ region }: { region: string }) {
  const [value, setValue] = useState(region);
  const { run, pending, error } = useAction(setRegion);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    const r = await run({ region: next });
    if (!r.ok) setValue(prev);
  }

  return (
    <div className="region-select">
      <select
        className="field"
        value={value}
        disabled={pending}
        title="Your region: sets which catalog you shop from"
        aria-label="Region"
        onChange={(e) => change(e.target.value)}
      >
        {REGIONS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {error ? <span className="region-err" role="alert">Couldn&apos;t switch region.</span> : null}
    </div>
  );
}
