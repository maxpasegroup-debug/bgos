"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

const glowShadow =
  "0 0 25px rgba(255, 59, 59, 0.25), 0 24px 56px -22px rgba(0, 0, 0, 0.52)";

const glowShadowFlat =
  "0 0 25px rgba(255, 59, 59, 0.22), 0 20px 48px -20px rgba(0, 0, 0, 0.48)";

type DashboardSurfaceProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  /** Subtle 3D tilt on hover; off for narrow pipeline chips */
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
          y: -6,
          rotateX: 1.15,
          rotateY: -0.55,
          boxShadow: glowShadow,
          borderColor: "rgba(255, 255, 255, 0.16)",
        }
      : {
          y: -6,
          boxShadow: glowShadowFlat,
          borderColor: "rgba(255, 255, 255, 0.15)",
        };

  return (
    <div
      className="h-full [perspective:1200px]"
      style={{ transformStyle: "preserve-3d" }}
    >
      <motion.div
        className={`rounded-xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-lg ${className}`}
        initial={false}
        whileHover={hover}
        transition={{ duration: 0.48, ease }}
        style={{ transformStyle: "preserve-3d" }}
        {...rest}
      >
        {children}
      </motion.div>
    </div>
  );
}
