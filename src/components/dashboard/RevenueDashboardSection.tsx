"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { DashboardSurface } from "./DashboardSurface";

const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  },
};

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const metrics = [
  {
    key: "total",
    label: "Total Revenue",
    sub: "Monthly",
    value: "₹3.18Cr",
  },
  {
    key: "pipeline",
    label: "Pipeline Value",
    sub: "Open opportunities",
    value: "₹8.4Cr",
  },
  {
    key: "closures",
    label: "Expected Closures",
    sub: "This quarter",
    value: "12",
  },
  {
    key: "pending",
    label: "Pending Payments",
    sub: "Awaiting settlement",
    value: "₹42L",
  },
] as const;

const barHeightsPct = [42, 68, 51, 82, 58, 74, 63, 91];

export function RevenueDashboardSection() {
  return (
    <motion.section
      id="revenue"
      className="scroll-mt-28 border-t border-white/10 pb-12 pt-10 sm:pb-14 sm:pt-11"
      variants={sectionVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-8%" }}
    >
      <motion.h2
        variants={itemVariants}
        className="mb-6 text-lg font-semibold tracking-tight text-white/90 sm:text-xl"
      >
        Revenue
      </motion.h2>

      <motion.div
        variants={gridVariants}
        className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4"
      >
        {metrics.map((m) => (
          <motion.div key={m.key} variants={itemVariants} className="h-full">
            <DashboardSurface className="p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                {m.label}
              </p>
              <p className="mt-0.5 text-[10px] text-white/35">{m.sub}</p>
              <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                {m.value}
              </p>
            </DashboardSurface>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={gridVariants}
        className="mt-7 grid grid-cols-1 gap-5 sm:mt-8 lg:grid-cols-3 lg:gap-6"
      >
        <MockLineGraphCard />
        <MockBarChartCard />
      </motion.div>

      <NexaRevenueSuggestion />
    </motion.section>
  );
}

function MockLineGraphCard() {
  return (
    <motion.div variants={itemVariants} className="lg:col-span-2">
      <DashboardSurface className="p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
        Revenue trend
      </p>
      <p className="mt-0.5 text-[10px] text-white/35">Mock · last 8 weeks</p>
      <div className="mt-4">
        <svg
          viewBox="0 0 320 120"
          className="h-36 w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="revLineGrad" x1="0" x2="1" y1="0" y2="0">
              <stop stopColor="#FF3B3B" />
              <stop offset="1" stopColor="#FFC300" />
            </linearGradient>
            <linearGradient id="revAreaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#FFC300" stopOpacity="0.2" />
              <stop offset="1" stopColor="#FF3B3B" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M 0 88 L 44 72 L 88 80 L 132 52 L 176 58 L 220 38 L 264 44 L 320 22 L 320 120 L 0 120 Z"
            fill="url(#revAreaGrad)"
          />
          <motion.path
            d="M 0 88 L 44 72 L 88 80 L 132 52 L 176 58 L 220 38 L 264 44 L 320 22"
            fill="none"
            stroke="url(#revLineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: 1.4,
              delay: 0.35,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        </svg>
      </div>
      </DashboardSurface>
    </motion.div>
  );
}

function MockBarChartCard() {
  return (
    <motion.div variants={itemVariants} className="flex h-full flex-col">
      <DashboardSurface className="flex flex-1 flex-col p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
        Weekly intake
      </p>
      <p className="mt-0.5 text-[10px] text-white/35">Mock bars</p>
      <div className="mt-4 flex h-40 w-full items-end gap-1.5 sm:gap-2">
        {barHeightsPct.map((h, i) => (
          <div
            key={i}
            className="relative h-full min-w-0 flex-1"
          >
            <motion.div
              className="absolute bottom-0 left-0 right-0 rounded-t-md bg-gradient-to-t from-[#FF3B3B]/90 to-[#FFC300]"
              initial={{ height: "0%" }}
              animate={{ height: `${h}%` }}
              transition={{
                duration: 0.75,
                delay: 0.45 + i * 0.07,
                ease: [0.4, 0, 0.2, 1],
              }}
            />
          </div>
        ))}
      </div>
      </DashboardSurface>
    </motion.div>
  );
}

function NexaRevenueSuggestion() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={itemVariants}
      className="relative mt-7 overflow-hidden rounded-xl sm:mt-8"
      animate={
        reduceMotion
          ? undefined
          : {
              boxShadow: [
                "0 0 0 1px rgba(255, 195, 0, 0.18), 0 0 26px rgba(255, 195, 0, 0.1)",
                "0 0 0 1px rgba(255, 195, 0, 0.3), 0 0 40px rgba(255, 195, 0, 0.16)",
                "0 0 0 1px rgba(255, 195, 0, 0.18), 0 0 26px rgba(255, 195, 0, 0.1)",
              ],
            }
      }
      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <DashboardSurface
        tilt={false}
        className="relative overflow-hidden !border-[#FFC300]/45 bg-gradient-to-br from-[#FFC300]/[0.12] to-[#FFC300]/[0.04] p-5 backdrop-blur-md sm:p-6"
      >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#FFC300]/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFC300]">
            NEXA
          </p>
          <p className="mt-2 text-base font-medium leading-relaxed text-white sm:text-lg">
            Closing{" "}
            <span className="font-semibold text-[#FFC300]">3 hot deals</span> ={" "}
            <span className="font-semibold text-white">₹4.2L</span> additional
            revenue
          </p>
        </div>
      </div>
      </DashboardSurface>
    </motion.div>
  );
}
