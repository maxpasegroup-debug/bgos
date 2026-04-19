"use client";

/**
 * MotionWrapper — shared Framer Motion primitives for mobile-only components.
 *
 * STRICT: import from here inside /components/mobile/** only.
 * Never use in desktop components.
 */

import { motion, type HTMLMotionProps } from "framer-motion";

// ---------------------------------------------------------------------------
// Shared variants
// ---------------------------------------------------------------------------

/** Stagger container — wraps a list of staggerItem children. */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
};

const EASE = [0.4, 0, 0.2, 1] as [number, number, number, number];

/** Individual staggered item — fade up. */
export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

/** Page enter / exit — slide from right, exit slide left. */
export const pageVariants = {
  initial: { opacity: 0, x: 22 },
  animate: { opacity: 1, x: 0  },
  exit:    { opacity: 0, x: -14 },
};

export const pageTransition = {
  duration: 0.3,
  ease: EASE,
};

// ---------------------------------------------------------------------------
// MotionWrapper — generic fade-up wrapper
// ---------------------------------------------------------------------------

interface MotionWrapperProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

export function MotionWrapper({ delay = 0, children, ...props }: MotionWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MotionCard — glass card with tap-scale feedback
// ---------------------------------------------------------------------------

interface MotionCardProps extends HTMLMotionProps<"div"> {
  tapScale?: number;
}

export function MotionCard({ tapScale = 0.97, children, ...props }: MotionCardProps) {
  return (
    <motion.div
      whileTap={{ scale: tapScale }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// AnimatedProgress — width animates from 0 → value on mount
// ---------------------------------------------------------------------------

export function AnimatedProgress({
  percent,
  className,
  delay = 0.2,
}: {
  percent: number;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ width: "0%" }}
      animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      transition={{ duration: 0.65, ease: EASE, delay }}
    />
  );
}

// ---------------------------------------------------------------------------
// TypingDots — three bouncing dots for "Nexa is thinking"
// ---------------------------------------------------------------------------

export function TypingDots({ color = "#4FD1FF" }: { color?: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block rounded-full"
          style={{ width: 5, height: 5, background: color, opacity: 0.7 }}
          animate={{ y: [0, -4, 0] }}
          transition={{
            repeat: Infinity,
            duration: 0.55,
            delay: i * 0.13,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
