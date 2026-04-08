"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const glassBase =
  "rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-xl";

const glowShadowHover =
  "0 12px 48px -12px rgba(0,0,0,0.55), 0 0 36px -8px rgba(255,59,59,0.18), 0 0 48px -12px rgba(255,195,0,0.08), inset 0 1px 0 0 rgba(255,255,255,0.08)";

const glowShadowFlatHover =
  "0 10px 40px -10px rgba(0,0,0,0.5), 0 0 28px -6px rgba(255,255,255,0.06), inset 0 1px 0 0 rgba(255,255,255,0.07)";

type DashboardSurfaceProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  /** Subtle 3D tilt on hover; off for dense controls */
  tilt?: boolean;
};

export function DashboardSurface({
  children,
  className = "",
  tilt = true,
  ...rest
}: DashboardSurfaceProps) {
  const reduceMotion = useReducedMotion();

  const hover = reduceMotion
    ? undefined
    : tilt
      ? {
          y: -4,
          rotateX: 0.85,
          rotateY: -0.4,
          boxShadow: glowShadowHover,
          borderColor: "rgba(255, 255, 255, 0.14)",
        }
      : {
          y: -3,
          boxShadow: glowShadowFlatHover,
          borderColor: "rgba(255, 255, 255, 0.12)",
        };

  return (
    <div
      className="h-full [perspective:1400px]"
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div
        className={`${glassBase} ${className}`}
        initial={false}
        whileHover={hover}
        transition={{ duration: 0.4, ease }}
        style={{ transformStyle: "preserve-3d" }}
        {...rest}
      >
        {children}
      </motion.div>
    </div>
  );
}
