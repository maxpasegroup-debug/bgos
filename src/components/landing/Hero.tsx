"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Container } from "./Container";
import { heroY } from "./spacing";

const outlineCta =
  "inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-gray-300 bg-white/80 px-8 py-3.5 text-center text-sm font-semibold tracking-wide text-slate-700 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-gray-400 hover:bg-white hover:shadow-md sm:w-auto";

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
      className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-[480px]"
    >
      <div
        className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-red-500/[0.08] via-transparent to-amber-400/[0.1] blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/60 p-6 shadow-xl backdrop-blur-xl sm:p-7">
        <div className="mb-6 flex items-center justify-between border-b border-gray-200/80 pb-5">
          <div className="flex gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-slate-300" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
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
              className="rounded-xl border border-gray-200/90 bg-white/70 px-2 py-3 text-center shadow-sm sm:px-3"
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                {s.k}
              </p>
              <p className="mt-1.5 text-sm font-bold text-slate-900 sm:text-base">
                {s.v}
              </p>
              <p className="text-[10px] font-medium text-emerald-600">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-xl border border-gray-200/90 bg-white/50 p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Pipeline velocity
          </p>
          <svg
            viewBox="0 0 240 64"
            className="h-14 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="heroLineLight" x1="0" x2="1" y1="0" y2="0">
                <stop stopColor="#ef4444" />
                <stop offset="1" stopColor="#facc15" />
              </linearGradient>
              <linearGradient id="heroAreaLight" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="#ef4444" stopOpacity="0.18" />
                <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
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
          className="rounded-xl border border-gray-200 bg-white/90 px-4 py-3 shadow-md"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-red-500 to-amber-400" />
            <div className="text-left">
              <p className="text-xs font-semibold text-slate-900">New lead</p>
              <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-600">
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
              className="text-xs font-semibold tracking-wide text-slate-500 sm:text-sm sm:text-slate-600"
            >
              BGOS – Business Growth Operating System
            </motion.p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
              <span className="block bg-gradient-to-r from-red-500 to-yellow-400 bg-clip-text text-transparent">
                Run Your Business.
              </span>
              <span className="mt-1 block bg-gradient-to-r from-red-500 to-yellow-400 bg-clip-text text-transparent">
                Not Your Problems.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-base font-normal leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              BGOS automates, manages, and grows your business — while you
              focus on what truly matters.
            </p>
            <div className="mt-9 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:items-center lg:mx-0">
              <motion.div
                className="w-full sm:w-auto"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href="/signup"
                  className="relative inline-flex min-h-[46px] w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-yellow-400 px-8 py-3.5 text-sm font-bold tracking-wide text-neutral-950 shadow-lg shadow-red-500/25 transition-shadow duration-300 hover:shadow-xl hover:shadow-amber-400/30 sm:w-auto"
                >
                  <span
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    aria-hidden
                  >
                    <span className="animate-btn-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                  </span>
                  <span className="relative z-10">Start Free</span>
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
                <Link href="#what-is-bgos" className={outlineCta}>
                  See How It Works
                </Link>
              </motion.div>
            </div>
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
