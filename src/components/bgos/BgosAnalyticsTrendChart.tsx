"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import type { DashboardAnalyticsTrendPoint } from "@/types";

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function BgosAnalyticsTrendChart({
  data,
  periodLabel,
}: {
  data: DashboardAnalyticsTrendPoint[];
  periodLabel: string;
}) {
  if (!data.length) {
    return (
      <DashboardSurface tilt={false} className="p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-white">Trend</h3>
        <p className="mt-1 text-xs text-white/45">{periodLabel} — no data in this window.</p>
      </DashboardSurface>
    );
  }

  return (
    <DashboardSurface tilt={false} className="p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-sm font-semibold text-white">Trend</h3>
        <p className="text-[10px] text-white/40">{periodLabel}</p>
      </div>
      <p className="mt-1 text-xs text-white/45">
        Revenue (₹), new leads (count), and expenses (₹) by bucket.
      </p>
      <div className="mt-4 h-72 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="inr"
              tick={{ fill: "rgba(255,195,0,0.75)", fontSize: 10 }}
              tickFormatter={(v) => (v >= 100000 ? `${Math.round(v / 1000)}k` : String(v))}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,195,0,0.2)" }}
              width={44}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              tick={{ fill: "rgba(147,197,253,0.85)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(147,197,253,0.2)" }}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15,20,29,0.95)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              formatter={(value, name) => {
                const raw = value == null ? 0 : typeof value === "number" ? value : Number(value);
                const n = Number.isFinite(raw) ? raw : 0;
                if (name === "Leads") return [String(n), String(name)];
                return [formatInr(n), String(name)];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) => <span className="text-white/80">{value}</span>}
            />
            <Line
              yAxisId="inr"
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#FFC300"
              strokeWidth={2}
              dot={{ r: 2, fill: "#FFC300" }}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke="#93C5FD"
              strokeWidth={2}
              dot={{ r: 2, fill: "#93C5FD" }}
            />
            <Line
              yAxisId="inr"
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#F87171"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </DashboardSurface>
  );
}
