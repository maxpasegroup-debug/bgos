"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type SectionRevealProps = {
  children: ReactNode;
  className?: string;
  id?: string;
};

export function SectionReveal({ children, className, id }: SectionRevealProps) {
  return (
    <motion.section
      id={id}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.section>
  );
}
