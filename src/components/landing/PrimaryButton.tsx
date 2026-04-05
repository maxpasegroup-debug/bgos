"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { useCallback, useState } from "react";

type Ripple = { id: number; x: number; y: number };

const wrapVariants: Variants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.03,
    y: -2,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  },
  tap: { scale: 0.99, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
};

type PrimaryButtonProps = {
  href: string;
  children: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
};

export function PrimaryButton({
  href,
  children,
  size = "md",
  className = "",
}: PrimaryButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const pad =
    size === "lg" ? "min-h-[48px] px-10 py-3.5 text-sm" : "min-h-[46px] px-8 py-3.5 text-sm";

  const addRipple = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const id = performance.now();
    setRipples((prev) => [
      ...prev,
      { id, x: e.clientX - r.left, y: e.clientY - r.top },
    ]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((x) => x.id !== id));
    }, 600);
  }, []);

  return (
    <motion.div
      className={`relative inline-flex w-full sm:w-auto ${className}`}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={wrapVariants}
    >
      <Link
        href={href}
        onClick={addRipple}
        className={`relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-yellow-400 font-bold tracking-wide text-neutral-950 shadow-md shadow-[0_0_24px_rgba(255,59,59,0.22)] transition-shadow duration-500 ease-out hover:shadow-[0_0_36px_rgba(250,204,21,0.28)] sm:w-auto ${pad}`}
      >
        <span
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <span className="animate-btn-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </span>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="pointer-events-none absolute rounded-full bg-white/30"
            style={{
              left: r.x,
              top: r.y,
              translateX: "-50%",
              translateY: "-50%",
            }}
            initial={{ width: 0, height: 0, opacity: 0.45 }}
            animate={{ width: 240, height: 240, opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          />
        ))}
        <span className="relative z-10">{children}</span>
      </Link>
    </motion.div>
  );
}
