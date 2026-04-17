"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";

export default function SetupRetryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const probe = useCallback(async () => {
    const res = await apiFetch("/api/auth/me", { credentials: "include" });
    const data = (await readApiJson(res, "setup-retry-me")) as {
      authenticated?: boolean;
      user?: { companyId?: string | null; role?: string; needsOnboarding?: boolean };
    };
    if (!res.ok || !data.authenticated || !data.user) {
      router.replace("/login?from=/setup-retry");
      return;
    }
    setAuthenticated(true);
    const u = data.user;
    const companyOk = typeof u.companyId === "string" && u.companyId.length > 0;
    const roleOk = u.role === "ADMIN";
    if (companyOk && roleOk && u.needsOnboarding === false) {
      router.replace("/bgos/dashboard");
      return;
    }
    setChecking(false);
  }, [router]);

  useEffect(() => {
    void probe();
  }, [probe]);

  async function startFresh() {
    await apiFetch("/api/nexa/onboarding/abandon", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    router.replace("/onboarding/nexa");
  }

  if (!authenticated || checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-slate-800">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center text-slate-900">
      <h1 className="mb-3 text-2xl font-semibold">Setup needs attention</h1>
      <p className="mb-8 max-w-md text-slate-600">
        We couldn&apos;t finish setting up your business system. You can return to onboarding or contact support.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/onboarding/nexa"
          className="rounded-2xl bg-slate-900 px-6 py-3 text-white"
        >
          Retry Setup
        </Link>
        <button
          type="button"
          onClick={() => void startFresh()}
          className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-900"
        >
          Start Fresh
        </button>
        <Link href="/contact" className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-slate-900">
          Contact Support
        </Link>
      </div>
    </div>
  );
}
