"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { staggerContainer, staggerItem } from "./motionPresets";
import { blockGap, sectionDivider, sectionY } from "./spacing";

export function WhatIsBgos() {
  return (
    <SectionReveal
      id="solution"
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
            className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Meet Nexa - Your Virtual CEO
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-5 max-w-3xl text-center text-base font-normal leading-relaxed text-white/70 sm:mt-6 sm:text-lg"
          >
            Nexa guides your business daily - from planning to execution to growth decisions. No guesswork. Just clarity and action.
          </motion.p>
        </motion.div>

        <motion.div
          className={`grid gap-6 sm:grid-cols-3 ${blockGap}`}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-10%" }}
          variants={staggerContainer}
        >
          <FlowNode label="Daily direction" sub="Know what matters first" />
          <FlowNode label="Smart decisions" sub="Move with confidence" highlight />
          <FlowNode label="Team alignment" sub="Keep everyone on one path" />
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
      className={`mx-auto flex w-full max-w-sm flex-col items-center rounded-xl border px-7 py-8 text-center shadow-sm transition-shadow duration-300 sm:mx-0 sm:max-w-none sm:min-w-0 sm:py-9 ${
        highlight
          ? "border-indigo-400/40 bg-gradient-to-b from-indigo-500/20 to-violet-500/10 shadow-md shadow-indigo-500/20"
          : "border-white/10 bg-white/[0.03] hover:shadow-md"
      }`}
    >
      <span className="text-lg font-bold tracking-tight text-white">
        {label}
      </span>
      <span className="mt-2 text-sm font-normal tracking-wide text-white/65">
        {sub}
      </span>
    </motion.div>
  );
}
