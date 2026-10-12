"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PixelFlowPoint } from "@/lib/db";
import { Muted } from "@/app/_ui/ui";
import { CHART_AXIS_PROPS, CHART_TOOLTIP_STYLE, dateLabel, sparseTicks } from "./GrowthChart";

const SERIES = [
  { key: "given", label: "Given out", color: "var(--hc-green)" },
  { key: "deducted", label: "Deducted", color: "var(--hc-red)" },
] as const;

export function PixelFlowChart({ points }: { points: PixelFlowPoint[] }) {
  const ticks = sparseTicks(points.map((p) => p.date));

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="hc-heading text-base">Pixels</h3>
        <Muted className="text-xs">Given out vs deducted, per day</Muted>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 200 }}>
          <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" ticks={ticks} tickMargin={8} tickFormatter={dateLabel} {...CHART_AXIS_PROPS} />
            <YAxis width={40} {...CHART_AXIS_PROPS} />
            <Tooltip
              {...CHART_TOOLTIP_STYLE}
              cursor={{ stroke: "var(--border-strong)" }}
              labelFormatter={(v) => dateLabel(String(v))}
            />
            <Legend wrapperStyle={{ fontSize: 13, color: "var(--muted)" }} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#fill-${s.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
