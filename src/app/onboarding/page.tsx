"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { z } from "zod";
import { BGOS_ADD_BUSINESS_INTENT_KEY } from "@/lib/bgos-add-business-intent";

const step1Schema = z.object({
  name: z.string().trim().min(1, "Business name is required").max(200, "Name is too long"),
  industry: z.literal("SOLAR"),
  logoUrl: z.string().max(2048).optional(),
  companyEmail: z.union([z.literal(""), z.string().email("Enter a valid email")]).optional(),
  companyPhone: z.string().max(40).optional(),
  billingAddress: z.string().max(4000).optional(),
  gstNumber: z.string().max(32).optional(),
});

type MeUser = {
  needsOnboarding?: boolean;
  needsWorkspaceActivation?: boolean;
  companyId?: string | null;
  workspaceReady?: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<"SOLAR">("SOLAR");
  const [logoUrl, setLogoUrl] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [probing, setProbing] = useState(true);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/login");
  }, [router]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("addBusiness") === "1") {
      sessionStorage.setItem(BGOS_ADD_BUSINESS_INTENT_KEY, "1");
    }
  }, []);

  const probeSession = useCallback(async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = (await res.json()) as {
      authenticated?: boolean;
      user?: MeUser;
    };
    if (!data.authenticated || !data.user) {
      router.replace("/login?from=/onboarding");
      return false;
    }
    const u = data.user;
    if (u.needsOnboarding || !u.companyId) {
      setStep(1);
      return true;
    }
    if (u.needsWorkspaceActivation || u.workspaceReady === false) {
      setStep(2);
      return true;
    }
    const wantAddBusiness =
      typeof window !== "undefined" &&
      sessionStorage.getItem(BGOS_ADD_BUSINESS_INTENT_KEY) === "1";
    if (wantAddBusiness) {
      if (typeof window !== "undefined") {
        const loc = new URL(window.location.href);
        if (loc.searchParams.get("addBusiness") === "1") {
          loc.searchParams.delete("addBusiness");
          window.history.replaceState(
            null,
            "",
            loc.pathname + (loc.search ? loc.search : "") + loc.hash,
          );
        }
      }
      setStep(1);
      setName("");
      setIndustry("SOLAR");
      setLogoUrl("");
      setCompanyEmail("");
      setCompanyPhone("");
      setBillingAddress("");
      setGstNumber("");
      return true;
    }
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(BGOS_ADD_BUSINESS_INTENT_KEY);
    }
    router.replace("/bgos");
    return false;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await probeSession();
      } catch {
        if (!cancelled) router.replace("/login?from=/onboarding");
      } finally {
        if (!cancelled) setProbing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [probeSession, router]);

  async function onSubmitStep1(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fields = step1Schema.safeParse({
      name,
      industry,
      logoUrl: logoUrl.trim() || undefined,
      companyEmail: companyEmail.trim() || undefined,
      companyPhone: companyPhone.trim() || undefined,
      billingAddress: billingAddress.trim() || undefined,
      gstNumber: gstNumber.trim() || undefined,
    });
    if (!fields.success) {
      const fe = fields.error.flatten().fieldErrors;
      setError(fe.name?.[0] ?? fe.industry?.[0] ?? "Check the form.");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/company/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: fields.data.name,
          industry: fields.data.industry,
          ...(fields.data.logoUrl?.trim() ? { logoUrl: fields.data.logoUrl.trim() } : {}),
          ...(fields.data.companyEmail?.trim()
            ? { companyEmail: fields.data.companyEmail.trim() }
            : {}),
          ...(fields.data.companyPhone?.trim()
            ? { companyPhone: fields.data.companyPhone.trim() }
            : {}),
          ...(fields.data.billingAddress?.trim()
            ? { billingAddress: fields.data.billingAddress.trim() }
            : {}),
          ...(fields.data.gstNumber?.trim()
            ? { gstNumber: fields.data.gstNumber.trim() }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        companyId?: string;
      };

      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create business");
        return;
      }

      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      const meData = (await meRes.json()) as { user?: MeUser };
      const u = meData.user;
      if (u?.needsWorkspaceActivation || u?.workspaceReady === false) {
        setStep(2);
      } else {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(BGOS_ADD_BUSINESS_INTENT_KEY);
        }
        if (typeof data.companyId === "string" && data.companyId.length > 0) {
          await fetch("/api/company/switch", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: data.companyId }),
          });
        }
        router.push("/bgos");
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  async function finishActivation(nextPath: string) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/onboarding/activate", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not activate workspace");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  if (probing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0B0F19] px-4 text-white/60">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400"
          aria-hidden
        />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0B0F19] px-4 py-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgb(34 211 238), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 50%, rgb(6 182 212 / 0.4), transparent)",
          }}
        />
        <div className="relative w-full max-w-lg">
          <div className="mb-6 flex items-center justify-center gap-2">
            <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
              NEXA
            </span>
          </div>
          <div className="rounded-2xl border border-cyan-500/20 bg-[#0f141f]/90 p-8 shadow-[0_0_40px_-12px_rgba(34,211,238,0.35)] backdrop-blur-md">
            <p className="text-center text-sm font-medium uppercase tracking-widest text-cyan-400/80">
              Workspace ready
            </p>
            <h1 className="mt-4 text-center text-2xl font-semibold leading-snug tracking-tight text-white">
              Boss, your solar business is ready.
              <span className="mt-2 block text-lg font-normal text-white/85">
                Let&apos;s activate it.
              </span>
            </h1>
            <p className="mt-4 text-center text-sm leading-relaxed text-white/55">
              Choose a next step — you can always do the rest from the command center.
            </p>

            {error ? (
              <p className="mt-6 text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => void finishActivation("/bgos/team")}
                className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/15 py-3.5 text-sm font-semibold text-cyan-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] transition hover:bg-cyan-500/25 disabled:opacity-50"
              >
                Add Employee
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void finishActivation("/bgos/sales")}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                Add First Lead
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void finishActivation("/bgos")}
                className="w-full py-2.5 text-sm font-medium text-white/45 underline-offset-4 transition hover:text-white/70 hover:underline disabled:opacity-50"
              >
                Skip for now
              </button>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-white/40">
            Wrong account?{" "}
            <button
              type="button"
              onClick={() => void signOut()}
              className="font-medium text-cyan-400 hover:text-cyan-300"
            >
              Sign out
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl backdrop-blur">
        <h1 className="text-center text-xl font-semibold tracking-tight">Set up your business</h1>
        <p className="mt-1 text-center text-sm text-white/60">
          Business name, solar category, and optional logo &amp; legal details for documents.
        </p>
        <form className="mt-8 max-h-[70vh] space-y-4 overflow-y-auto pr-1" onSubmit={onSubmitStep1} noValidate>
          <div>
            <label htmlFor="business-name" className="block text-xs font-medium text-white/70">
              Business name
            </label>
            <input
              id="business-name"
              name="name"
              type="text"
              autoComplete="organization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="business-category" className="block text-xs font-medium text-white/70">
              Business category
            </label>
            <select
              id="business-category"
              name="industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value as "SOLAR")}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            >
              <option value="SOLAR">Solar</option>
            </select>
          </div>
          <div>
            <label htmlFor="logo-url" className="block text-xs font-medium text-white/70">
              Company logo URL <span className="text-white/40">(optional)</span>
            </label>
            <input
              id="logo-url"
              name="logoUrl"
              type="text"
              inputMode="url"
              placeholder="https://… or /path-in-public"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            />
            <p className="mt-1 text-[11px] text-white/40">
              Use HTTPS or a path like <code className="text-white/60">/logo.jpg</code>. File upload can be added
              to storage later.
            </p>
          </div>
          <div>
            <label htmlFor="co-email" className="block text-xs font-medium text-white/70">
              Company email <span className="text-white/40">(optional)</span>
            </label>
            <input
              id="co-email"
              name="companyEmail"
              type="email"
              autoComplete="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="co-phone" className="block text-xs font-medium text-white/70">
              Company phone <span className="text-white/40">(optional)</span>
            </label>
            <input
              id="co-phone"
              name="companyPhone"
              type="tel"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="address" className="block text-xs font-medium text-white/70">
              Address <span className="text-white/40">(optional)</span>
            </label>
            <textarea
              id="address"
              name="billingAddress"
              rows={3}
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="gst" className="block text-xs font-medium text-white/70">
              GST number <span className="text-white/40">(optional)</span>
            </label>
            <input
              id="gst"
              name="gstNumber"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>
          {error ? (
            <p className="text-center text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-medium text-black transition hover:bg-cyan-400 disabled:pointer-events-none disabled:opacity-50"
          >
            {pending ? "Creating workspace…" : "Continue"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-white/50">
          Wrong account?{" "}
          <button
            type="button"
            onClick={() => void signOut()}
            className="font-medium text-cyan-400 hover:text-cyan-300"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
