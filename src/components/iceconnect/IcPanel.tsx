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
      whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(14,165,233,0.12)" }}
      className="rounded-[14px] border border-white/10 bg-white/[0.04] p-5 shadow-sm backdrop-blur-[12px] transition-shadow duration-300"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-300">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}
