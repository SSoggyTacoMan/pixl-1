"use client";

// Calculator inputs. Holds no formulas: every change rewrites the URL
// (?hours=&tier=&base=&project=) and the Server Component recomputes the
// numbers with calc/economy.ts, so the browser only ever sees results.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { field, selectField } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

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

const lbl = "mb-1.5 block text-[13px] text-faint";
const stepperBtn = cn(
  "flex flex-1 items-center justify-center p-0 cursor-px",
  "border-2 border-r-4 border-b-4 border-stroke bg-panel-2 text-ink",
  "transition-[background-color,color,border-bottom-width,transform] duration-[130ms]",
  "hover:-translate-x-px hover:-translate-y-px hover:border-b-8 hover:bg-gold hover:text-btn-ink",
  "active:translate-x-0 active:translate-y-px active:border-b-2",
);

const Chevron = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="size-2.5 [image-rendering:pixelated]">
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
      className={selectField}
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
      <div className="mt-3.5">
        <label className={lbl} htmlFor="calc-hours">
          Hours
        </label>
        <div className="flex items-stretch gap-2">
          <input
            id="calc-hours"
            className={cn(
              field,
              "min-w-0 flex-1 [appearance:textfield]",
              "[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none",
              "[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
            )}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <div className="flex w-9 flex-col gap-[5px]">
            <button type="button" className={stepperBtn} aria-label="Increase hours" onClick={() => step(1)}>
              <Chevron up />
            </button>
            <button type="button" className={stepperBtn} aria-label="Decrease hours" onClick={() => step(-1)}>
              <Chevron up={false} />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3.5">
        <label className={lbl} htmlFor="calc-tier">
          Tier (your call, the reviewer confirms it)
        </label>
        <select id="calc-tier" className={selectField} value={tier} onChange={(e) => setTier(Number(e.target.value) || 1)}>
          {tiers.map((t, i) => (
            <option key={t} value={i + 1}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3.5">
        <label className="relative flex cursor-px items-center gap-2.5">
          <input
            type="checkbox"
            className="peer absolute size-px opacity-0"
            checked={base}
            disabled={!canUseBase}
            onChange={(e) => setBase(e.target.checked)}
          />
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center border-2 border-r-4 border-b-4 border-stroke bg-panel-2 text-btn-ink",
              "transition-[background-color] duration-[130ms] peer-checked:bg-gold peer-disabled:opacity-50",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold",
              "[&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100",
            )}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-current">
              <rect x="3" y="8" width="2" height="2" />
              <rect x="5" y="10" width="2" height="2" />
              <rect x="7" y="8" width="2" height="2" />
              <rect x="9" y="6" width="2" height="2" />
              <rect x="11" y="4" width="2" height="2" />
            </svg>
          </span>
          <span className="text-[13px] text-ink">Include my base RE</span>
          <span className="ml-auto font-pixel text-xs text-gold">{baseLabel}</span>
        </label>
      </div>
    </>
  );
}
