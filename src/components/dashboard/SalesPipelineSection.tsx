"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { DashboardSurface } from "./DashboardSurface";

const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  },
};

const stages = [
  {
    key: "new",
    label: "New Lead",
    count: 28,
    border: "!border-sky-400/35",
    bg: "bg-sky-500/[0.07]",
    bar: "from-sky-400 to-sky-600",
  },
  {
    key: "contacted",
    label: "Contacted",
    count: 22,
    border: "!border-indigo-400/35",
    bg: "bg-indigo-500/[0.07]",
    bar: "from-indigo-400 to-indigo-600",
  },
  {
    key: "qualified",
    label: "Qualified",
    count: 16,
    border: "!border-violet-400/35",
    bg: "bg-violet-500/[0.07]",
    bar: "from-violet-400 to-violet-600",
  },
  {
    key: "site",
    label: "Site Visit",
    count: 11,
    border: "!border-teal-400/35",
    bg: "bg-teal-500/[0.07]",
    bar: "from-teal-400 to-teal-600",
  },
  {
    key: "proposal",
    label: "Proposal",
    count: 8,
    border: "!border-amber-400/35",
    bg: "bg-amber-500/[0.07]",
    bar: "from-amber-400 to-amber-600",
  },
  {
    key: "negotiation",
    label: "Negotiation",
    count: 5,
    border: "!border-orange-400/35",
    bg: "bg-orange-500/[0.07]",
    bar: "from-orange-400 to-orange-600",
  },
  {
    key: "closed",
    label: "Won / Lost",
    count: 18,
    sub: "14 won · 4 lost",
    border: "!border-emerald-400/30",
    bg: "bg-gradient-to-b from-emerald-500/[0.08] to-rose-500/[0.06]",
    bar: "from-emerald-400 to-rose-500",
  },
] as const;

export function SalesPipelineSection() {
  return (
    <motion.section
      id="sales"
      className="scroll-mt-28 border-t border-white/10 pb-12 pt-10 sm:pb-14 sm:pt-11"
      variants={sectionVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8%" }}
    >
      <motion.h2
        variants={itemVariants}
        className="mb-7 text-lg font-semibold tracking-tight text-white/90 sm:mb-8 sm:text-xl"
      >
        Sales Pipeline
      </motion.h2>

      {/* Desktop: full-width flow line above cards */}
      <motion.div variants={itemVariants} className="relative mb-3 hidden md:block">
        <div
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]"
          aria-hidden
        >
          <motion.div
            className="absolute inset-y-0 w-[32%] rounded-full bg-gradient-to-r from-transparent via-[#FFC300]/65 to-transparent"
            animate={{ x: ["-100%", "320%"] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="relative flex min-w-0 items-stretch gap-0 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]"
      >
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex shrink-0 items-stretch">
            <StageCard stage={stage} />
            {i < stages.length - 1 ? <PipelineConnector index={i} /> : null}
          </div>
        ))}
      </motion.div>

      {/* Mobile flow strip */}
      <motion.div variants={itemVariants} className="mt-5 md:hidden">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-[#FF3B3B]/35 via-[#FFC300]/55 to-[#FF3B3B]/35"
            animate={{ x: ["-45%", "220%"] }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>
      </motion.div>

      <ConversionInsightCard />
    </motion.section>
  );
}

function StageCard({ stage }: { stage: (typeof stages)[number] }) {
  return (
    <DashboardSurface
      tilt={false}
      className={`flex w-[7.5rem] flex-col border bg-white/5 p-4 sm:w-[8rem] ${stage.border} ${stage.bg}`}
    >
      <div
        className={`mb-3 h-1 w-full rounded-full bg-gradient-to-r ${stage.bar}`}
        aria-hidden
      />
      <p className="text-2xl font-bold tabular-nums tracking-tight text-white">
        {stage.count}
      </p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wider text-white/50">
        {stage.label}
      </p>
      {"sub" in stage && stage.sub ? (
        <p className="mt-2 text-[10px] leading-snug text-white/40">{stage.sub}</p>
      ) : null}
    </DashboardSurface>
  );
}

function PipelineConnector({ index }: { index: number }) {
  return (
    <div className="relative flex w-7 shrink-0 items-center self-center sm:w-9">
      <div className="h-0.5 w-full rounded-full bg-white/18" aria-hidden />
      <motion.div
        className="pointer-events-none absolute left-0 top-1/2 h-1 w-4 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#FF3B3B] to-[#FFC300] shadow-[0_0_10px_rgba(255,195,0,0.45)]"
        animate={{
          left: ["0%", "calc(100% - 1rem)"],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: index * 0.15,
          repeatDelay: 0.4,
        }}
      />
    </div>
  );
}

function ConversionInsightCard() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={itemVariants}
      className="mt-8"
      animate={
        reduceMotion ? undefined : { opacity: [0.93, 1, 0.93] }
      }
      transition={{
        duration: 3.6,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <DashboardSurface
        tilt={false}
        className="!border-amber-500/35 bg-amber-500/[0.08] px-5 py-4 backdrop-blur-md"
      >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/25 text-amber-300"
          aria-hidden
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-200/90">
            Conversion insight
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-amber-100/95">
            Conversion dropped after site visits
          </p>
        </div>
      </div>
      </DashboardSurface>
    </motion.div>
  );
}
