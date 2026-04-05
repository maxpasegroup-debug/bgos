"use client";

import Image from "next/image";
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
      transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
      className={`${sectionDivider} bg-black/35 ${sectionY} backdrop-blur-sm`}
    >
      <Container>
        <div className="flex flex-col items-center gap-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
            <Image
              src="/bgos-logo-placeholder.svg"
              alt="BGOS"
              width={100}
              height={26}
              className="h-6 w-auto opacity-90"
            />
            <p className="text-sm font-normal tracking-wide text-gray-400">
              Hosting Business Showers
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-10 gap-y-3 sm:justify-end">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-sm font-medium tracking-wide text-gray-400 transition-colors duration-500 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-14 text-center text-xs tracking-wide text-gray-500 sm:mt-16 sm:text-left">
          © {new Date().getFullYear()} BGOS. Business Growth Operating System.
        </p>
      </Container>
    </motion.footer>
  );
}
