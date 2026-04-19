"use client";

/**
 * MobileNexaBubble
 *
 * A small floating pill fixed above the bottom nav.
 * Shows the urgency level via colour + optional pulse animation.
 * Tapping opens a slide-up sheet listing all Nexa tasks as
 * tappable chips — each chip navigates to its action route
 * and marks the task complete via /api/internal/nexa/track.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { TypingDots } from "@/components/mobile/MotionWrapper";

// ---------------------------------------------------------------------------
// Types (mirror of GET /api/internal/nexa/today)
// ---------------------------------------------------------------------------

type NexaMsg = {
  type:     "task_reminder" | "performance" | "urgency" | "recognition";
  text:     string;
  cta:      string;
  action:   string;
  priority: number;
};

type NexaResponse = {
  ok:           boolean;
  messages:     NexaMsg[];
  extraTasks:   string[];
  urgencyLevel: "calm" | "normal" | "high" | "critical";
};

// ---------------------------------------------------------------------------
// Urgency → visual style map
// ---------------------------------------------------------------------------

const URGENCY_BUBBLE: Record<string, { bg: string; text: string; pulse: boolean }> = {
  calm:     { bg: "bg-white/10  border-white/15",   text: "text-white/50",  pulse: false },
  normal:   { bg: "bg-[#4FD1FF]/15 border-[#4FD1FF]/25", text: "text-[#4FD1FF]", pulse: false },
  high:     { bg: "bg-amber-500/20 border-amber-500/30",  text: "text-amber-400", pulse: true  },
  critical: { bg: "bg-red-500/20   border-red-500/30",    text: "text-red-400",   pulse: true  },
};

const MSG_CHIP: Record<NexaMsg["type"], { border: string; dot: string; emoji: string }> = {
  task_reminder: { border: "border-l-[#4FD1FF]",   dot: "bg-[#4FD1FF]",   emoji: "⏰" },
  performance:   { border: "border-l-amber-400",   dot: "bg-amber-400",   emoji: "⚡" },
  urgency:       { border: "border-l-red-400",     dot: "bg-red-400",     emoji: "🔥" },
  recognition:   { border: "border-l-emerald-400", dot: "bg-emerald-400", emoji: "💪" },
};

// ---------------------------------------------------------------------------
// MobileNexaBubble
// ---------------------------------------------------------------------------

export function MobileNexaBubble() {
  const router = useRouter();

  const [data, setData]         = useState<NexaResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [done, setDone]         = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState(false);
  const sheetRef                = useRef<HTMLDivElement>(null);

  // Fetch Nexa messages once on mount
  useEffect(() => {
    apiFetch("/api/internal/nexa/today")
      .then((r) => r.json() as Promise<NexaResponse>)
      .then((j) => { if (j.ok) setData(j); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  // Close sheet on backdrop tap
  function onBackdropClick(e: React.MouseEvent) {
    if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }

  const handleTap = useCallback(
    async (msg: NexaMsg, idx: number) => {
      setDone((prev) => new Set([...prev, idx]));
      setOpen(false);

      // Track completion (fire-and-forget)
      apiFetch("/api/internal/nexa/track", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ event: "task_complete" }),
      }).catch(() => undefined);

      router.push(msg.action);
    },
    [router],
  );

  const urg     = data?.urgencyLevel ?? "normal";
  const style   = URGENCY_BUBBLE[urg] ?? URGENCY_BUBBLE.normal;
  const pending = (data?.messages.length ?? 0) - done.size;

  // Hide when dismissed, no data, or all done
  if (dismissed) return null;
  if (!loading && (!data || data.messages.length === 0 || pending <= 0)) return null;

  return (
    <>
      {/* ── Floating pill bubble ── */}
      <div className="fixed z-40" style={{ bottom: "96px", right: "16px" }}>
        <AnimatePresence>
          {loading ? (
            <motion.div
              key="typing"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-[7px] backdrop-blur-xl"
            >
              <TypingDots />
            </motion.div>
          ) : (
            <motion.button
              key="pill"
              onClick={() => setOpen(true)}
              aria-label="Open Nexa tasks"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={[
                "flex items-center gap-2 rounded-full border px-3 py-[7px] shadow-lg backdrop-blur-xl",
                style.bg,
                style.text,
              ].join(" ")}
            >
              {/* Urgency pulse ring */}
              {style.pulse && (
                <motion.span
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: urg === "critical" ? "rgba(239,68,68,0.5)" : "rgba(245,158,11,0.5)" }}
                  animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
                />
              )}
              <span className="text-[13px]">⚡</span>
              <span className="text-[12px] font-semibold tabular-nums">
                {pending} task{pending > 1 ? "s" : ""}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Slide-up bottom sheet ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onBackdropClick}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Sheet */}
            <motion.div
              ref={sheetRef}
              className="relative w-full rounded-t-3xl bg-[#0A0D12] border-t border-white/[0.08] shadow-[0_-8px_48px_rgba(0,0,0,0.8)] pb-[env(safe-area-inset-bottom,12px)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-[15px] font-bold text-white">Nexa Today</p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    {pending} task{pending > 1 ? "s" : ""} · tap to act
                  </p>
                </div>
                <button
                  onClick={() => setDismissed(true)}
                  className="text-[11px] text-white/25 border border-white/10 rounded-xl px-3 py-1.5"
                >
                  Dismiss
                </button>
              </div>

              {/* Task chips — staggered slide-in */}
              <div className="px-4 pb-5 space-y-2">
                {data?.messages.map((msg, i) => {
                  const chip   = MSG_CHIP[msg.type] ?? MSG_CHIP.task_reminder;
                  const isDone = done.has(i);

                  return (
                    <motion.button
                      key={i}
                      onClick={() => void handleTap(msg, i)}
                      disabled={isDone}
                      initial={{ opacity: 0, x: -18 }}
                      animate={{ opacity: isDone ? 0.35 : 1, x: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.25, ease: "easeOut" }}
                      whileTap={{ scale: 0.97 }}
                      className={[
                        "w-full flex items-center gap-3 rounded-2xl border-l-4 bg-white/[0.04] px-4 py-3.5 text-left",
                        chip.border,
                        isDone ? "opacity-35" : "",
                      ].join(" ")}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${chip.dot}`} />
                      <p
                        className={[
                          "flex-1 text-[14px] font-medium leading-snug",
                          isDone ? "line-through text-white/30" : "text-white/90",
                        ].join(" ")}
                      >
                        {msg.text}
                      </p>
                      {!isDone && (
                        <span className="text-white/25 text-[13px] shrink-0">›</span>
                      )}
                    </motion.button>
                  );
                })}

                {/* Extra tasks hint */}
                {(data?.extraTasks.length ?? 0) > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-2xl bg-amber-500/[0.07] border border-amber-500/15 px-4 py-3 mt-1"
                  >
                    <p className="text-[11px] font-semibold text-amber-400/80 mb-1.5 uppercase tracking-wide">
                      Also assigned
                    </p>
                    {data!.extraTasks.slice(0, 3).map((t, i) => (
                      <p key={i} className="text-[12px] text-white/45 leading-relaxed">· {t}</p>
                    ))}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
