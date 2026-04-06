"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function IcPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }}
      whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(0,0,0,0.08)" }}
      className="rounded-xl border border-gray-200/90 bg-white/85 p-5 shadow-sm backdrop-blur-sm transition-shadow duration-300"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--ice-primary)]">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}
