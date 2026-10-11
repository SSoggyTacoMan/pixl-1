import type { Metadata } from "next";
import { serverApi } from "@/lib/server-api";
import { CalcForm, ProjectPicker, type CalcInputs, type ProjectOption } from "./calc-form";
import { TIERS, clampHours, clampTier, economy, payoutStats, type PayoutStats } from "./economy";
import "./calc.css";

export const metadata: Metadata = { title: "Payout calculator" };

interface Project {
  id: string | number;
  name: string;
  status?: string;
  level?: number | null;
}

type Search = { hours?: string; tier?: string; base?: string; project?: string };

function Stats({ s }: { s: PayoutStats }) {
  return (
    <div className="out-row">
      <div className="out">
        <div className="out-k">Pixels</div>
        <div className="out-v gold">{s.px.toLocaleString("en-US")}</div>
      </div>
      <div className="out">
        <div className="out-k">RE Earned</div>
        <div className="out-v teal">{s.re.toLocaleString("en-US")} RE</div>
      </div>
      <div className="out">
        <div className="out-k">Avg $/hr</div>
        <div className="out-v">{s.avgUsdPerHour === null ? "-" : `$${s.avgUsdPerHour.toFixed(2)}`}</div>
      </div>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CalcPage({ searchParams }: { searchParams: Promise<Record<keyof Search, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const projectId = /^\d{1,18}$/.test(one(sp.project) ?? "") ? one(sp.project)! : "";

  const [wallet, list, tracked] = await Promise.all([
    serverApi<{ re?: number }>("/api/profile/wallet"),
    serverApi<{ projects?: Project[] }>("/api/projects"),
    projectId ? serverApi<{ trackedSeconds?: number }>(`/api/projects/${projectId}/hours`) : Promise.resolve(null),
  ]);
  const baseRe = wallet ? Number(wallet.re) || 0 : 0;

  // Approved projects are already paid and on record, not a prediction.
  const mine = (list?.projects ?? []).filter((p) => p.status !== "approved");
  const picked = mine.find((p) => String(p.id) === projectId) ?? null;
  const options: ProjectOption[] = mine.map((p) => ({
    id: String(p.id),
    label: `${p.name} · ${TIERS[clampTier(p.level ?? 1) - 1]}`,
  }));

  // A picked project with hours loaded seeds the inputs from its own tracked
  // hours and tier unless the URL already overrides them.
  const pickedHours =
    picked && tracked && typeof tracked.trackedSeconds === "number"
      ? Math.round((tracked.trackedSeconds / 3600) * 100) / 100
      : null;
  const pickedTier = picked ? clampTier(picked.level ?? 1) : null;

  const hoursRaw = one(sp.hours);
  const tierRaw = one(sp.tier);
  const inputs: CalcInputs = {
    hours: hoursRaw !== undefined ? clampHours(hoursRaw) : (pickedHours ?? 10),
    tier: tierRaw !== undefined ? clampTier(tierRaw) : (pickedTier ?? 1),
    base: one(sp.base) === "1" && !!wallet,
    project: picked ? String(picked.id) : "",
  };
  const reBefore = inputs.base ? baseRe : 0;
  const stats = payoutStats(inputs.hours, inputs.tier, reBefore);
  const mineStats = picked && pickedHours !== null && pickedTier !== null ? payoutStats(pickedHours, pickedTier, baseRe) : null;

  return (
    <div className="calc-page">
      <section className="calc-hero">
        <h1 className="page-title">PAYOUT CALCULATOR</h1>
        <div className="page-sub">SEE WHAT A SHIP IS WORTH BEFORE YOU SHIP IT.</div>
        {/* eslint-disable @next/next/no-img-element */}
        <img className="hero-sticker sticker-gold-sm" src="/img/sticker_currency_gold.png" alt="" />
        <img className="hero-sticker sticker-gold-lg" src="/img/sticker_currency_gold.png" alt="" />
        <img className="hero-sticker sticker-red" src="/img/sticker_currency_red.png" alt="" />
        <img className="hero-sticker sticker-blahaj" src="/img/sticker_blahaj.png" alt="" draggable={false} />
        {/* eslint-enable @next/next/no-img-element */}
      </section>

      {options.length ? (
        <div className="calc-card mine-card">
          <div className="card-h">PREDICT ONE OF YOUR PROJECTS</div>
          <div className="form-row">
            <div className="lbl">Pick a project</div>
            <ProjectPicker value={inputs.project} options={options} inputs={inputs} />
          </div>
          {picked && !mineStats ? <div className="mini-note bad">Couldn&apos;t load that project&apos;s tracked hours.</div> : null}
          {mineStats ? <Stats s={mineStats} /> : null}
          <div className="mini-note">
            This is NOT your final payout. It&apos;s a live prediction off your currently tracked hours, and your hours may
            get deflated on review, which would lower the actual payout.
          </div>
        </div>
      ) : null}

      <div className="calc-card">
        <div className="card-h">A NEW PROJECT</div>
        <div className="note rate-note">
          Rate ramps linearly from <b>${economy.basePayoutUsd.toFixed(2)}/hr</b> to{" "}
          <b>${economy.maxPayoutUsd.toFixed(2)}/hr</b>, every {economy.payoutSlopeRe.toLocaleString("en-US")} RE
          earned adds $1/hr.
        </div>
        <CalcForm
          key={`${inputs.project}:${pickedHours ?? ""}`}
          initial={inputs}
          tiers={TIERS}
          canUseBase={!!wallet}
          baseLabel={wallet ? `${Math.round(baseRe).toLocaleString("en-US")} RE available` : "couldn't load your RE"}
        />
        <Stats s={stats} />
        <div className="note">
          Computed straight from the same payout formula the server credits with, starting from{" "}
          {reBefore > 0 ? `your ${Math.round(reBefore).toLocaleString("en-US")} RE` : "0 RE"}. The actual amount still
          depends on the tier and hours a reviewer confirms when your project ships.
        </div>
      </div>
    </div>
  );
}
