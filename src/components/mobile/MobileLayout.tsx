"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useInternalSession } from "@/components/internal/InternalSessionContext";
import { SalesNetworkRole } from "@prisma/client";
import { MobileNexaBubble } from "@/components/mobile/MobileNexaBubble";
import { pageVariants, pageTransition } from "@/components/mobile/MotionWrapper";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconHome() {
  return (
    <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function IconLeads() {
  return (
    <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M3 10h18M7 15h.01M11 15h2m-8-5V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z" />
    </svg>
  );
}
function IconProfile() {
  return (
    <svg className="h-[22px] w-[22px]" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M9 16h1m5 0h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
    </svg>
  );
}
function IconUserPlus() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page title map — derives a readable title from the pathname
// ---------------------------------------------------------------------------

const PAGE_TITLES: Record<string, string> = {
  "/internal/sales":           "Dashboard",
  "/internal/leads":           "Leads",
  "/internal/wallet":          "Wallet",
  "/internal/profile":         "Profile",
  "/internal/team":            "Team",
  "/internal/tech":            "Tech",
  "/internal/control":         "Control",
  "/internal/rewards":         "Rewards",
  "/internal/competitions":    "Competitions",
  "/internal/training":        "Training",
  "/internal/announcements":   "Announcements",
  "/internal/onboard-company": "Onboard Company",
};

function pageTitle(pathname: string): string {
  for (const [prefix, label] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label;
  }
  return "Internal";
}

// ---------------------------------------------------------------------------
// Role badge colours
// ---------------------------------------------------------------------------

const ROLE_BADGE: Record<SalesNetworkRole, string> = {
  BOSS:      "bg-amber-500/20  text-amber-400  border-amber-500/30",
  RSM:       "bg-violet-500/20 text-violet-400 border-violet-500/30",
  BDM:       "bg-cyan-500/20   text-cyan-400   border-cyan-500/30",
  BDE:       "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  TECH_EXEC: "bg-sky-500/20    text-sky-400    border-sky-500/30",
};

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

function TopBar() {
  const pathname = usePathname() ?? "";
  const { salesNetworkRole, roleLabel } = useInternalSession();

  const canGoBack = pathname !== "/internal/sales" && pathname !== "/internal/control";

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.07] bg-[#05070A]/90 px-4 backdrop-blur-xl">
      {/* Back button on sub-pages */}
      {canGoBack ? (
        <button
          onClick={() => history.back()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-white/50 active:bg-white/10"
          aria-label="Go back"
        >
          <IconChevronLeft />
        </button>
      ) : (
        <span className="bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] bg-clip-text text-sm font-bold tracking-[0.14em] text-transparent">
          BGOS
        </span>
      )}

      {/* Page title */}
      <h1 className="flex-1 truncate text-[15px] font-semibold text-white">
        {pageTitle(pathname)}
      </h1>

      {/* Role badge */}
      <span
        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${ROLE_BADGE[salesNetworkRole]}`}
      >
        {roleLabel.replace("internal_", "")}
      </span>
    </header>
  );
}

// ---------------------------------------------------------------------------
// FAB — centre floating action button with a two-option popover
// ---------------------------------------------------------------------------

const fabMenuItems = [
  {
    href:    "/internal/onboard-company",
    label:   "Add Company",
    iconBg:  "bg-[#4FD1FF]/15",
    iconClr: "text-[#4FD1FF]",
    icon:    IconBuilding,
  },
  {
    href:    "/internal/leads",
    label:   "Add Lead",
    iconBg:  "bg-[#7C5CFF]/15",
    iconClr: "text-[#7C5CFF]",
    icon:    IconUserPlus,
  },
];

function FAB() {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex flex-col items-center">

      {/* Menu items — stagger up on open */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-[calc(100%+12px)] flex flex-col items-center gap-2"
            initial="closed"
            animate="open"
            exit="closed"
            variants={{ open: { transition: { staggerChildren: 0.07 } }, closed: {} }}
          >
            {fabMenuItems.map(({ href, label, iconBg, iconClr, icon: Icon }) => (
              <motion.div
                key={href}
                variants={{
                  open:   { opacity: 1, y: 0,   scale: 1,    transition: { duration: 0.22 } },
                  closed: { opacity: 0, y: 12,  scale: 0.92                                  },
                }}
              >
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-2xl border border-white/[0.12] bg-[#0D1117]/90 px-4 py-3 text-sm font-medium text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl whitespace-nowrap active:scale-95 transition-transform"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-xl ${iconBg} ${iconClr}`}>
                    <Icon />
                  </span>
                  {label}
                </Link>
              </motion.div>
            ))}
            <div className="h-2 w-2 rotate-45 rounded-sm bg-[#0D1117]/90 border-r border-b border-white/[0.12]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button — idle pulse when closed */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close actions" : "Quick actions"}
        animate={open
          ? { scale: 1,     rotate: 45 }
          : { scale: [1, 1.06, 1], rotate: 0 }
        }
        transition={open
          ? { duration: 0.22, ease: "easeOut" }
          : { scale: { repeat: Infinity, duration: 2.4, ease: "easeInOut" }, rotate: { duration: 0.22 } }
        }
        whileTap={{ scale: 0.9 }}
        className={[
          "flex h-14 w-14 items-center justify-center rounded-full border",
          open
            ? "bg-white/10 border-white/20 shadow-none"
            : "bg-gradient-to-br from-[#4FD1FF] to-[#7C5CFF] border-white/10 shadow-[0_4px_24px_rgba(79,209,255,0.45)]",
        ].join(" ")}
        style={{ marginTop: "-28px" }}
      >
        <motion.span
          animate={{ opacity: 1 }}
          key={open ? "close" : "plus"}
        >
          {open ? (
            <IconClose />
          ) : (
            <svg className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </motion.span>
      </motion.button>

      <span className={`mt-1 text-[10px] font-medium leading-none ${open ? "text-white/70" : "text-white/35"}`}>
        Action
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BottomNav
// ---------------------------------------------------------------------------

function BottomNav() {
  const pathname = usePathname() ?? "";

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const tabCls = (href: string) =>
    [
      "flex flex-1 flex-col items-center justify-end gap-1 pb-3 pt-2 text-[10px] font-medium transition-colors active:opacity-70",
      isActive(href) ? "text-[#4FD1FF]" : "text-white/35",
    ].join(" ");

  return (
    /* Outer container — full width, fixed, provides safe-area padding */
    <div className="fixed bottom-0 left-0 right-0 z-30 px-3 pb-[env(safe-area-inset-bottom,8px)]">
      {/* Pill nav bar */}
      <div className="flex h-[64px] items-end rounded-2xl border border-white/[0.10] bg-[#0A0D12]/80 px-1 shadow-[0_-4px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl">

        {/* Home */}
        <Link href="/internal/sales" className={tabCls("/internal/sales")}>
          {isActive("/internal/sales") && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-[#4FD1FF]" style={{ position: "relative" }} />
          )}
          <IconHome />
          <span>Home</span>
        </Link>

        {/* Leads */}
        <Link href="/internal/leads" className={tabCls("/internal/leads")}>
          {isActive("/internal/leads") && (
            <span className="relative top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-[#4FD1FF] self-start" />
          )}
          <IconLeads />
          <span>Leads</span>
        </Link>

        {/* FAB — centre slot */}
        <div className="flex flex-1 items-start justify-center">
          <FAB />
        </div>

        {/* Wallet */}
        <Link href="/internal/wallet" className={tabCls("/internal/wallet")}>
          <IconWallet />
          <span>Wallet</span>
        </Link>

        {/* Profile */}
        <Link href="/internal/profile" className={tabCls("/internal/profile")}>
          <IconProfile />
          <span>Profile</span>
        </Link>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active tab indicator dot (shared helper used above inline)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MobileLayout (exported)
// ---------------------------------------------------------------------------

export function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="relative flex min-h-screen flex-col bg-[#05070A] text-white antialiased">

      {/* Fixed top bar */}
      <TopBar />

      {/* Scrollable content with page transition */}
      <main className="flex-1 overflow-y-auto pt-14 pb-[88px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ willChange: "transform, opacity", minHeight: "100%" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Nexa floating bubble — above bottom nav */}
      <MobileNexaBubble />

      {/* Floating bottom nav */}
      <BottomNav />
    </div>
  );
}
