"use client";

import { motion } from "framer-motion";
import { SectionReveal } from "./SectionReveal";
import { Container } from "./Container";
import { staggerContainer, staggerItem } from "./motionPresets";
import { blockGap, sectionDivider, sectionY } from "./spacing";
import type { ComponentType } from "react";

const problems = [
  "Leads come in... but no proper follow-up",
  "Team does not know who is handling what",
  "Deals get delayed or lost",
  "No clear view of revenue",
] as const;

export function BusinessShowers() {
  return (
    <SectionReveal id="problem" className={`relative overflow-hidden ${sectionDivider} ${sectionY}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(99,102,241,0.12),transparent_62%)]" />

      <Container className="relative">
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
            Where Most Businesses Lose Money
          </motion.h2>
        </motion.div>

        <div className={`grid gap-5 sm:grid-cols-2 ${blockGap}`}>
          {problems.map((line, i) => (
            <ProblemCard key={line} index={i} text={line} />
          ))}
        </div>
        <p className="mt-8 text-center text-lg font-semibold text-indigo-200">BGOS fixes this completely.</p>
      </Container>
    </SectionReveal>
  );
}

function ProblemCard({
  text,
  index,
}: {
  text: string;
  index: number;
}) {
  const icons: ComponentType<{ className?: string }>[] = [LeadIssueIcon, TeamIssueIcon, DelayIssueIcon, RevenueIssueIcon];
  const Icon = icons[index] ?? LeadIssueIcon;

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_12px_30px_-18px_rgba(99,102,241,0.35)]"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-200">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm leading-relaxed text-white/80 sm:text-base">{text}</p>
    </motion.article>
  );
}

function LeadIssueIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M10 6a4 4 0 100 8 4 4 0 000-8zm6.5 6.5L21 17" /></svg>;
}
function TeamIssueIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M16 18v-1a4 4 0 00-8 0v1m12 0v-1a3 3 0 00-3-3m-8-3a3 3 0 110-6 3 3 0 010 6zm8 1a3 3 0 100-6" /></svg>;
}
function DelayIssueIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function RevenueIssueIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.7 0-3 1-3 2s1.3 2 3 2 3 1 3 2-1.3 2-3 2m0-8V7m0 9v1m9-5a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
