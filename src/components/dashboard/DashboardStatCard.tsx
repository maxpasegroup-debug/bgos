"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type DashboardStatCardProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  delay?: number;
};

export function DashboardStatCard({
  title,
  children,
  footer,
  className = "",
  delay = 0,
}: DashboardStatCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={`rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-lg ${className}`}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/50">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
      {footer ? (
        <div className="mt-4 border-t border-white/10 pt-4 text-xs text-white/45">
          {footer}
        </div>
      ) : null}
    </motion.article>
  );
}
