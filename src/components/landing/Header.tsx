"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Container } from "./Container";

const MotionLink = motion(Link);

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0B0F14]/85 backdrop-blur-xl"
    >
      <Container className="flex h-16 items-center justify-between sm:h-[4.25rem]">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 transition-opacity duration-300 hover:opacity-90 sm:gap-3"
        >
          <span className="text-sm font-bold tracking-tight text-white sm:text-base">BGOS</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="#features" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline">
            Features
          </Link>
          <Link href="#sales-booster" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline">
            Sales Booster
          </Link>
          <Link href="#pricing" className="hidden text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline">
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-white/70 transition-colors duration-300 hover:text-white"
          >
            Login
          </Link>
          <MotionLink
            href="/onboarding/nexa"
            prefetch
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="relative z-30 inline-flex min-h-[40px] cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-5 py-2 text-sm font-bold tracking-wide text-white shadow-md shadow-indigo-500/25 transition-shadow duration-300 hover:shadow-lg hover:shadow-violet-500/30"
          >
            <span
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden
            >
              <span className="animate-btn-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </span>
            <span className="relative z-10">Start Free</span>
          </MotionLink>
        </nav>
      </Container>
    </motion.header>
  );
}
