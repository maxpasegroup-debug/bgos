"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { BGOS_GRID_GAP, BGOS_MAIN_PAD } from "./layoutTokens";
import { fadeUp, sectionReveal, staggerRow } from "./motion";

function SkelLine({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.08] ${className}`}
      style={style}
      aria-hidden
    />
  );
}

function SkelCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-md sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function BgosDashboardSkeletons() {
  return (
    <motion.div
      className={`grid grid-cols-1 pb-12 pt-4 md:grid-cols-2 lg:grid-cols-3 ${BGOS_GRID_GAP} ${BGOS_MAIN_PAD}`}
      variants={sectionReveal}
      initial="hidden"
      animate="show"
    >
      <span className="sr-only">Loading dashboard</span>

      <motion.section
        variants={fadeUp}
        className={`col-span-full grid grid-cols-1 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 ${BGOS_GRID_GAP}`}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div key={i} variants={fadeUp}>
            <SkelCard>
              <SkelLine className="h-8 w-24 sm:h-9 sm:w-28" />
              <SkelLine className="mt-4 h-3 w-32" />
            </SkelCard>
          </motion.div>
        ))}
      </motion.section>

      <motion.section variants={fadeUp} className="col-span-full lg:col-span-2">
        <SkelCard className="min-h-[220px] p-6 sm:min-h-[240px] sm:p-8">
          <SkelLine className="h-5 w-3/4 max-w-sm" />
          <div className="mt-6 space-y-3">
            <SkelLine className="h-4 w-full max-w-md" />
            <SkelLine className="h-4 w-full max-w-lg" />
            <SkelLine className="h-4 w-full max-w-sm" />
          </div>
          <div className="mt-8 flex gap-3">
            <SkelLine className="h-11 w-28 rounded-xl" />
            <SkelLine className="h-11 w-32 rounded-xl" />
          </div>
        </SkelCard>
      </motion.section>

      <motion.section variants={fadeUp}>
        <SkelCard className="space-y-5 p-6 sm:p-7">
          <SkelLine className="h-3 w-28" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between gap-2">
                <SkelLine className="h-3 w-24" />
                <SkelLine className="h-3 w-10" />
              </div>
              <SkelLine className="h-2 w-full rounded-full" />
            </div>
          ))}
        </SkelCard>
      </motion.section>

      <motion.section variants={fadeUp} className="col-span-full">
        <SkelCard className="p-5 sm:p-6">
          <SkelLine className="h-4 w-36" />
          <SkelLine className="mt-4 mb-3 hidden h-1 w-full rounded-full md:block" />
          <div className="flex gap-2 overflow-hidden pt-2">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex shrink-0 items-center gap-2">
                <SkelCard className="w-[5.5rem] p-3 sm:w-24">
                  <SkelLine className="h-6 w-8" />
                  <SkelLine className="mt-2 h-3 w-full" />
                </SkelCard>
                {i < 6 ? <SkelLine className="h-px w-4" /> : null}
              </div>
            ))}
          </div>
        </SkelCard>
      </motion.section>

      <motion.section variants={fadeUp} className="col-span-full">
        <SkelCard className="p-6 sm:p-7">
          <div className="flex justify-between gap-4">
            <div className="flex-1 space-y-3">
              <SkelLine className="h-4 w-48" />
              <SkelLine className="h-3 w-full max-w-xs" />
              <SkelLine className="h-3 w-full max-w-sm" />
              <SkelLine className="h-3 w-full max-w-xs" />
            </div>
            <SkelLine className="h-8 w-14 shrink-0 rounded-full" />
          </div>
        </SkelCard>
      </motion.section>

      <motion.section
        variants={staggerRow}
        className={`col-span-full grid grid-cols-2 lg:grid-cols-4 ${BGOS_GRID_GAP}`}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div key={i} variants={fadeUp}>
            <SkelCard className="p-4 sm:p-5">
              <SkelLine className="h-8 w-12" />
              <SkelLine className="mt-3 h-3 w-24" />
            </SkelCard>
          </motion.div>
        ))}
        <motion.div variants={fadeUp} className="col-span-full">
          <SkelCard className="overflow-hidden p-0">
            <SkelLine className="h-0.5 w-full rounded-none" />
            <div className="px-4 py-3.5 sm:px-5">
              <SkelLine className="h-4 w-48" />
            </div>
          </SkelCard>
        </motion.div>
      </motion.section>

      <motion.section
        variants={staggerRow}
        className={`col-span-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${BGOS_GRID_GAP}`}
      >
        {[0, 1, 2].map((i) => (
          <motion.div key={i} variants={fadeUp}>
            <SkelCard className="p-6">
              <SkelLine className="h-4 w-28" />
              <SkelLine className="mt-4 h-9 w-16" />
              <SkelLine className="mt-2 h-3 w-24" />
              <SkelLine className="mt-4 h-2 w-full rounded-full" />
            </SkelCard>
          </motion.div>
        ))}
      </motion.section>

      <motion.section variants={fadeUp} className="col-span-full space-y-4">
        <div className={`grid grid-cols-2 lg:grid-cols-4 ${BGOS_GRID_GAP}`}>
          {[0, 1, 2, 3].map((i) => (
            <SkelCard key={i} className="p-5">
              <SkelLine className="h-3 w-28" />
              <SkelLine className="mt-1 h-2 w-16" />
              <SkelLine className="mt-3 h-7 w-24" />
            </SkelCard>
          ))}
        </div>
        <SkelCard className="p-6">
          <SkelLine className="h-3 w-32" />
          <SkelLine className="mt-1 h-2 w-20" />
          <div className="mt-4 flex h-36 items-end gap-1">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkelLine
                key={i}
                className="min-w-0 flex-1 rounded-t-sm"
                style={{ height: `${35 + (i * 7) % 55}%` }}
              />
            ))}
          </div>
        </SkelCard>
      </motion.section>

      <motion.section
        variants={fadeUp}
        className={`col-span-full grid grid-cols-1 md:grid-cols-2 ${BGOS_GRID_GAP}`}
      >
        <SkelCard className="min-h-[180px] p-6">
          <div className="space-y-3">
            <SkelLine className="h-3 w-24" />
            <SkelLine className="h-4 w-full" />
            <SkelLine className="h-4 w-[80%]" />
          </div>
        </SkelCard>
        <SkelCard className="min-h-[180px] p-6">
          <div className="space-y-3">
            <SkelLine className="h-3 w-28" />
            <SkelLine className="h-4 w-full" />
            <SkelLine className="h-4 w-[80%]" />
          </div>
        </SkelCard>
      </motion.section>

      <motion.section variants={fadeUp} className="col-span-full">
        <SkelCard className="p-5 sm:p-6">
          <SkelLine className="h-3 w-40" />
          <SkelLine className="mt-4 h-16 w-full max-w-2xl" />
          <SkelLine className="mt-4 h-8 w-full max-w-xs" />
          <SkelLine className="mt-4 h-10 w-full sm:max-w-md" />
        </SkelCard>
      </motion.section>
    </motion.div>
  );
}
