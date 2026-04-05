"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { sectionDivider, sectionY } from "./spacing";

export function PeaceOfMind() {
  return (
    <SectionReveal className={`relative ${sectionDivider} ${sectionY}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[min(92vw,560px)] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(250,204,21,0.16)_0%,_rgba(250,204,21,0.06)_48%,_transparent_72%)] blur-2xl" />
        <div className="absolute bottom-0 left-0 right-0 h-2/5 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <Container className="relative">
        <motion.div
          className="mx-auto max-w-3xl rounded-xl border border-white/[0.08] bg-white/[0.04] px-8 py-16 text-center shadow-xl backdrop-blur-xl sm:px-14 sm:py-20"
          animate={{ scale: [1, 1.008, 1] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <h2 className="text-3xl font-bold leading-snug tracking-tight text-white sm:text-4xl lg:text-[2.5rem]">
            Finally, a system that runs your business
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-base font-normal leading-relaxed tracking-wide text-gray-400 sm:mt-10 sm:text-lg">
            No more chaos. No more overload. Just growth.
          </p>
        </motion.div>
      </Container>
    </SectionReveal>
  );
}
