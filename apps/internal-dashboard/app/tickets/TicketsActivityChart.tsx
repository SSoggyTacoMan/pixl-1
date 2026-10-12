"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivityPoint } from "@/lib/tickets";

function dateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const SERIES = [
  { key: "created", label: "Created", color: "var(--hc-red)" },
  { key: "resolved", label: "Resolved", color: "var(--hc-green)" },
] as const;

export function TicketsActivityChart({ points }: { points: ActivityPoint[] }) {
  const n = points.length;
  const tickIdx = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  const ticks = tickIdx.map((i) => points[i]?.date).filter(Boolean);

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ left: 4, right: 8, top: 8 }}>
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`tickets-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={dateLabel}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            width={28}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            labelFormatter={(v) => dateLabel(String(v))}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
          {SERIES.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type="monotone"
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#tickets-fill-${s.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
