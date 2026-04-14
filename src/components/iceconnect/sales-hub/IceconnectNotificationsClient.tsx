"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";

type N = { id: string; text: string; kind: string; at: string };

export function IceconnectNotificationsClient() {
  const router = useRouter();
  const { ready } = useCompanyBranding();
  const [items, setItems] = useState<N[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/iceconnect/executive/notifications", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; notifications?: N[]; code?: string; error?: string };
      if (res.status === 403 && j.code === "NOT_INTERNAL_SALES_ORG") {
        router.replace("/iceconnect/internal-sales");
        return;
      }
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setItems(j.notifications ?? []);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return null;

  const kindColor: Record<string, string> = {
    lead: "bg-blue-50 text-blue-900 border-blue-100",
    followup: "bg-amber-50 text-amber-900 border-amber-100",
    target: "bg-rose-50 text-rose-900 border-rose-100",
    nexa: "bg-indigo-50 text-indigo-900 border-indigo-100",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">Assignments, follow-ups, targets, Nexa</p>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">You&apos;re all caught up.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((n, i) => (
            <motion.li
              key={n.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-xl border px-4 py-3 text-sm ${kindColor[n.kind] ?? "border-gray-200 bg-white text-gray-800"}`}
            >
              {n.text}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
