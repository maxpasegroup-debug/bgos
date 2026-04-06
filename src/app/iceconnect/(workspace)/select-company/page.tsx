"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearStoredCompanyBrand,
  writeStoredCompanyBrand,
} from "@/contexts/company-branding-context";
import { getRoleHome } from "@/lib/role-routing";

type CompanyRow = {
  companyId: string;
  name: string;
  logoUrl?: string | null;
  jobRole?: string;
};

export default function SelectCompanyPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [listRes, meRes] = await Promise.all([
        fetch("/api/company/list", { credentials: "include" }),
        fetch("/api/auth/me", { credentials: "include" }),
      ]);
      const listJson = (await listRes.json()) as {
        ok?: boolean;
        companies?: CompanyRow[];
      };
      const meJson = (await meRes.json()) as {
        ok?: boolean;
        authenticated?: boolean;
        user?: { role?: string };
      };
      if (!listRes.ok || !listJson.ok || !Array.isArray(listJson.companies)) {
        setErr("Could not load your companies.");
        return;
      }
      if (listJson.companies.length <= 1) {
        const r = meJson.user?.role ?? "TELECALLER";
        router.replace(getRoleHome(r));
        return;
      }
      setCompanies(listJson.companies);
      if (meJson.user?.role) setRole(meJson.user.role);
    } catch {
      setErr("Network error.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function chooseCompany(companyId: string) {
    setBusyId(companyId);
    setErr(null);
    try {
      const res = await fetch("/api/company/switch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(typeof json.error === "string" ? json.error : "Could not switch company.");
        return;
      }
      clearStoredCompanyBrand();
      const cur = await fetch("/api/company/current", { credentials: "include" });
      const cj = (await cur.json()) as { ok?: boolean; company?: { name: string; logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null } };
      if (cj.ok === true && cj.company) {
        writeStoredCompanyBrand(cj.company);
      }
      const r = role ?? "TELECALLER";
      window.location.href = getRoleHome(r);
    } catch {
      setErr("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-[color:var(--ice-primary,#ef4444)]" />
        <p className="text-sm text-gray-500">Loading your companies…</p>
      </div>
    );
  }

  if (err && companies.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-800">
        {err}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-gray-800 shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-md space-y-6"
    >
      <div className="text-center">
        <h1 className="text-xl font-semibold text-gray-900">Choose your company</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select where you want to work today. Your session will update securely.
        </p>
      </div>
      {err ? (
        <p className="text-center text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      <ul className="space-y-3">
        {companies.map((c) => (
          <li key={c.companyId}>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void chooseCompany(c.companyId)}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white/90 p-4 text-left shadow-sm transition hover:border-[color:var(--ice-primary)] hover:shadow-md disabled:opacity-60"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-lg font-semibold text-[color:var(--ice-primary)]">
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logoUrl} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  c.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{c.name}</p>
                {c.jobRole ? (
                  <p className="text-xs text-gray-500">{c.jobRole}</p>
                ) : null}
              </div>
              {busyId === c.companyId ? (
                <span className="text-xs text-gray-400">Switching…</span>
              ) : (
                <span className="text-xs font-medium text-[color:var(--ice-primary)]">Continue</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
