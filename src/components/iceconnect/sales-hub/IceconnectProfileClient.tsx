"use client";


import { apiFetch } from "@/lib/api-fetch";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";

const ROLE_LABEL: Record<string, string> = {
  MANAGER: "Manager",
  SALES_EXECUTIVE: "Sales Executive",
  TELECALLER: "Telecaller",
  TECH_HEAD: "Tech Head",
  TECH_EXECUTIVE: "Tech Executive",
  ADMIN: "Admin",
};

export function IceconnectProfileClient() {
  const router = useRouter();
  const { ready } = useCompanyBranding();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as { user?: { name?: string; email?: string; role?: string } };
        if (c) return;
        if (j.user) {
          setName(j.user.name?.trim() || "");
          setEmail(j.user.email ?? "");
          setRole(j.user.role ?? "");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    router.replace("/iceconnect/login");
    router.refresh();
  }, [router]);

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-md space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Your account</p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Name</dt>
            <dd className="mt-1 font-medium text-gray-900">{name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role</dt>
            <dd className="mt-1 font-medium text-gray-900">{(ROLE_LABEL[role] ?? role) || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Email</dt>
            <dd className="mt-1 break-all text-gray-800">{email || "—"}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-8 w-full rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
