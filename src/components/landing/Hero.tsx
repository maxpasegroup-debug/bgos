"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "./Container";
import { PrimaryButton } from "./PrimaryButton";
import { heroY } from "./spacing";
import { useMemo } from "react";

const secondaryCta =
  "inline-flex min-h-[46px] w-full items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-8 py-3.5 text-center text-sm font-semibold tracking-wide text-white backdrop-blur-md transition-all duration-500 ease-out hover:border-white/15 hover:bg-white/[0.06] sm:w-auto";

function HeroParticles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: `${8 + (i * 41) % 84}%`,
        top: `${10 + (i * 19) % 70}%`,
        duration: 8 + (i % 4) * 1.2,
        delay: i * 0.4,
        size: i % 4 === 0 ? 2.5 : 2,
      })),
    []
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className={
            d.id % 3 === 0
              ? "absolute rounded-full bg-red-400/50 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
              : "absolute rounded-full bg-yellow-400/45 shadow-[0_0_10px_rgba(250,204,21,0.2)]"
          }
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
          }}
          animate={{
            y: [0, -8, 2, 0],
            x: [0, 4, -2, 0],
            opacity: [0.2, 0.55, 0.35, 0.2],
          }}
          transition={{
            duration: d.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

function GrowthArrow() {
  return (
    <div
      className="pointer-events-none absolute -right-2 bottom-[22%] z-10 hidden w-32 opacity-70 sm:block lg:right-2 lg:w-40"
      aria-hidden
    >
      <svg viewBox="0 0 200 160" className="h-auto w-full overflow-visible">
        <defs>
          <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#facc15" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        <motion.path
          d="M 16 132 Q 72 96 120 56 T 184 20"
          fill="none"
          stroke="url(#arrowGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.5 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: {
              duration: 4.5,
              ease: [0.4, 0, 0.2, 1],
              repeat: Infinity,
              repeatType: "reverse",
              repeatDelay: 1.4,
            },
            opacity: { duration: 0.8 },
          }}
        />
        <motion.path
          d="M 168 14 L 184 20 L 176 36"
          fill="none"
          stroke="url(#arrowGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </svg>
    </div>
  );
}

function HeroDashboard() {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-[460px]"
    >
      <div
        className="absolute -inset-6 rounded-2xl bg-gradient-to-br from-red-500/15 via-transparent to-yellow-400/12 blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-5">
          <div className="flex gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500/90" />
            <span className="h-2 w-2 rounded-full bg-yellow-400/90" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
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
              className="rounded-lg border border-white/[0.08] bg-black/25 px-2 py-3 text-center sm:px-3"
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">
                {s.k}
              </p>
              <p className="mt-1.5 text-sm font-bold text-white sm:text-base">
                {s.v}
              </p>
              <p className="text-[10px] font-medium text-emerald-400/85">
                {s.d}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-lg border border-white/[0.08] bg-black/20 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Pipeline velocity
          </p>
          <svg
            viewBox="0 0 240 64"
            className="h-14 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="heroLine" x1="0" x2="1" y1="0" y2="0">
                <stop stopColor="#ef4444" />
                <stop offset="1" stopColor="#facc15" />
              </linearGradient>
              <linearGradient id="heroArea" x1="0" x2="0" y1="0" y2="1">
                <stop stopColor="#ef4444" stopOpacity="0.2" />
                <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 48 L 36 40 L 72 44 L 108 28 L 144 32 L 180 18 L 216 22 L 240 8 L 240 64 L 0 64 Z"
              fill="url(#heroArea)"
            />
            <motion.path
              d="M 0 48 L 36 40 L 72 44 L 108 28 L 144 32 L 180 18 L 216 22 L 240 8"
              fill="none"
              stroke="url(#heroLine)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: 2.8,
                ease: [0.4, 0, 0.2, 1],
                repeat: Infinity,
                repeatDelay: 4,
              }}
            />
          </svg>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left text-xs font-medium leading-relaxed tracking-wide text-white/90">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-red-500 to-yellow-400" />
            New qualified lead — Meridian Labs
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-transparent px-4 py-3 text-left text-xs font-medium leading-relaxed tracking-wide text-gray-400">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
            NEXA sent 3 follow-ups · on-brand
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <section className={`relative overflow-hidden ${heroY}`}>
      <HeroParticles />
      <GrowthArrow />

      <Container>
        <div className="grid items-start gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
            className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left"
          >
            <h1 className="text-[2rem] font-bold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-[3rem] xl:text-[3.25rem]">
              Run Your Business.
              <br />
              <span className="animate-gradient-heading">Not Your Problems.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-lg text-base font-normal leading-relaxed tracking-wide text-gray-400 sm:text-lg lg:mx-0">
              BGOS automates, manages, and grows your business — while you
              focus on what truly matters.
            </p>
            <div className="mt-10 flex w-full max-w-md flex-col gap-4 sm:max-w-none sm:flex-row sm:items-center lg:mx-0">
              <PrimaryButton href="/bgos">Start Free</PrimaryButton>
              <Link href="#what-is-bgos" className={secondaryCta}>
                See How It Works
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="flex w-full justify-center lg:justify-end"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
          >
            <HeroDashboard />
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
