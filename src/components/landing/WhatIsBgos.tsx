"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { staggerContainer, staggerItem } from "./motionPresets";
import { blockGap, sectionDivider, sectionY } from "./spacing";

export function WhatIsBgos() {
  return (
    <SectionReveal
      id="what-is-bgos"
      className={`scroll-mt-24 ${sectionDivider} ${sectionY}`}
    >
      <Container>
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={staggerItem}
            className="text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            Your Business. Fully Automated.
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-5 max-w-2xl text-center text-base font-normal leading-relaxed text-slate-600 sm:mt-6 sm:text-lg"
          >
            BGOS sits between you and your business.{" "}
            <span className="font-medium text-slate-800">NEXA AI</span> runs
            operations — so decisions, follow-ups, and workflows keep moving even
            when you step away.
          </motion.p>
        </motion.div>

        <motion.div
          className={`flex flex-col items-stretch gap-6 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4 lg:gap-8 ${blockGap}`}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          variants={staggerContainer}
        >
          <FlowNode label="You" sub="Strategy & vision" />
          <FlowArrows />
          <FlowNode label="BGOS" sub="NEXA AI" highlight />
          <FlowArrows />
          <FlowNode label="Business" sub="Growth on autopilot" />
        </motion.div>
      </Container>
    </SectionReveal>
  );
}

function FlowNode({
  label,
  sub,
  highlight,
}: {
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={`mx-auto flex w-full max-w-sm flex-col items-center rounded-xl border px-7 py-8 text-center shadow-sm transition-shadow duration-300 sm:mx-0 sm:max-w-none sm:min-w-0 sm:flex-1 sm:py-9 ${
        highlight
          ? "border-red-200/80 bg-gradient-to-b from-red-50/90 to-amber-50/50 shadow-md shadow-red-500/5"
          : "border-gray-200 bg-white hover:shadow-md"
      }`}
    >
      <span className="text-lg font-bold tracking-tight text-slate-900">
        {label}
      </span>
      <span className="mt-2 text-sm font-normal tracking-wide text-slate-600">
        {sub}
      </span>
    </motion.div>
  );
}

function FlowArrows() {
  return (
    <motion.div
      variants={staggerItem}
      className="flex shrink-0 items-center justify-center py-1 sm:w-12 sm:py-0"
    >
      <motion.span
        className="text-2xl font-light leading-none text-amber-500 sm:hidden"
        animate={{ y: [0, 6, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        aria-hidden
      >
        ↓
      </motion.span>
      <motion.span
        className="hidden text-2xl font-light leading-none text-amber-500 sm:inline"
        animate={{ x: [0, 8, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        aria-hidden
      >
        →
      </motion.span>
    </motion.div>
  );
}
