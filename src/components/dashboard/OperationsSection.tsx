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
    transition: { staggerChildren: 0.055 },
  },
};

const modules = [
  {
    key: "loan",
    label: "Loan Status",
    value: 9,
    icon: LoanIcon,
    accent: "text-cyan-300/90",
    ring: "ring-cyan-400/25",
  },
  {
    key: "install",
    label: "Installation Queue",
    value: 6,
    icon: InstallIcon,
    accent: "text-[#FFC300]",
    ring: "ring-[#FFC300]/25",
  },
  {
    key: "approval",
    label: "Approval Status",
    value: 4,
    icon: ApprovalIcon,
    accent: "text-violet-300/90",
    ring: "ring-violet-400/25",
  },
  {
    key: "service",
    label: "Service Requests",
    value: 11,
    icon: ServiceIcon,
    accent: "text-emerald-300/90",
    ring: "ring-emerald-400/25",
  },
] as const;

const alerts = [
  {
    text: "2 installations delayed",
    bar: "bg-[#FF3B3B]",
    shadow: "shadow-[#FF3B3B]/20",
  },
  {
    text: "3 approvals pending",
    bar: "bg-[#FFC300]",
    shadow: "shadow-[#FFC300]/15",
  },
] as const;

export function OperationsSection() {
  return (
    <motion.section
      id="operations"
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
        Operations
      </motion.h2>

      <motion.div
        variants={gridVariants}
        className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4"
      >
        {modules.map((m) => (
          <motion.div key={m.key} variants={itemVariants} className="h-full">
            <DashboardSurface
              className={`p-4 ring-1 sm:p-5 ${m.ring}`}
            >
              <div
                className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/25 ${m.accent}`}
              >
                <m.icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {m.value}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wider text-white/45">
                {m.label}
              </p>
            </DashboardSurface>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={itemVariants} className="mt-7 sm:mt-8">
        <DashboardSurface tilt={false} className="overflow-hidden bg-white/[0.04] p-0">
          <div
            className="h-1 w-full bg-gradient-to-r from-[#FF3B3B] via-[#FF6B4A] to-[#FFC300]"
            aria-hidden
          />
          <div className="divide-y divide-white/[0.06] px-4 py-1">
            {alerts.map((a) => (
              <div
                key={a.text}
                className="flex items-center gap-3 py-3 sm:gap-4"
              >
                <span
                  className={`h-10 w-1 shrink-0 rounded-full ${a.bar} shadow-lg ${a.shadow}`}
                  aria-hidden
                />
                <p className="text-sm font-medium text-white/90">{a.text}</p>
              </div>
            ))}
          </div>
        </DashboardSurface>
      </motion.div>
    </motion.section>
  );
}

function LoanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

function InstallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 3v1m0 16v1m8-9h-1M5 12H4m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function ApprovalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function ServiceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}
