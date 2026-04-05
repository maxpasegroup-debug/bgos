"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { staggerContainer, staggerItem } from "./motionPresets";
import { blockGap, sectionDivider, sectionY } from "./spacing";
import { useMemo } from "react";

type SymbolDrop = { label: string; delay: number; left: number; pill?: boolean };

const symbols: SymbolDrop[] = [
  { label: "₹", delay: 0, left: 18 },
  { label: "📈", delay: 1.4, left: 42 },
  { label: "leads", delay: 2.6, left: 62, pill: true },
  { label: "📊", delay: 0.7, left: 82 },
  { label: "₹", delay: 3.2, left: 32 },
];

export function BusinessShowers() {
  const particles = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: `${8 + (i * 17) % 84}%`,
        delay: (i % 8) * 0.4,
        duration: 16 + (i % 5) * 2,
        size: i % 5 === 0 ? 2.5 : 1.5,
      })),
    []
  );

  return (
    <SectionReveal className={`relative overflow-hidden ${sectionDivider} ${sectionY}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-transparent" />

      <Container className="relative text-center">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={staggerItem}
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
          >
            Hosting Business Showers
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-5 max-w-xl text-base font-normal leading-relaxed text-slate-600 sm:mt-6 sm:text-lg"
          >
            Leads, revenue, automation — flowing continuously
          </motion.p>
        </motion.div>

        <div
          className={`relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white/70 shadow-lg backdrop-blur-md ${blockGap} h-[280px] sm:h-[320px]`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(239,68,68,0.06),transparent_58%)]" />

          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute top-0 rounded-full bg-gradient-to-b from-amber-300/50 to-red-400/35"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                translateX: "-50%",
              }}
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: [0, 320], opacity: [0, 0.5, 0.45, 0.1] }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: "linear",
                delay: p.delay,
                times: [0, 0.06, 0.88, 1],
              }}
            />
          ))}

          {symbols.map((s) => (
            <motion.div
              key={`${s.label}-${s.left}-${s.delay}`}
              className={`absolute top-0 flex -translate-x-1/2 items-center justify-center font-semibold tracking-wide text-slate-800 ${
                s.pill
                  ? "rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-[10px] uppercase shadow-sm backdrop-blur-sm"
                  : "text-base sm:text-lg"
              }`}
              style={{ left: `${s.left}%` }}
              initial={{ y: -24, opacity: 0 }}
              animate={{
                y: [0, 300],
                opacity: [0, 0.9, 0.85, 0.15],
                rotate: [0, s.pill === true ? 0 : 3],
              }}
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "linear",
                delay: s.delay,
                times: [0, 0.05, 0.9, 1],
              }}
            >
              {s.label}
            </motion.div>
          ))}
        </div>
      </Container>
    </SectionReveal>
  );
}
