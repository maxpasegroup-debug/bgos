"use client";

import { useCallback, useEffect, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

type Item = {
  id: string;
  companyName: string;
  uiStage: string;
  priority: string;
  tier: string | null;
  onTrack: boolean;
  updatedAt: string;
};

export default function ControlTechnicalPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/bgos/control/tech-queue", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; items?: Item[] };
      if (!res.ok || !j.ok || !j.items) {
        setError("Could not load queue.");
        return;
      }
      setItems(j.items);
    } catch {
      setError("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cardShell = light
    ? "rounded-xl border border-slate-200/90 bg-white/90 p-4 shadow-sm"
    : "rounded-xl border border-white/[0.08] bg-[#121821]/80 p-4";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";
  const h1 = light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white";

  return (
    <div className={`mx-auto max-w-4xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <h1 className={h1}>Technical Dept</h1>
      <p className={muted + " mt-1"}>Onboarding queue — Enterprise → Pro → Basic. Setup → Config → Testing → Ready.</p>
      {error ? <p className="mt-4 text-sm text-amber-500">{error}</p> : null}

      <ul className="mt-6 space-y-2">
        {items.length === 0 && !error ? <li className={muted}>Queue is empty.</li> : null}
        {items.map((t) => (
          <li key={t.id} className={cardShell + " flex flex-wrap items-center justify-between gap-2"}>
            <div>
              <p className={light ? "font-semibold text-slate-900" : "font-semibold text-white"}>{t.companyName}</p>
              <p className={muted + " text-xs"}>
                {t.uiStage} · {t.tier ?? "—"} · {t.priority}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: t.onTrack ? "#22c55e" : "#ef4444" }}
                title={t.onTrack ? "On track" : "Delayed"}
              />
              <span className={muted + " text-xs"}>{t.onTrack ? "On track" : "Delayed"}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
