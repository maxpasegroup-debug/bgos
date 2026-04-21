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
        const j = (await res.json()) as { user?: { email?: string; role?: string } };
        if (c) return;
        if (j.user) {
          const nextEmail = j.user.email ?? "";
          setEmail(nextEmail);
          setName((nextEmail.split("@")[0] ?? "").trim());
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
    router.replace("/");
    router.refresh();
  }, [router]);

  if (!ready) return null;

  return (
    <div className="mx-auto grid h-full max-w-2xl place-items-center p-4">
      <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_22px_45px_-20px_rgba(0,0,0,0.65)] backdrop-blur-md">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="mt-1 text-sm text-slate-400">Your account center</p>
        <div className="mx-auto mt-6 inline-flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl font-semibold text-white">
          {(name || email || "U").charAt(0).toUpperCase()}
        </div>
        <p className="mt-4 text-lg font-semibold text-white">{name || "—"}</p>
        <p className="text-sm text-slate-300">{email || "—"}</p>
        <span className="mt-2 inline-flex rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-200">
          {(ROLE_LABEL[role] ?? role) || "—"}
        </span>

        <dl className="mt-8 grid gap-4 text-left text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt>
            <dd className="mt-1 font-medium text-white">{name || "—"}</dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-400">Role</dt>
            <dd className="mt-1 font-medium text-white">{(ROLE_LABEL[role] ?? role) || "—"}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
          >
            Edit Profile
          </button>
          <button
            type="button"
            className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-300/15"
          >
            Change Password
          </button>
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
