"use client";

import Link from "next/link";

export function OnboardBossButton({
  className = "",
  label = "Onboard Boss",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href="/onboarding/nexa"
      className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-95 ${className}`}
    >
      {label}
    </Link>
  );
}
