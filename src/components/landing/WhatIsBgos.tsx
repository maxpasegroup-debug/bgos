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
      className={`scroll-mt-28 ${sectionDivider} ${sectionY}`}
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
            className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem]"
          >
            Your Business. Fully Automated.
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-6 max-w-2xl text-center text-base font-normal leading-relaxed tracking-wide text-gray-400 sm:mt-8 sm:text-lg"
          >
            BGOS sits between you and your business.{" "}
            <span className="text-white/90">NEXA AI</span> runs operations — so
            decisions, follow-ups, and workflows keep moving even when you step
            away.
          </motion.p>
        </motion.div>

        <motion.div
          className={`flex flex-col items-stretch gap-8 sm:flex-row sm:items-stretch sm:justify-center sm:gap-6 lg:gap-10 ${blockGap}`}
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
      className={`mx-auto flex w-full max-w-sm flex-col items-center rounded-xl border px-8 py-9 text-center sm:mx-0 sm:max-w-none sm:min-w-0 sm:flex-1 sm:py-10 ${
        highlight
          ? "border-red-500/25 bg-gradient-to-b from-red-500/[0.1] to-yellow-400/[0.05] shadow-lg shadow-red-500/5 backdrop-blur-md"
          : "border-white/[0.08] bg-white/[0.04] backdrop-blur-md"
      }`}
    >
      <span className="text-lg font-bold tracking-tight text-white">
        {label}
      </span>
      <span className="mt-3 text-sm font-normal tracking-wide text-gray-400">
        {sub}
      </span>
    </motion.div>
  );
}

function FlowArrows() {
  return (
    <motion.div
      variants={staggerItem}
      className="flex shrink-0 items-center justify-center py-2 sm:w-10 sm:py-0"
    >
      <motion.span
        className="text-xl leading-none text-yellow-400/90 sm:hidden"
        animate={{ y: [0, 5, 0] }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        aria-hidden
      >
        ↓
      </motion.span>
      <motion.span
        className="hidden text-xl leading-none text-yellow-400/90 sm:inline"
        animate={{ x: [0, 6, 0] }}
        transition={{
          duration: 4,
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
