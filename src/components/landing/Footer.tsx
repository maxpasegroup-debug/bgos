"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "./Container";
import { sectionDivider, sectionY } from "./spacing";

const links = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
  { label: "Contact", href: "#" },
];

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
      className={`${sectionDivider} bg-white/60 ${sectionY} backdrop-blur-md`}
    >
      <Container>
        <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/bgos-logo-placeholder.svg"
              alt="BGOS"
              className="h-8 w-auto opacity-95 sm:h-9"
              width={140}
              height={36}
            />
            <p className="text-sm font-normal tracking-wide text-slate-600">
              Hosting Business Showers
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 sm:justify-end">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-sm font-medium tracking-wide text-slate-600 transition-colors duration-300 hover:text-slate-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-10 text-center text-xs tracking-wide text-slate-500 sm:mt-12 sm:text-left">
          © {new Date().getFullYear()} BGOS. Business Growth Operating System.
        </p>
      </Container>
    </motion.footer>
  );
}
