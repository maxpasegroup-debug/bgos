"use client";

import { motion, type Variants } from "framer-motion";
import { DashboardSurface } from "./DashboardSurface";

const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  },
};

const risks = [
  { label: "Lost leads", value: 7 },
  { label: "Delayed installations", value: 2 },
  { label: "Complaints", value: 3 },
] as const;

const opportunities = [
  { label: "Hot leads", value: 14 },
  { label: "Upsell chances", value: 6 },
  { label: "Referrals", value: 9 },
] as const;

export function RisksOpportunitiesSection() {
  return (
    <motion.section
      id="risks"
      className="scroll-mt-28 border-t border-white/10 pb-12 pt-10 sm:pb-14 sm:pt-11"
      variants={sectionVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8%" }}
    >
      <motion.h2
        variants={itemVariants}
        className="mb-6 text-lg font-semibold tracking-tight text-white/90 sm:text-xl"
      >
        Risk &amp; Opportunities
      </motion.h2>

      <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-2 lg:gap-8">
        <RisksPanel />
        <OpportunitiesPanel />
      </div>
    </motion.section>
  );
}

function RisksPanel() {
  return (
    <motion.div variants={itemVariants} className="relative">
      <DashboardSurface className="relative overflow-hidden !border-red-500/35 bg-red-500/[0.06] p-6 ring-1 ring-red-500/15 sm:p-7">
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-red-500/15 blur-2xl"
        aria-hidden
      />
      <h3 className="relative text-xs font-bold uppercase tracking-[0.15em] text-red-300/90">
        Risks
      </h3>
      <ul className="relative mt-5 space-y-4">
        {risks.map((r, i) => (
          <motion.li
            key={r.label}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{
              delay: i * 0.06,
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="flex items-center justify-between gap-3 border-b border-red-500/15 pb-4 last:border-0 last:pb-0"
          >
            <span className="text-sm font-medium text-white/85">{r.label}</span>
            <span className="text-lg font-bold tabular-nums text-red-200">
              {r.value}
            </span>
          </motion.li>
        ))}
      </ul>
      </DashboardSurface>
    </motion.div>
  );
}

function OpportunitiesPanel() {
  return (
    <motion.div variants={itemVariants} className="relative">
      <DashboardSurface className="relative overflow-hidden !border-[#FFC300]/40 bg-[#FFC300]/[0.07] p-6 ring-1 ring-[#FFC300]/20 sm:p-7">
      <div
        className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-[#FFC300]/12 blur-2xl"
        aria-hidden
      />
      <h3 className="relative text-xs font-bold uppercase tracking-[0.15em] text-[#FFC300]">
        Opportunities
      </h3>
      <ul className="relative mt-5 space-y-4">
        {opportunities.map((o, i) => (
          <motion.li
            key={o.label}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{
              delay: i * 0.06,
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="flex items-center justify-between gap-3 border-b border-[#FFC300]/20 pb-4 last:border-0 last:pb-0"
          >
            <span className="text-sm font-medium text-white/85">{o.label}</span>
            <span className="text-lg font-bold tabular-nums text-[#FFE066]">
              {o.value}
            </span>
          </motion.li>
        ))}
      </ul>
      </DashboardSurface>
    </motion.div>
  );
}
