"use client";

import { motion, useScroll, useTransform } from "framer-motion";

/** Soft orbs — shallow parallax so motion stays calm */
export function ParallaxGlows() {
  const { scrollY } = useScroll();
  const ySlow = useTransform(scrollY, [0, 1600], [0, 72]);
  const ySlower = useTransform(scrollY, [0, 1600], [0, 42]);
  const yBottom = useTransform(scrollY, [0, 1600], [0, 48]);

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute -left-[20%] top-[8%] h-[min(42rem,90vw)] w-[min(42rem,90vw)] rounded-full bg-red-500/14 blur-3xl"
        style={{ y: ySlower }}
      />
      <motion.div
        className="absolute -right-[15%] top-[28%] h-[min(36rem,80vw)] w-[min(36rem,80vw)] rounded-full bg-yellow-400/12 blur-3xl"
        style={{ y: ySlow }}
      />
      <motion.div
        className="absolute bottom-[5%] left-1/2 h-72 w-[min(90%,48rem)] -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl"
        style={{ y: yBottom }}
      />
    </div>
  );
}
