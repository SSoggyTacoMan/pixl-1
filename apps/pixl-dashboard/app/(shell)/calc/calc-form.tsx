"use client";

// Calculator inputs. Holds no formulas: every change rewrites the URL
// (?hours=&tier=&base=&project=) and the Server Component recomputes the
// numbers with calc/economy.ts, so the browser only ever sees results.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export interface CalcInputs {
  hours: number;
  tier: number;
  base: boolean;
  project: string;
}

export interface ProjectOption {
  id: string;
  label: string;
}

function toQuery(v: CalcInputs, withNumbers: boolean): string {
  const p = new URLSearchParams();
  if (v.project) p.set("project", v.project);
  if (withNumbers) {
    p.set("hours", String(v.hours));
    p.set("tier", String(v.tier));
  }
  if (v.base) p.set("base", "1");
  return p.toString();
}

export function useCalcNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const go = (v: CalcInputs, withNumbers = true) => {
    const qs = toQuery(v, withNumbers);
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { go, pending };
}

const Chevron = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    {up ? (
      <>
        <rect x="7" y="4" width="2" height="2" />
        <rect x="5" y="6" width="6" height="2" />
        <rect x="3" y="8" width="10" height="2" />
      </>
    ) : (
      <>
        <rect x="3" y="6" width="10" height="2" />
        <rect x="5" y="8" width="6" height="2" />
        <rect x="7" y="10" width="2" height="2" />
      </>
    )}
  </svg>
);

export function ProjectPicker({ value, options, inputs }: { value: string; options: ProjectOption[]; inputs: CalcInputs }) {
  const { go, pending } = useCalcNav();
  return (
    <select
      className="field"
      aria-label="Pick a project"
      value={value}
      disabled={pending}
      // Picking a project drops hours/tier from the URL so the server fills
      // them from that project's tracked hours and tier.
      onChange={(e) => go({ ...inputs, project: e.target.value }, !e.target.value)}
    >
      <option value="">Select a project</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CalcForm({
  initial,
  tiers,
  baseLabel,
  canUseBase,
}: {
  initial: CalcInputs;
  tiers: readonly string[];
  baseLabel: string;
  canUseBase: boolean;
}) {
  const [hours, setHours] = useState(String(initial.hours));
  const [tier, setTier] = useState(initial.tier);
  const [base, setBase] = useState(initial.base);
  const { go } = useCalcNav();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => go({ hours: Math.max(Number(hours) || 0, 0), tier, base, project: initial.project }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, tier, base]);

  function step(dir: number) {
    const next = Math.max((Number(hours) || 0) + dir * 0.5, 0);
    setHours(String(Math.round(next * 100) / 100));
  }

  return (
    <>
      <div className="form-row">
        <label className="lbl" htmlFor="calc-hours">
          Hours
        </label>
        <div className="stepper">
          <input
            id="calc-hours"
            className="field"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <div className="stepper-btns">
            <button type="button" className="stepper-btn" aria-label="Increase hours" onClick={() => step(1)}>
              <Chevron up />
            </button>
            <button type="button" className="stepper-btn" aria-label="Decrease hours" onClick={() => step(-1)}>
              <Chevron up={false} />
            </button>
          </div>
        </div>
      </div>
      <div className="form-row">
        <label className="lbl" htmlFor="calc-tier">
          Tier (your call, the reviewer confirms it)
        </label>
        <select id="calc-tier" className="field" value={tier} onChange={(e) => setTier(Number(e.target.value) || 1)}>
          {tiers.map((t, i) => (
            <option key={t} value={i + 1}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label className="re-cb">
          <input type="checkbox" checked={base} disabled={!canUseBase} onChange={(e) => setBase(e.target.checked)} />
          <span className="box">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="8" width="2" height="2" />
              <rect x="5" y="10" width="2" height="2" />
              <rect x="7" y="8" width="2" height="2" />
              <rect x="9" y="6" width="2" height="2" />
              <rect x="11" y="4" width="2" height="2" />
            </svg>
          </span>
          <span className="l2">Include my base RE</span>
          <span className="bump">{baseLabel}</span>
        </label>
      </div>
    </>
  );
}
