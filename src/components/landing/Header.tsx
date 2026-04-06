"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Container } from "./Container";

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/70 backdrop-blur-md"
    >
      <Container className="flex h-16 items-center justify-between sm:h-[4.25rem]">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 transition-opacity duration-300 hover:opacity-90 sm:gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bgos-logo-placeholder.svg"
            alt="BGOS"
            className="h-10 w-auto shrink-0"
            width={160}
            height={40}
          />
          <div className="min-w-0 text-left">
            <span className="block text-sm font-bold tracking-tight text-slate-900">
              BGOS
            </span>
            <span className="hidden text-[11px] font-medium leading-tight tracking-wide text-slate-500 sm:block">
              Business Growth Operating System
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 transition-colors duration-300 hover:text-slate-900"
          >
            Login
          </Link>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/signup"
              className="relative inline-flex min-h-[40px] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-yellow-400 px-5 py-2 text-sm font-bold tracking-wide text-neutral-950 shadow-md shadow-red-500/20 transition-shadow duration-300 hover:shadow-lg hover:shadow-amber-400/25"
            >
              <span
                className="pointer-events-none absolute inset-0 overflow-hidden"
                aria-hidden
              >
                <span className="animate-btn-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </span>
              <span className="relative z-10">Signup</span>
            </Link>
          </motion.div>
        </nav>
      </Container>
    </motion.header>
  );
}
