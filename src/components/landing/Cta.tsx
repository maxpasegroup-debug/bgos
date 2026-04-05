"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { staggerContainer, staggerItem } from "./motionPresets";
import { sectionDivider, sectionY } from "./spacing";

export function Cta() {
  return (
    <SectionReveal className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-[#F8FAFC] to-slate-100/80 px-6 py-16 text-center shadow-xl sm:px-12 sm:py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-red-400/20 to-amber-300/15 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-amber-200/25 blur-3xl"
            aria-hidden
          />

          <motion.h2
            variants={staggerItem}
            className="relative mx-auto max-w-3xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.5rem] lg:leading-tight"
          >
            Let NEXA Run Your Business
          </motion.h2>
          <motion.div
            variants={staggerItem}
            className="relative mt-9 flex justify-center sm:mt-10"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <Link
                href="/bgos"
                className="relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-yellow-400 px-12 py-4 text-base font-bold tracking-wide text-neutral-950 shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset,0_12px_40px_-8px_rgba(239,68,68,0.45),0_8px_32px_-6px_rgba(250,204,21,0.35)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2)_inset,0_16px_48px_-6px_rgba(239,68,68,0.5),0_12px_40px_-4px_rgba(250,204,21,0.4)]"
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
          </motion.div>
        </motion.div>
      </Container>
    </SectionReveal>
  );
}
