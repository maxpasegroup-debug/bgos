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
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/25 via-[#121821] to-violet-500/15 px-6 py-16 text-center shadow-xl sm:px-12 sm:py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/25 to-violet-300/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-indigo-200/20 blur-3xl"
            aria-hidden
          />

          <motion.h2
            variants={staggerItem}
            className="relative mx-auto max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem] lg:leading-tight"
          >
            Take Control of Your Business Today
          </motion.h2>
          <motion.div
            variants={staggerItem}
            className="relative mt-9 flex flex-col justify-center gap-3 sm:mt-10 sm:flex-row"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <Link
                href="/signup"
                className="relative inline-flex min-h-[52px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-12 py-4 text-base font-bold tracking-wide text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_12px_40px_-8px_rgba(99,102,241,0.5)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2)_inset,0_16px_48px_-6px_rgba(139,92,246,0.5)]"
              >
                <span
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                  aria-hidden
                >
                  <span className="animate-btn-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                </span>
                <span className="relative z-10">Start Free Trial</span>
              </Link>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <a
                href="https://wa.me/918089239823?text=Hi%20I%20want%20BGOS"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-12 py-4 text-base font-semibold tracking-wide text-white/90 transition hover:bg-white/[0.1]"
              >
                Talk to Team (WhatsApp)
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </Container>
    </SectionReveal>
  );
}
