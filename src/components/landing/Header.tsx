"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "./Container";
import { useEffect, useState } from "react";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
      className={`sticky top-0 z-50 w-full border-b border-white/[0.06] bg-black/30 backdrop-blur-md transition-all duration-500 ease-out ${
        scrolled ? "backdrop-blur-xl bg-black/40" : ""
      }`}
    >
      <Container
        className={`flex items-center justify-between transition-all duration-500 ease-out ${
          scrolled ? "h-[3.25rem] sm:h-14" : "h-14 sm:h-16"
        }`}
      >
        <Link
          href="/"
          className="flex items-center opacity-90 transition-opacity duration-500 hover:opacity-100"
        >
          <Image
            src="/bgos-logo-placeholder.svg"
            alt="BGOS"
            width={112}
            height={28}
            priority
            className={`w-auto transition-all duration-500 ${
              scrolled ? "h-6" : "h-7 sm:h-7"
            }`}
          />
        </Link>
        <nav className="flex items-center gap-6 sm:gap-10">
          <Link
            href="/bgos"
            className="text-sm font-medium tracking-wide text-gray-400 transition-colors duration-500 hover:text-white"
          >
            Login
          </Link>
          <Link
            href="/bgos"
            className="relative inline-flex min-h-[40px] items-center overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-yellow-400 px-5 py-2 text-sm font-bold tracking-wide text-neutral-950 shadow-md shadow-[0_0_22px_rgba(255,59,59,0.22)] transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(250,204,21,0.28)]"
          >
            <span
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden
            >
              <span className="animate-btn-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/22 to-transparent" />
            </span>
            <span className="relative z-10">Signup</span>
          </Link>
        </nav>
      </Container>
    </motion.header>
  );
}
