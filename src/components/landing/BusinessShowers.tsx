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
  { label: "📈", delay: 1.2, left: 42 },
  { label: "leads", delay: 2.4, left: 62, pill: true },
  { label: "📊", delay: 0.6, left: 82 },
  { label: "₹", delay: 3, left: 32 },
];

export function BusinessShowers() {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: `${6 + (i * 19) % 88}%`,
        delay: (i % 8) * 0.35,
        duration: 12 + (i % 5) * 1.4,
        size: i % 5 === 0 ? 2.5 : 1.5,
      })),
    []
  );

  return (
    <SectionReveal className={`relative overflow-hidden ${sectionDivider} ${sectionY}`}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0B0F19]/30 to-transparent" />

      <Container className="relative text-center">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-12%" }}
          variants={staggerContainer}
        >
          <motion.h2
            variants={staggerItem}
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.5rem]"
          >
            Hosting Business Showers
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-6 max-w-xl text-base font-normal tracking-wide text-gray-400 sm:mt-8 sm:text-lg"
          >
            Leads, revenue, automation flow continuously
          </motion.p>
        </motion.div>

        <div
          className={`relative mx-auto max-w-3xl overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] shadow-xl backdrop-blur-md ${blockGap} h-[300px] sm:h-[360px]`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(239,68,68,0.08),transparent_60%)]" />

          {particles.map((p) => (
            <motion.span
              key={p.id}
              className="absolute top-0 rounded-full bg-gradient-to-b from-yellow-400/55 to-red-500/35"
              style={{
                left: p.left,
                width: p.size,
                height: p.size,
                translateX: "-50%",
              }}
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: [0, 360], opacity: [0, 0.55, 0.55, 0.15] }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                ease: "linear",
                delay: p.delay,
                times: [0, 0.05, 0.9, 1],
              }}
            />
          ))}

          {symbols.map((s) => (
            <motion.div
              key={`${s.label}-${s.left}-${s.delay}`}
              className={`absolute top-0 flex -translate-x-1/2 items-center justify-center font-semibold tracking-wide text-white/90 ${
                s.pill
                  ? "rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] uppercase backdrop-blur-sm"
                  : "text-base sm:text-lg"
              }`}
              style={{ left: `${s.left}%` }}
              initial={{ y: -24, opacity: 0 }}
              animate={{
                y: [0, 340],
                opacity: [0, 0.85, 0.85, 0.2],
                rotate: [0, s.pill === true ? 0 : 4],
              }}
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: "linear",
                delay: s.delay,
                times: [0, 0.04, 0.92, 1],
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
