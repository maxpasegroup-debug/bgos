"use client";

import { useBgosTheme } from "./BgosThemeProvider";

/** Shared surface classes for light/dark — use in BGOS command centers and dashboards. */
export function useBgosSurface() {
  const { theme } = useBgosTheme();
  const isLight = theme === "light";

  return {
    theme,
    isLight,
    /** Main content area behind cards */
    mainBg: isLight ? "bg-[#F4F6FA]" : "bg-transparent",
    /** Primary card */
    card: isLight
      ? "rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-sm shadow-slate-300/20"
      : "rounded-2xl border border-[#1E2632] bg-[#121821] text-white shadow-lg shadow-black/20",
    cardSubtle: isLight
      ? "rounded-xl border border-slate-200/80 bg-slate-50/90 text-slate-900"
      : "rounded-xl border border-white/[0.06] bg-black/25 text-white",
    innerWell: isLight
      ? "rounded-xl border border-slate-200/70 bg-slate-50"
      : "rounded-xl border border-white/[0.06] bg-black/20",
    textMuted: isLight ? "text-slate-600" : "text-white/65",
    textFaint: isLight ? "text-slate-500" : "text-white/45",
    textHeading: isLight ? "text-slate-900" : "text-white",
    label: isLight ? "text-slate-500" : "text-white/40",
    border: isLight ? "border-slate-200" : "border-white/10",
    input: isLight
      ? "rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-violet-400/50 focus:ring-violet-500/20"
      : "rounded-xl border border-white/10 bg-black/25 text-white placeholder:text-white/35 focus:border-violet-400/40",
    btnGhost: isLight
      ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      : "border-white/10 bg-white/[0.05] text-white/80 hover:border-white/15 hover:bg-white/[0.08]",
    btnPrimary:
      "rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/35",
    /** Accent for positive deltas */
    growth: isLight ? "text-emerald-600" : "text-emerald-400",
    /** Accent for drops */
    danger: isLight ? "text-red-600" : "text-red-400",
  };
}
