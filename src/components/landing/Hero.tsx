"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "./Container";
import { heroY } from "./spacing";
import { OnboardBossButton } from "@/components/onboarding/OnboardBossButton";

const outlineCta =
  "inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] px-8 py-3.5 text-center text-sm font-semibold tracking-wide text-white/90 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:bg-white/[0.08] hover:shadow-md sm:w-auto";

function HeroDashboard() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      animate={reduceMotion ? undefined : { y: [-10, 10, -10] }}
      transition={
        reduceMotion
          ? undefined
          : { duration: 7, repeat: Infinity, ease: "easeInOut" }
      }
      className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-[500px]"
    >
      <div
        className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-indigo-500/[0.22] via-violet-500/[0.12] to-cyan-400/[0.15] blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#121821]/85 p-6 shadow-xl backdrop-blur-xl sm:p-7">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-white/40" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            NEXA
          </span>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { k: "Leads", v: "128", d: "+18%" },
            { k: "Rev", v: "₹4.2L", d: "+12%" },
            { k: "Auto", v: "94%", d: "↑" },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-3 text-center shadow-sm sm:px-3"
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/45">
                {s.k}
              </p>
              <p className="mt-1.5 text-sm font-bold text-white sm:text-base">
                {s.v}
              </p>
              <p className="text-[10px] font-medium text-emerald-600">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/45">
            Pipeline velocity
          </p>
          <svg
            viewBox="0 0 240 64"
            className="h-14 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="heroLineLight" x1="0" x2="1" y1="0" y2="0">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="heroAreaLight" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="#6366f1" stopOpacity="0.22" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 48 L 36 40 L 72 44 L 108 28 L 144 32 L 180 18 L 216 22 L 240 8 L 240 64 L 0 64 Z"
              fill="url(#heroAreaLight)"
            />
            <motion.path
              d="M 0 48 L 36 40 L 72 44 L 108 28 L 144 32 L 180 18 L 216 22 L 240 8"
              fill="none"
              stroke="url(#heroLineLight)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: 2.4,
                ease: [0.4, 0, 0.2, 1],
                repeat: Infinity,
                repeatDelay: 3.5,
              }}
            />
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 shadow-md"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-red-500 to-amber-400" />
            <div className="text-left">
              <p className="text-xs font-semibold text-white">New lead</p>
              <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-white/65">
                Meridian Labs — qualified and routed to pipeline
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className={`relative overflow-hidden ${heroY}`}>
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
            className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left"
          >
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
            className="text-xs font-semibold tracking-wide text-white/55 sm:text-sm"
            >
              BGOS – Business Growth Operating System
            </motion.p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl">
              Turn More Enquiries Into Confirmed Jobs - Without Chasing Every Lead
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-base font-normal leading-relaxed text-white/70 sm:text-lg lg:mx-0">
              BGOS brings your leads, follow-ups, team, and revenue into one simple system - so nothing gets missed.
            </p>
            <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center lg:mx-0">
              <motion.div
                className="w-full sm:w-auto"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <OnboardBossButton className="relative min-h-[46px] w-full px-8 py-3.5 text-sm font-bold tracking-wide sm:w-auto" />
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
                <Link href="#solution" className={outlineCta}>
                  See How It Works
                </Link>
              </motion.div>
            </div>
            <p className="mt-4 text-sm font-medium text-white/50">Built for real business owners</p>
          </motion.div>

          <motion.div
            className="flex w-full justify-center lg:justify-end"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.12 }}
          >
            <HeroDashboard />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
