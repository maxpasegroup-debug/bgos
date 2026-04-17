"use client";


import { apiFetch } from "@/lib/api-fetch";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BgosAddLeadModal } from "./BgosAddLeadModal";
import { BgosCompanySwitcher } from "./BgosCompanySwitcher";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BGOS_MAIN_PAD } from "./layoutTokens";
import { SUPER_BOSS_HOME_PATH } from "@/lib/role-routing";
import { useBgosTheme } from "./BgosThemeContext";

type BillingPeek = {
  planLabel: string;
  subscriptionStatus: string;
  trialDaysRemaining: number | null;
  renewalDateIso: string | null;
};

type SessionUser = {
  name: string;
  email: string;
  role: string;
  companyName: string | null;
  billing: BillingPeek | null;
};

const WA_ENTERPRISE =
  "https://wa.me/918089239823?text=Hi%2C%20I%20want%20Enterprise%20BGOS%20plan";

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Boss";
  return role
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function BgosHeader() {
  const pathname = usePathname() ?? "";
  const { trialReadOnly, isSuperBoss, bossBillingBypass, controlShell } = useBgosDashboardContext();
  const { theme, toggleTheme } = useBgosTheme();
  const light = theme === "light";
  const reduceMotion = useReducedMotion();
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser>({
    name: "Solar Owner",
    email: "—",
    role: "ADMIN",
    companyName: null,
    billing: null,
  });
  const logoHref =
    controlShell || isSuperBoss ? SUPER_BOSS_HOME_PATH : "/bgos/control/home";
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as {
          billing?: {
            planLabel?: string;
            subscriptionStatus?: string;
            trialDaysRemaining?: number | null;
            renewalDateIso?: string | null;
          };
          user?: { name?: string; email?: string; role?: string; companyName?: string | null };
        };
        if (!cancelled && j.user) {
          const b = j.billing;
          setSessionUser({
            name: (j.user.name || "Solar Owner").trim() || "Solar Owner",
            email: j.user.email || "—",
            role: j.user.role || "ADMIN",
            companyName:
              typeof j.user.companyName === "string" && j.user.companyName.trim()
                ? j.user.companyName.trim()
                : null,
            billing:
              b &&
              typeof b.planLabel === "string" &&
              typeof b.subscriptionStatus === "string"
                ? {
                    planLabel: b.planLabel,
                    subscriptionStatus: b.subscriptionStatus,
                    trialDaysRemaining:
                      typeof b.trialDaysRemaining === "number" ? b.trialDaysRemaining : null,
                    renewalDateIso:
                      typeof b.renewalDateIso === "string" && b.renewalDateIso.trim()
                        ? b.renewalDateIso
                        : null,
                  }
                : null,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotificationOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const initials = useMemo(() => {
    const parts = sessionUser.name.split(/\s+/).filter(Boolean);
    const raw = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
    return raw || "SO";
  }, [sessionUser.name]);

  async function doLogout() {
    setLogoutBusy(true);
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.assign("/");
    }
  }

  const notificationCount = 0;

  return (
    <motion.header
      initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={
        light
          ? "sticky top-0 z-50 shrink-0 border-b border-slate-200/90 bg-white/75 backdrop-blur-xl"
          : "sticky top-0 z-50 shrink-0 border-b border-[var(--bgos-border)]/80 bg-[#121821]/75 backdrop-blur-xl"
      }
    >
      <div
        className={`flex h-14 min-h-14 items-center gap-2 sm:gap-4 ${BGOS_MAIN_PAD}`}
      >
        <Link
          href={logoHref}
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90"
          aria-label="BGOS Home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bgos-logo-placeholder.svg"
            alt=""
            className="h-8 w-auto sm:h-9"
            width={120}
            height={32}
          />
        </Link>
        {controlShell || isSuperBoss || bossBillingBypass ? null : (
          <BgosCompanySwitcher light={light} />
        )}
        <h1
          className={
            light
              ? "min-w-0 flex-1 truncate text-center text-xs font-semibold tracking-wide text-slate-700 sm:text-sm"
              : "min-w-0 flex-1 truncate text-center text-xs font-semibold tracking-wide text-white/90 sm:text-sm"
          }
        >
          {controlShell ? "BGOS Control" : "Business overview"}
        </h1>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <motion.button
            type="button"
            disabled={trialReadOnly}
            title={trialReadOnly ? "Your trial has expired — upgrade to add leads." : undefined}
            onClick={() => {
              if (trialReadOnly) return;
              setAddLeadOpen(true);
            }}
            whileHover={
              reduceMotion || trialReadOnly
                ? undefined
                : {
                    scale: 1.02,
                    backgroundColor: "rgba(255, 195, 0, 0.14)",
                    boxShadow:
                      "0 0 28px -4px rgba(255, 195, 0, 0.35), inset 0 1px 0 0 rgba(255,255,255,0.08)",
                  }
            }
            whileTap={reduceMotion || trialReadOnly ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={
              light
                ? "inline-flex min-h-9 shrink-0 items-center rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.08] px-3 text-xs font-semibold text-indigo-700 shadow-sm backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-45 sm:px-3.5"
                : "inline-flex min-h-9 shrink-0 items-center rounded-2xl border border-[#FFC300]/32 bg-[#FFC300]/[0.09] px-3 text-xs font-semibold text-[#FFE08A] shadow-[0_0_20px_-6px_rgba(255,195,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-45 sm:px-3.5"
            }
          >
            Add Lead
          </motion.button>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className={
              light
                ? "rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-200/80 hover:text-slate-900"
                : "rounded-lg p-2 text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"
            }
            aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
            title={light ? "Dark mode" : "Light mode"}
          >
            {light ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </motion.button>
          <div className="relative" ref={notifRef}>
            <motion.button
              type="button"
              onClick={() => {
                setNotificationOpen((v) => !v);
                setProfileOpen(false);
              }}
              whileHover={
                reduceMotion
                  ? undefined
                  : {
                      backgroundColor: "rgba(255,255,255,0.06)",
                      boxShadow:
                        "0 0 18px rgba(255, 59, 59, 0.18), 0 0 32px rgba(255, 195, 0, 0.08)",
                    }
              }
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={
                light
                  ? "relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
                  : "relative rounded-lg p-2 text-white/65 transition-colors hover:text-white"
              }
              aria-label="Notifications"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-1.312 5.022 23.846 23.846 0 005.455 1.31m-4.714 0a3.002 3.002 0 01-5.455 0"
                />
              </svg>
              {notificationCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#FF3B3B] px-1 text-center text-[10px] font-semibold text-white">
                  {notificationCount}
                </span>
              ) : null}
            </motion.button>
            <AnimatePresence>
              {notificationOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className={
                    light
                      ? "absolute right-0 top-12 z-50 w-[min(18rem,calc(100vw-1.25rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
                      : "absolute right-0 top-12 z-50 w-[min(18rem,calc(100vw-1.25rem))] rounded-xl border border-white/12 bg-[#121821]/95 p-3 shadow-xl backdrop-blur-xl"
                  }
                >
                  <p
                    className={
                      light
                        ? "text-xs font-semibold tracking-wide text-slate-900"
                        : "text-xs font-semibold tracking-wide text-white"
                    }
                  >
                    Notifications
                  </p>
                  <p
                    className={
                      light
                        ? "mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                        : "mt-2 rounded-lg border border-white/10 bg-white/[0.06] p-3 text-xs text-white/75"
                    }
                  >
                    No notifications yet
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotificationOpen(false);
              }}
              className={
                light
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-gradient-to-br from-indigo-500/25 to-violet-500/20 text-[10px] font-bold text-indigo-900 shadow-sm transition-[box-shadow,transform] hover:border-indigo-300 active:scale-[0.98] sm:h-9 sm:w-9 sm:text-xs"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[#6366f1]/35 to-[#8b5cf6]/25 text-[10px] font-bold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition-[box-shadow,transform] hover:border-white/25 active:scale-[0.98] sm:h-9 sm:w-9 sm:text-xs"
              }
              title={sessionUser.name}
            >
              {initials}
            </button>
            <AnimatePresence>
              {profileOpen ? (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className={
                    light
                      ? "absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
                      : "absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-[var(--bgos-border)] bg-[#121821] shadow-xl backdrop-blur-xl"
                  }
                >
                  <div
                    className={
                      light
                        ? "border-b border-slate-200 px-3.5 py-3"
                        : "border-b border-white/[0.08] px-3.5 py-3"
                    }
                  >
                    <p
                      className={
                        light
                          ? "truncate text-sm font-semibold tracking-tight text-slate-900"
                          : "truncate text-sm font-semibold tracking-tight text-white"
                      }
                    >
                      {sessionUser.name}
                    </p>
                    <p
                      className={
                        light
                          ? "mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500"
                          : "mt-1 text-[11px] font-medium uppercase tracking-wider text-white/55"
                      }
                    >
                      Role ·{" "}
                      <span className={light ? "text-slate-800" : "text-white/90"}>
                        {roleLabel(sessionUser.role)}
                      </span>
                    </p>
                    <p
                      className={
                        light
                          ? "mt-2 text-[11px] font-medium uppercase tracking-wider text-slate-500"
                          : "mt-2 text-[11px] font-medium uppercase tracking-wider text-white/55"
                      }
                    >
                      Company ·{" "}
                      <span
                        className={
                          light ? "normal-case tracking-normal text-slate-800" : "normal-case tracking-normal text-white/90"
                        }
                      >
                        {sessionUser.companyName ?? (
                          <span className={light ? "text-slate-400" : "text-white/45"}>—</span>
                        )}
                      </span>
                    </p>
                    {sessionUser.billing ? (
                      <div
                        className={
                          light
                            ? "mt-2 space-y-1 border-t border-slate-200 pt-2"
                            : "mt-2 space-y-1 border-t border-white/[0.08] pt-2"
                        }
                      >
                        <p
                          className={
                            light
                              ? "text-[11px] font-medium uppercase tracking-wider text-slate-500"
                              : "text-[11px] font-medium uppercase tracking-wider text-white/55"
                          }
                        >
                          Plan ·{" "}
                          <span className={light ? "text-slate-800" : "text-white/90"}>
                            {sessionUser.billing.planLabel}
                          </span>
                        </p>
                        {sessionUser.billing.subscriptionStatus === "TRIAL" &&
                        sessionUser.billing.trialDaysRemaining != null ? (
                          <p className={light ? "text-[11px] text-slate-600" : "text-[11px] text-white/65"}>
                            Trial · {sessionUser.billing.trialDaysRemaining} day
                            {sessionUser.billing.trialDaysRemaining === 1 ? "" : "s"} left
                          </p>
                        ) : null}
                        {sessionUser.billing.renewalDateIso ? (
                          <p className={light ? "text-[11px] text-slate-600" : "text-[11px] text-white/65"}>
                            {sessionUser.billing.subscriptionStatus === "TRIAL"
                              ? "Trial ends"
                              : "Paid through"}{" "}
                            <span className={light ? "font-medium text-slate-800" : "font-medium text-white/85"}>
                              {formatShortDate(sessionUser.billing.renewalDateIso)}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <nav className="flex flex-col p-1.5">
                    <Link
                      href="/bgos/billing"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={
                        light
                          ? "rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-100"
                          : "rounded-lg px-3 py-2.5 text-left text-sm text-white/90 transition-colors hover:bg-white/[0.08]"
                      }
                    >
                      Billing
                    </Link>
                    <Link
                      href="/bgos/subscription"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={
                        light
                          ? "rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-100"
                          : "rounded-lg px-3 py-2.5 text-left text-sm text-white/90 transition-colors hover:bg-white/[0.08]"
                      }
                    >
                      Upgrade plan
                    </Link>
                    <a
                      href={WA_ENTERPRISE}
                      target="_blank"
                      rel="noopener noreferrer"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={
                        light
                          ? "rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-100"
                          : "rounded-lg px-3 py-2.5 text-left text-sm text-white/90 transition-colors hover:bg-white/[0.08]"
                      }
                    >
                      Enterprise (WhatsApp)
                    </a>
                    <Link
                      href="/bgos/settings"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={
                        light
                          ? "rounded-lg px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-100"
                          : "rounded-lg px-3 py-2.5 text-left text-sm text-white/90 transition-colors hover:bg-white/[0.08]"
                      }
                    >
                      Company Settings
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={logoutBusy}
                      onClick={() => void doLogout()}
                      className={
                        light
                          ? "rounded-lg px-3 py-2.5 text-left text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60"
                          : "rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#FFC300] transition-colors hover:bg-white/[0.06] disabled:opacity-60"
                      }
                    >
                      {logoutBusy ? "Logging out..." : "Logout"}
                    </button>
                  </nav>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <BgosAddLeadModal open={addLeadOpen} onClose={() => setAddLeadOpen(false)} />
    </motion.header>
  );
}
