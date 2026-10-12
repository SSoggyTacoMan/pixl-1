"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GrowthPoint } from "@/lib/db";
import { Details, Muted, Table } from "@/app/_ui/ui";

const SERIES_COLOR: Record<"players" | "projects" | "violations", string> = {
  players: "var(--hc-cyan)",
  projects: "var(--hc-green)",
  violations: "var(--hc-red)",
};

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text)",
    fontSize: 13,
  },
  labelStyle: { color: "var(--muted)", marginBottom: 2 },
} as const;

export const CHART_AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted)", fontSize: 12 },
} as const;

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// First, middle and last date only, so the axis never crowds.
export function sparseTicks(dates: string[]): string[] {
  const n = dates.length;
  const idx = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  return idx.map((i) => dates[i]).filter(Boolean);
}

export function GrowthChart({
  title,
  series,
  points,
  kind,
}: {
  title: string;
  series: "players" | "projects" | "violations";
  points: GrowthPoint[];
  kind: "cumulative" | "daily";
}) {
  const data = points.map((p) => ({
    date: p.date,
    value: kind === "cumulative" ? p.total : p.added,
  }));
  const color = SERIES_COLOR[series];
  const ticks = sparseTicks(data.map((d) => d.date));
  const xAxis = (
    <XAxis dataKey="date" ticks={ticks} tickMargin={8} tickFormatter={dateLabel} {...CHART_AXIS_PROPS} />
  );
  const yAxis = <YAxis width={40} tickFormatter={fmt} {...CHART_AXIS_PROPS} />;
  const tooltip = (
    <Tooltip
      {...CHART_TOOLTIP_STYLE}
      labelFormatter={(v) => dateLabel(String(v))}
      formatter={(v) => [fmt(Number(v)), title]}
      cursor={kind === "cumulative" ? { stroke: "var(--border-strong)" } : { fill: "var(--border)", fillOpacity: 0.4 }}
    />
  );

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="hc-heading text-base">{title}</h3>
        <Muted className="text-xs">{kind === "cumulative" ? "Total over time" : "Per day"}</Muted>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 200 }}>
          {kind === "cumulative" ? (
            <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id={`fill-${series}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              {xAxis}
              {yAxis}
              {tooltip}
              <Area dataKey="value" type="monotone" stroke={color} strokeWidth={2} fill={`url(#fill-${series})`} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              {xAxis}
              {yAxis}
              {tooltip}
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-2">
        <Details summary="Data table">
          <div className="max-h-48 overflow-y-auto">
            <Table headers={["Date", kind === "cumulative" ? "Total" : "Count"]}>
              {[...data].reverse().map((p) => (
                <tr key={p.date}>
                  <td>{dateLabel(p.date)}</td>
                  <td className="tabular-nums">{fmt(p.value)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </Details>
      </div>
    </div>
  );
}
