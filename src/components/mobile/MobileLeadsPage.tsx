"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
// ---------------------------------------------------------------------------
// Inline SVG icons (no external icon dependency)
// ---------------------------------------------------------------------------

function IcoPhone({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
        d="M6.6 10.8a15.05 15.05 0 006.6 6.6l2.2-2.2a1 1 0 011.05-.24 11.5 11.5 0 003.58.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.19 2.46.57 3.58a1 1 0 01-.24 1.05L6.6 10.8z" />
    </svg>
  );
}

function IcoWhatsapp({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"
        d="M3 21l1.65-4.88A8.5 8.5 0 1121 12.5a8.5 8.5 0 01-8.5 8.5 8.46 8.46 0 01-4.62-1.37L3 21z" />
      <path stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"
        d="M9 11c.3.9.93 1.68 1.77 2.15.84.47 1.88.57 2.73.27" />
    </svg>
  );
}

function IcoSearch({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth={1.9} />
      <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" />
    </svg>
  );
}

function IcoX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function IcoSpinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} strokeOpacity={0.2} />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

function IcoAlertCircle({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1.7} />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function IcoInbox({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
        d="M22 12h-6l-2 3H10l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LeadItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  leadCompanyName: string | null;
  status: string;
  internalSalesStage: string | null;
  internalCallStatus: string | null;
  nextFollowUpAt: string | null;
};

// ---------------------------------------------------------------------------
// Stage display maps
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<string, string> = {
  LEAD_ADDED:              "New Lead",
  INTRO_CALL:              "Intro Call",
  DEMO_ORIENTATION:        "Demo",
  FOLLOW_UP:               "Follow Up",
  INTERESTED:              "Interested",
  ONBOARDING_FORM_FILLED:  "Form Filled",
  BOSS_APPROVAL_PENDING:   "Pending Approval",
  SENT_TO_TECH:            "Tech Handoff",
  TECH_READY:              "Tech Ready",
  DELIVERED:               "Delivered",
  CLIENT_LIVE:             "Live",
  CLOSED_LOST:             "Closed",
};

const STAGE_COLORS: Record<string, string> = {
  LEAD_ADDED:              "bg-slate-800 text-slate-300",
  INTRO_CALL:              "bg-sky-900/70 text-sky-300",
  DEMO_ORIENTATION:        "bg-sky-900/70 text-sky-300",
  FOLLOW_UP:               "bg-amber-900/70 text-amber-300",
  INTERESTED:              "bg-emerald-900/70 text-emerald-300",
  ONBOARDING_FORM_FILLED:  "bg-emerald-900/70 text-emerald-300",
  BOSS_APPROVAL_PENDING:   "bg-purple-900/70 text-purple-300",
  SENT_TO_TECH:            "bg-indigo-900/70 text-indigo-300",
  TECH_READY:              "bg-indigo-900/70 text-indigo-300",
  DELIVERED:               "bg-teal-900/70 text-teal-300",
  CLIENT_LIVE:             "bg-teal-900/70 text-teal-300",
  CLOSED_LOST:             "bg-red-900/70 text-red-300",
};

const SWIPE_THRESHOLD = 72; // px before action fires

// ---------------------------------------------------------------------------
// SwipeableLeadCard
// ---------------------------------------------------------------------------

function SwipeableLeadCard({
  lead,
  onAction,
}: {
  lead: LeadItem;
  onAction: (id: string, action: "close" | "follow_up") => Promise<void>;
}) {
  const [offset, setOffset] = useState(0);
  const [acting, setActing] = useState(false);
  const [firedAction, setFiredAction] = useState<"close" | "follow_up" | null>(null);
  const startXRef = useRef(0);
  const dragging = useRef(false);

  const stageKey = lead.internalSalesStage ?? "";
  const stageLabel = STAGE_LABELS[stageKey] ?? stageKey ?? lead.status;
  const stageBadge = STAGE_COLORS[stageKey] ?? "bg-slate-800 text-slate-300";
  const whatsappNumber = lead.phone.replace(/\D/g, "");

  // Follow-up date formatting
  const followUpLabel = lead.nextFollowUpAt
    ? new Date(lead.nextFollowUpAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    : null;

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX;
    dragging.current = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    const dx = e.touches[0].clientX - startXRef.current;
    setOffset(Math.max(-130, Math.min(130, dx)));
  }

  async function handleTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;

    if (Math.abs(offset) >= SWIPE_THRESHOLD) {
      const action: "close" | "follow_up" = offset < 0 ? "close" : "follow_up";
      setActing(true);
      // Snap to full reveal before flying off
      setOffset(offset < 0 ? -130 : 130);
      await onAction(lead.id, action);
      setFiredAction(action);
      setActing(false);
    } else {
      setOffset(0);
    }
  }

  // Dismiss animation: slide off screen after action
  const flyOff = firedAction !== null;

  return (
    <div className="relative overflow-hidden rounded-2xl mb-3 min-h-[130px]">
      {/* ── Background action indicators ── */}
      <div className="absolute inset-0 flex rounded-2xl overflow-hidden">
        {/* Right swipe → follow up (green) */}
        <div
          className="flex-1 bg-emerald-600/90 flex items-center justify-start pl-5 gap-2"
          aria-hidden
        >
          <span className="text-xl">↩</span>
          <span className="text-white text-[13px] font-semibold leading-tight">
            Follow<br />Up
          </span>
        </div>
        {/* Left swipe → close (red) */}
        <div
          className="flex-1 bg-red-600/90 flex items-center justify-end pr-5 gap-2"
          aria-hidden
        >
          <span className="text-white text-[13px] font-semibold leading-tight text-right">
            Mark<br />Closed
          </span>
          <span className="text-xl">✕</span>
        </div>
      </div>

      {/* ── Foreground card ── */}
      <div
        className="relative bg-[#0e1117] border border-white/[0.07] rounded-2xl p-4 touch-pan-y select-none"
        style={{
          transform: `translateX(${flyOff ? (firedAction === "close" ? -500 : 500) : offset}px)`,
          transition:
            acting || flyOff
              ? "transform 0.28s cubic-bezier(0.4,0,0.2,1)"
              : offset === 0
              ? "transform 0.22s cubic-bezier(0.4,0,0.2,1)"
              : "transform 0.04s linear",
          opacity: flyOff ? 0 : 1,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Name + badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate text-[15px] leading-snug">
              {lead.name}
            </p>
            {lead.leadCompanyName && (
              <p className="text-[12px] text-white/45 truncate mt-0.5">
                {lead.leadCompanyName}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 text-[11px] font-medium px-2.5 py-[3px] rounded-full ${stageBadge}`}
          >
            {stageLabel}
          </span>
        </div>

        {/* Phone + follow-up date */}
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[13px] text-white/40 flex-1">{lead.phone}</p>
          {followUpLabel && (
            <p className="text-[11px] text-amber-400/70 shrink-0">
              Follow up {followUpLabel}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <motion.a
            href={`tel:${lead.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 h-[38px] rounded-xl bg-sky-600/15 text-sky-400 text-[13px] font-medium border border-sky-500/20"
            whileTap={{ scale: 0.93, backgroundColor: "rgba(14,165,233,0.25)" }}
            transition={{ duration: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <IcoPhone size={14} />
            Call
          </motion.a>
          <motion.a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 h-[38px] rounded-xl bg-emerald-600/15 text-emerald-400 text-[13px] font-medium border border-emerald-500/20"
            whileTap={{ scale: 0.93, backgroundColor: "rgba(5,150,105,0.25)" }}
            transition={{ duration: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <IcoWhatsapp size={14} />
            WhatsApp
          </motion.a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MobileLeadsPage
// ---------------------------------------------------------------------------

const TAKE = 20;

export function MobileLeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [skip, setSkip] = useState(0);

  // Debounce search input 350 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLeads = useCallback(
    async (pageSkip: number, query: string, replace: boolean) => {
      if (replace) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          take: String(TAKE),
          skip: String(pageSkip),
        });
        if (query) params.set("search", query);

        const res = await apiFetch(`/api/internal/leads?${params.toString()}`);
        const json = (await res.json()) as {
          ok: boolean;
          total: number;
          take: number;
          skip: number;
          hasMore: boolean;
          leads: LeadItem[];
          error?: string;
        };

        if (!json.ok) throw new Error(json.error ?? "Failed to load leads");

        setLeads((prev) => (replace ? json.leads : [...prev, ...json.leads]));
        setTotal(json.total);
        setSkip(pageSkip + json.leads.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leads");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  // Reset and refetch on search change
  useEffect(() => {
    setSkip(0);
    void fetchLeads(0, debouncedSearch, true);
  }, [debouncedSearch, fetchLeads]);

  async function handleAction(id: string, action: "close" | "follow_up") {
    try {
      const res = await apiFetch("/api/internal/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error);

      // Fade the card out then remove from list
      setTimeout(() => {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        setTotal((t) => Math.max(0, t - 1));
      }, 320);
    } catch {
      // Card snaps back automatically (offset resets to 0 via spring transition)
    }
  }

  const remaining = total - skip;

  return (
    <div className="min-h-full bg-[#070A0E]">
      {/* ── Sticky search bar ── */}
      <div className="sticky top-0 z-10 bg-[#070A0E]/96 backdrop-blur-md px-4 py-3 border-b border-white/[0.05]">
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
            <IcoSearch size={15} />
          </span>
          <input
            type="search"
            inputMode="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, company…"
            className="w-full h-11 bg-white/[0.05] border border-white/[0.08] rounded-xl pl-9 pr-9 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-[#4FD1FF]/35 transition-colors"
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 p-1"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <IcoX size={14} />
            </button>
          )}
        </div>

        {/* Count line */}
        {!loading && (
          <p className="text-[11px] text-white/25 mt-1.5 px-0.5">
            {total} lead{total !== 1 ? "s" : ""}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ""}
          </p>
        )}
      </div>

      {/* ── Swipe hint ── */}
      <div className="flex items-center justify-between px-5 pt-3 pb-0">
        <span className="text-[10px] text-white/20 tracking-wide">
          ← swipe left to close
        </span>
        <span className="text-[10px] text-white/20 tracking-wide">
          swipe right to follow up →
        </span>
      </div>

      {/* ── Lead list ── */}
      <div className="px-4 pt-3 pb-8">
        {loading ? (
          // Skeleton shimmer
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[130px] rounded-2xl bg-white/[0.04] animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 mt-16 text-center px-4">
            <span className="text-red-400/70"><IcoAlertCircle size={32} /></span>
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => void fetchLeads(0, debouncedSearch, true)}
              className="text-[13px] text-[#4FD1FF] border border-[#4FD1FF]/20 rounded-xl px-5 py-2 active:bg-[#4FD1FF]/10"
            >
              Retry
            </button>
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-20 text-center px-4">
            <span className="text-white/15"><IcoInbox size={36} /></span>
            <p className="text-white/30 text-sm">
              {debouncedSearch ? `No leads matching "${debouncedSearch}"` : "No leads assigned yet"}
            </p>
            {debouncedSearch && (
              <button
                onClick={() => setSearch("")}
                className="text-[13px] text-[#4FD1FF]"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {leads.map((lead, i) => (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, transition: { duration: 0.22 } }}
                  transition={{ duration: 0.28, ease: "easeOut", delay: Math.min(i * 0.04, 0.3) }}
                  layout
                >
                  <SwipeableLeadCard
                    lead={lead}
                    onAction={handleAction}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Load more */}
            {remaining > 0 && (
              <button
                onClick={() => void fetchLeads(skip, debouncedSearch, false)}
                disabled={loadingMore}
                className="w-full h-12 mt-1 rounded-2xl border border-white/[0.08] text-[13px] text-white/40 flex items-center justify-center gap-2 active:bg-white/[0.04] transition-colors disabled:opacity-60"
              >
                {loadingMore ? (
                  <span className="text-white/40"><IcoSpinner size={16} /></span>
                ) : (
                  `Load ${Math.min(TAKE, remaining)} more  ·  ${remaining} remaining`
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
