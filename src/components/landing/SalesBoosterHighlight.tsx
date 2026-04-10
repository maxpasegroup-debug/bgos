"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { blockGap, sectionDivider, sectionY } from "./spacing";

const channels = ["WhatsApp", "Instagram", "Facebook", "Email", "SMS"] as const;
const benefits = [
  "Auto lead capture",
  "Auto follow-ups",
  "No missed enquiries",
  "Smart routing",
] as const;

export function SalesBoosterHighlight() {
  return (
    <SectionReveal id="sales-booster" className={`${sectionDivider} ${sectionY}`}>
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] via-[#121821] to-[#1f1b3a] p-8 shadow-[0_0_70px_-20px_rgba(99,102,241,0.45)] sm:p-10">
          <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-violet-500/25 blur-3xl" />

          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Your Sales Engine, Running 24/7
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            Connect WhatsApp, Instagram, Facebook and more. BGOS captures leads, assigns them, and follows up automatically using Nexa.
          </p>

          <div className={`grid gap-4 sm:grid-cols-5 ${blockGap}`}>
            {channels.map((channel) => (
              <motion.div
                key={channel}
                whileHover={{ y: -4 }}
                className="rounded-xl border border-indigo-300/20 bg-white/[0.04] px-4 py-3 text-center text-sm font-medium text-indigo-100"
              >
                {channel}
              </motion.div>
            ))}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {benefits.map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Link
              href="/sales-booster"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-7 text-sm font-semibold tracking-wide text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110"
            >
              Explore Sales Booster
            </Link>
          </div>
        </div>
      </Container>
    </SectionReveal>
  );
}
