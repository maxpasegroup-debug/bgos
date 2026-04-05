"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { PrimaryButton } from "./PrimaryButton";
import { staggerContainer, staggerItem } from "./motionPresets";
import { sectionDivider, sectionY } from "./spacing";

export function Cta() {
  return (
    <SectionReveal className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <motion.div
          className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] px-8 py-20 text-center shadow-xl backdrop-blur-xl sm:px-16 sm:py-24"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <div
            className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gradient-to-br from-red-500/20 to-transparent blur-3xl"
            aria-hidden
          />

          <motion.h2
            variants={staggerItem}
            className="relative mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem]"
          >
            Let NEXA Run Your Business
          </motion.h2>
          <motion.div
            variants={staggerItem}
            className="relative mt-10 flex justify-center sm:mt-12"
          >
            <PrimaryButton href="/bgos" size="lg">
              Start Free
            </PrimaryButton>
          </motion.div>
        </motion.div>
      </Container>
    </SectionReveal>
  );
}
