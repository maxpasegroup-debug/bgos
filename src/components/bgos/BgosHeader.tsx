"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BGOS_MAIN_PAD } from "./layoutTokens";

export function BgosHeader() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-md"
    >
      <div
        className={`flex h-14 min-h-14 items-center gap-2 sm:gap-4 ${BGOS_MAIN_PAD}`}
      >
        <span className="shrink-0 text-sm font-bold tracking-wide text-white sm:text-base">
          BGOS
        </span>
        <h1 className="min-w-0 flex-1 truncate text-center text-xs font-semibold tracking-wide text-white/90 sm:text-sm">
          Command Center
        </h1>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <motion.button
            type="button"
            whileHover={
              reduceMotion
                ? undefined
                : {
                    backgroundColor: "rgba(255,255,255,0.06)",
                    boxShadow:
                      "0 0 18px rgba(255, 59, 59, 0.18), 0 0 32px rgba(255, 195, 0, 0.08)",
                  }
            }
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-lg p-2 text-white/65 transition-colors hover:text-white"
            aria-label="Notifications"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-1.312 5.022 23.846 23.846 0 005.455 1.31m-4.714 0a3.002 3.002 0 01-5.455 0"
              />
            </svg>
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#FF3B3B] ring-2 ring-[#0B0F19]" />
          </motion.button>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[#FF3B3B]/35 to-[#FFC300]/25 text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-xs"
            title="Solar Owner"
          >
            SO
          </div>
        </div>
      </div>
    </motion.header>
  );
}
