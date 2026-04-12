"use client";

import { motion } from "framer-motion";

type Props = {
  percent: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
};

export function CircularProgressRing({
  percent,
  size = 160,
  stroke = 12,
  label,
  sublabel,
}: Props) {
  const p = Math.max(0, Math.min(100, percent));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-gray-200"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums text-gray-900">{p}%</span>
          {label ? <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</span> : null}
        </div>
      </div>
      {sublabel ? <p className="max-w-[14rem] text-center text-xs text-gray-500">{sublabel}</p> : null}
    </div>
  );
}
