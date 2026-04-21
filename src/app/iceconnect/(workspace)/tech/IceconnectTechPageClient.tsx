"use client";

import { useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { IceconnectTechExecMobileDashboard } from "@/components/iceconnect/IceconnectTechExecMobileDashboard";
import { IceconnectTechLegacyDashboard } from "@/components/iceconnect/IceconnectTechLegacyDashboard";

/**
 * ICECONNECT workforce (JWT: employeeSystem=ICECONNECT, iceconnectEmployeeRole=TECH_EXEC)
 * → mobile task board. Legacy TECH_* job roles → classic onboarding pipeline UI.
 */
export function IceconnectTechPageClient() {
  const [mode, setMode] = useState<"loading" | "exec" | "legacy">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/auth/me", { credentials: "include" });
        const j = (await readApiJson(res, "iceconnect/tech-router")) as {
          user?: {
            employeeSystem?: string | null;
            iceconnectEmployeeRole?: string | null;
          };
        };
        if (cancelled) return;
        const u = j.user;
        const exec =
          u?.employeeSystem === "ICECONNECT" && u?.iceconnectEmployeeRole === "TECH_EXEC";
        setMode(exec ? "exec" : "legacy");
      } catch {
        if (!cancelled) setMode("legacy");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "loading") {
    return (
      <div className="mx-auto max-w-5xl p-6 text-sm text-gray-500">
        Loading tech workspace…
      </div>
    );
  }
  if (mode === "exec") {
    return (
      <div className="min-h-screen bg-[#05070A] text-white">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tech</p>
          <h1 className="text-lg font-bold">Automation & delivery</h1>
        </div>
        <div className="px-3 py-4">
          <IceconnectTechExecMobileDashboard />
        </div>
      </div>
    );
  }
  return <IceconnectTechLegacyDashboard />;
}
