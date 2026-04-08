"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BgosAddLeadModal } from "./BgosAddLeadModal";
import { BgosCompanySwitcher } from "./BgosCompanySwitcher";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { BGOS_MAIN_PAD } from "./layoutTokens";

type SessionUser = {
  name: string;
  email: string;
  role: string;
};

function roleLabel(role: string): string {
  if (role === "ADMIN") return "Boss";
  return role
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function BgosHeader() {
  const { trialReadOnly } = useBgosDashboardContext();
  const reduceMotion = useReducedMotion();
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser>({
    name: "Solar Owner",
    email: "—",
    role: "ADMIN",
  });
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as { user?: { name?: string; email?: string; role?: string } };
        if (!cancelled && j.user) {
          setSessionUser({
            name: (j.user.name || "Solar Owner").trim() || "Solar Owner",
            email: j.user.email || "—",
            role: j.user.role || "ADMIN",
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
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.assign("/login");
    }
  }

  const notificationCount = 0;

  return (
    <motion.header
      initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-md"
    >
      <div
        className={`flex h-14 min-h-14 items-center gap-2 sm:gap-4 ${BGOS_MAIN_PAD}`}
      >
        <span className="shrink-0 text-sm font-bold tracking-wide text-white sm:text-base">
          BGOS
        </span>
        <BgosCompanySwitcher />
        <h1 className="min-w-0 flex-1 truncate text-center text-xs font-semibold tracking-wide text-white/90 sm:text-sm">
          Command Center
        </h1>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
            className="inline-flex min-h-9 shrink-0 items-center rounded-2xl border border-[#FFC300]/32 bg-[#FFC300]/[0.09] px-3 text-xs font-semibold text-[#FFE08A] shadow-[0_0_20px_-6px_rgba(255,195,0,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-45 sm:px-3.5"
          >
            Add Lead
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
              className="relative rounded-lg p-2 text-white/65 transition-colors hover:text-white"
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
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-xl"
                >
                  <p className="text-xs font-semibold text-white">Notifications</p>
                  <p className="mt-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                    No notifications yet
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotificationOpen(false);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#FF3B3B]/35 to-[#FFC300]/25 text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-xs"
              title={sessionUser.name}
            >
              {initials}
            </button>
            <AnimatePresence>
              {profileOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-12 z-50 w-72 rounded-xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-xl"
                >
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="truncate text-sm font-semibold text-white">{sessionUser.name}</p>
                    <p className="mt-1 text-xs text-white/80">{roleLabel(sessionUser.role)}</p>
                    <p className="mt-1 truncate text-xs text-white/65">{sessionUser.email}</p>
                  </div>
                  <div className="mt-2 space-y-1">
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                    >
                      My Profile
                    </button>
                    <Link
                      href="/bgos/settings"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10"
                    >
                      Settings
                    </Link>
                    <button
                      type="button"
                      disabled={logoutBusy}
                      onClick={() => void doLogout()}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#FFC300] hover:bg-white/10 disabled:opacity-60"
                    >
                      {logoutBusy ? "Logging out..." : "Logout"}
                    </button>
                  </div>
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
