"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LegalFooterMenu } from "./LegalFooterMenu";
import { Container } from "./Container";
import { sectionDivider, sectionY } from "./spacing";

const links = [{ label: "Contact", href: "/contact" }];

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
      className={`${sectionDivider} bg-[#0B0F14] ${sectionY} backdrop-blur-md`}
    >
      <Container>
        <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <p className="text-lg font-bold tracking-tight text-white">BGOS</p>
            <p className="text-sm font-normal tracking-wide text-white/65">
              Built for teams who want clarity, control, and growth
            </p>
            <p className="text-sm text-white/55">
              <a href="mailto:hello@bgos.online" className="hover:text-white">
                hello@bgos.online
              </a>
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-end">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-sm font-medium tracking-wide text-white/65 transition-colors duration-300 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <LegalFooterMenu />
          </nav>
        </div>
        <p className="mt-10 text-center text-xs tracking-wide text-white/45 sm:mt-12 sm:text-left">
          © {new Date().getFullYear()} BGOS. Business Growth Operating System.
        </p>
      </Container>
    </motion.footer>
  );
}
