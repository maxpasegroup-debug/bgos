"use client";

import { motion, useScroll, useTransform } from "framer-motion";

/** Soft orbs — shallow parallax for light premium canvas */
export function ParallaxGlows() {
  const { scrollY } = useScroll();
  const ySlow = useTransform(scrollY, [0, 1600], [0, 56]);
  const ySlower = useTransform(scrollY, [0, 1600], [0, 32]);
  const yBottom = useTransform(scrollY, [0, 1600], [0, 40]);

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute -left-[18%] top-[6%] h-[min(38rem,88vw)] w-[min(38rem,88vw)] rounded-full bg-red-500/[0.06] blur-3xl"
        style={{ y: ySlower }}
      />
      <motion.div
        className="absolute -right-[12%] top-[26%] h-[min(32rem,78vw)] w-[min(32rem,78vw)] rounded-full bg-amber-400/[0.07] blur-3xl"
        style={{ y: ySlow }}
      />
      <motion.div
        className="absolute bottom-[6%] left-1/2 h-64 w-[min(88%,44rem)] -translate-x-1/2 rounded-full bg-slate-300/[0.25] blur-3xl"
        style={{ y: yBottom }}
      />
    </div>
  );
}
