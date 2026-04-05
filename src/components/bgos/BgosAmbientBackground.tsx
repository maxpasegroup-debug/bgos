"use client";

import { motion, useReducedMotion } from "framer-motion";

export function BgosAmbientBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#0B0F19]">
      {/* Soft animated mesh */}
      <div
        className={
          reduceMotion
            ? "absolute inset-0 opacity-90"
            : "bgos-ambient-mesh absolute inset-0 opacity-90"
        }
        aria-hidden
      />

      {/* Base vignette */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(11,15,25,0.3),transparent_58%),radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,0,0,0.45),transparent_50%)]"
        aria-hidden
      />

      {/* Red blob */}
      <motion.div
        className="absolute -left-[20%] top-[8%] h-[min(55vw,480px)] w-[min(55vw,480px)] rounded-full bg-[#FF3B3B]/[0.11] blur-[100px]"
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 22, -12, 0],
                y: [0, 18, 8, 0],
                scale: [1, 1.06, 0.98, 1],
                opacity: [0.55, 0.72, 0.5, 0.55],
              }
        }
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Yellow blob */}
      <motion.div
        className="absolute -right-[15%] bottom-[12%] h-[min(50vw,420px)] w-[min(50vw,420px)] rounded-full bg-[#FFC300]/[0.09] blur-[100px]"
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -20, 14, 0],
                y: [0, -14, 10, 0],
                scale: [1, 1.05, 0.97, 1],
                opacity: [0.45, 0.65, 0.42, 0.45],
              }
        }
        transition={{
          duration: 32,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Accent thread (very subtle) */}
      <motion.div
        className="absolute left-1/2 top-0 h-[70vh] w-[120%] -translate-x-1/2 bg-gradient-to-b from-[#FF3B3B]/[0.04] via-transparent to-[#FFC300]/[0.03] blur-3xl"
        aria-hidden
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: [0.4, 0.65, 0.4],
              }
        }
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Calm noise (optional texture) */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay bg-noise"
        aria-hidden
      />
    </div>
  );
}
