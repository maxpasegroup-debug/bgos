"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useBgosTheme } from "./BgosThemeContext";

export function BgosAmbientBackground() {
  const reduceMotion = useReducedMotion();
  const { theme } = useBgosTheme();
  const light = theme === "light";

  return (
    <div
      className={
        light
          ? "pointer-events-none fixed inset-0 overflow-hidden bg-[#f1f5f9]"
          : "pointer-events-none fixed inset-0 overflow-hidden bg-[#0B0F14]"
      }
    >
      {/* Soft mesh — dark: red/gold + violet; light: cool slate + violet */}
      <div
        className={
          reduceMotion
            ? "absolute inset-0 opacity-90"
            : light
              ? "absolute inset-0 opacity-[0.85] bg-[radial-gradient(ellipse_120%_80%_at_80%_0%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(ellipse_100%_70%_at_10%_90%,rgba(139,92,246,0.08),transparent_50%),radial-gradient(ellipse_90%_60%_at_50%_50%,rgba(148,163,184,0.15),transparent_60%)]"
              : "bgos-ambient-mesh absolute inset-0 opacity-90"
        }
        aria-hidden
      />

      {/* Base vignette */}
      <div
        className={
          light
            ? "absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(241,245,249,0.9),transparent_58%),radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(255,255,255,0.5),transparent_50%)]"
            : "absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_50%_100%,rgba(11,15,25,0.3),transparent_58%),radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(0,0,0,0.45),transparent_50%)]"
        }
        aria-hidden
      />

      {!light ? (
        <>
          <motion.div
            className="absolute -left-[20%] top-[8%] h-[min(55vw,480px)] w-[min(55vw,480px)] rounded-full bg-gradient-to-br from-[#6366f1]/[0.12] via-[#FF3B3B]/[0.1] to-[#8b5cf6]/[0.08] blur-[100px]"
            aria-hidden
            animate={
              reduceMotion
                ? undefined
                : {
                    x: [0, 22, -12, 0],
                    y: [0, 18, 8, 0],
                    scale: [1, 1.06, 0.98, 1],
                    opacity: [0.5, 0.72, 0.52, 0.5],
                  }
            }
            transition={{
              duration: 28,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="absolute -right-[15%] bottom-[12%] h-[min(50vw,420px)] w-[min(50vw,420px)] rounded-full bg-[#FFC300]/[0.07] blur-[100px]"
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

          <motion.div
            className="absolute left-1/2 top-0 h-[70vh] w-[120%] -translate-x-1/2 bg-gradient-to-b from-[#8b5cf6]/[0.05] via-transparent to-[#FFC300]/[0.03] blur-3xl"
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
        </>
      ) : null}

      <div
        className={`absolute inset-0 mix-blend-overlay bg-noise ${light ? "opacity-[0.02]" : "opacity-[0.035]"}`}
        aria-hidden
      />
    </div>
  );
}
