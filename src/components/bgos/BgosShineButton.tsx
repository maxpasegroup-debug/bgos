"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { easePremium } from "./motion";

type BgosShineButtonProps = HTMLMotionProps<"button"> & {
  variant: "red" | "yellow" | "duo";
  children: ReactNode;
};

export function BgosShineButton({
  variant,
  children,
  className = "",
  ...rest
}: BgosShineButtonProps) {
  const reduceMotion = useReducedMotion();

  const base =
    variant === "red"
      ? "min-h-[44px] rounded-xl bg-gradient-to-r from-[#FF3B3B] to-[#e62e2e] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_25px_rgba(255,59,59,0.22)]"
      : variant === "yellow"
        ? "min-h-[44px] rounded-xl bg-gradient-to-r from-[#FFC300] to-[#e6b008] px-6 py-3 text-sm font-semibold text-[#0B0F19] shadow-lg shadow-[#FFC300]/12"
        : "min-h-[44px] rounded-xl bg-gradient-to-r from-[#FF3B3B] to-[#FFC300] px-6 py-3 text-sm font-semibold text-[#0B0F19] shadow-[0_0_25px_rgba(255,59,59,0.2)]";

  return (
    <motion.button
      type="button"
      className={`relative overflow-hidden ${base} ${className}`}
      whileHover={
        reduceMotion
          ? undefined
          : {
              scale: 1.02,
              boxShadow:
                variant === "red"
                  ? "0 0 28px rgba(255,59,59,0.42), 0 0 52px rgba(255,59,59,0.1)"
                  : variant === "yellow"
                    ? "0 0 26px rgba(255,195,0,0.35), 0 0 44px rgba(255,195,0,0.08)"
                    : "0 0 28px rgba(255,59,59,0.35), 0 0 40px rgba(255,195,0,0.12)",
            }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.35, ease: easePremium }}
      {...rest}
    >
      {!reduceMotion ? (
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <span className="animate-bgos-btn-shine absolute inset-y-0 -left-[40%] w-[55%] skew-x-[-12deg] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </span>
      ) : null}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
