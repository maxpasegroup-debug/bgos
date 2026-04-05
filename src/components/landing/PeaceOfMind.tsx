"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { sectionDivider, sectionY } from "./spacing";

export function PeaceOfMind() {
  return (
    <SectionReveal className={`relative ${sectionDivider} ${sectionY}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[min(92vw,520px)] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(239,68,68,0.09)_0%,_rgba(250,204,21,0.06)_45%,_transparent_68%)] blur-2xl" />
      </div>

      <Container className="relative">
        <motion.div
          className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white/80 px-8 py-14 text-center shadow-lg backdrop-blur-md sm:px-12 sm:py-16"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          <h2 className="text-3xl font-bold leading-snug tracking-tight text-slate-900 sm:text-4xl">
            Finally, a system that runs your business
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base font-normal leading-relaxed text-slate-600 sm:mt-8 sm:text-lg">
            No more chaos. No more overload. Just growth.
          </p>
        </motion.div>
      </Container>
    </SectionReveal>
  );
}
