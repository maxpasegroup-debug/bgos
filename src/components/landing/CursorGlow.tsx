"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export function CursorGlow() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 90, damping: 28, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 90, damping: 28, mass: 0.5 });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[40] hidden lg:block"
      aria-hidden
    >
      <motion.div
        className="absolute h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-multiply"
        style={{
          left: sx,
          top: sy,
          background:
            "radial-gradient(circle, rgba(239,68,68,0.07) 0%, rgba(250,204,21,0.05) 40%, transparent 70%)",
        }}
      />
    </motion.div>
  );
}
