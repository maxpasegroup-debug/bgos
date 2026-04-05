"use client";

import { motion, useReducedMotion } from "framer-motion";

export function DashboardHeader() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 shrink-0 border-b border-white/[0.09] bg-[#0B0F19]/75 backdrop-blur-xl"
    >
      <div className="mx-auto grid h-14 w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-16 sm:px-6 lg:px-10 xl:px-12">
        <span className="justify-self-start text-sm font-bold tracking-wide text-white sm:text-base">
          BGOS
        </span>
        <h1 className="px-2 text-center text-xs font-semibold tracking-wide text-white/90 sm:text-sm">
          Command Center
        </h1>
        <div className="flex items-center justify-end gap-2 sm:gap-4">
          <motion.button
            type="button"
            whileHover={
              reduceMotion
                ? undefined
                : {
                    backgroundColor: "rgba(255,255,255,0.06)",
                    boxShadow:
                      "0 0 22px rgba(255, 59, 59, 0.2), 0 0 40px rgba(255, 195, 0, 0.08)",
                  }
            }
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-lg p-2 text-white/70 transition-colors hover:text-white"
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FF3B3B] ring-2 ring-[#0B0F19]" />
          </motion.button>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#FF3B3B]/30 to-[#FFC300]/20 text-xs font-bold text-white sm:h-10 sm:w-10 sm:text-sm"
            title="Solar Owner"
          >
            SO
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-1.312 5.022 23.846 23.846 0 005.455 1.31m-4.714 0a3.002 3.002 0 01-5.455 0"
      />
    </svg>
  );
}
