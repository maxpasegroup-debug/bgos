"use client";

import { motion, type Variants } from "framer-motion";
import { DashboardSurface } from "./DashboardSurface";

const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
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
    transition: { staggerChildren: 0.07 },
  },
};

type Tier = "good" | "average" | "poor";

const tierStyles: Record<
  Tier,
  {
    label: string;
    border: string;
    bg: string;
    ring: string;
    bar: string;
    pill: string;
    text: string;
  }
> = {
  good: {
    label: "Good",
    border: "!border-emerald-400/35",
    bg: "bg-emerald-500/[0.07]",
    ring: "ring-emerald-400/20",
    bar: "from-emerald-400 to-green-500",
    pill: "bg-emerald-500/25 text-emerald-200",
    text: "text-emerald-300",
  },
  average: {
    label: "Average",
    border: "!border-amber-400/40",
    bg: "bg-amber-500/[0.08]",
    ring: "ring-amber-400/25",
    bar: "from-amber-400 to-[#FFC300]",
    pill: "bg-amber-500/25 text-amber-200",
    text: "text-amber-300",
  },
  poor: {
    label: "Poor",
    border: "!border-red-500/40",
    bg: "bg-red-500/[0.08]",
    ring: "ring-red-500/25",
    bar: "from-[#FF3B3B] to-red-600",
    pill: "bg-red-500/25 text-red-200",
    text: "text-red-300",
  },
};

const departments = [
  {
    key: "marketing",
    name: "Marketing",
    performance: 91,
    tasksDone: 142,
    tasksTotal: 156,
    tier: "good" as const,
  },
  {
    key: "installation",
    name: "Installation",
    performance: 74,
    tasksDone: 38,
    tasksTotal: 52,
    tier: "average" as const,
  },
  {
    key: "service",
    name: "Service",
    performance: 61,
    tasksDone: 22,
    tasksTotal: 36,
    tier: "poor" as const,
  },
] as const;

export function TeamPerformanceSection() {
  return (
    <motion.section
      id="team"
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
        Team Performance
      </motion.h2>

      <motion.div
        variants={gridVariants}
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        {departments.map((dept, i) => (
          <DepartmentCard key={dept.key} dept={dept} barDelay={0.5 + i * 0.12} />
        ))}
      </motion.div>
    </motion.section>
  );
}

function DepartmentCard({
  dept,
  barDelay,
}: {
  dept: (typeof departments)[number];
  barDelay: number;
}) {
  const s = tierStyles[dept.tier];

  return (
    <motion.div variants={itemVariants} className="h-full">
      <DashboardSurface
        className={`border bg-white/5 p-6 ring-1 sm:p-7 ${s.border} ${s.bg} ${s.ring}`}
      >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{dept.name}</h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.pill}`}
        >
          {s.label}
        </span>
      </div>

      <p className={`mt-4 text-4xl font-bold tabular-nums tracking-tight ${s.text}`}>
        {dept.performance}
        <span className="text-2xl font-semibold text-white/50">%</span>
      </p>
      <p className="mt-1 text-xs font-medium text-white/45">Performance</p>

      <p className="mt-5 text-sm text-white/70">
        <span className="font-semibold text-white">{dept.tasksDone}</span>
        <span className="text-white/40"> / {dept.tasksTotal} </span>
        tasks completed
      </p>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/30">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${s.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${dept.performance}%` }}
          transition={{
            duration: 1.15,
            delay: barDelay,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      </div>
      </DashboardSurface>
    </motion.div>
  );
}
