"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo } from "react";

const MotionLink = motion(Link);

export function OnboardBossButton({
  className = "",
  label = "Onboard Boss",
  source,
  leadId,
  ownerId,
  franchiseId,
  referralSource,
}: {
  className?: string;
  label?: string;
  /** When set, opens Nexa with attribution query params. */
  source?: "sales" | "franchise";
  leadId?: string;
  /** Sales executive user id (shown as `ownerId` in the URL). */
  ownerId?: string;
  franchiseId?: string;
  referralSource?: string;
}) {
  const href = useMemo(() => {
    const qs = new URLSearchParams();
    if (source) qs.set("source", source);
    if (leadId?.trim()) qs.set("leadId", leadId.trim());
    if (ownerId?.trim()) qs.set("ownerId", ownerId.trim());
    if (franchiseId?.trim()) qs.set("franchiseId", franchiseId.trim());
    if (referralSource?.trim()) qs.set("referral", referralSource.trim());
    const q = qs.toString();
    return q ? `/onboarding/nexa?${q}` : "/onboarding/nexa";
  }, [source, leadId, ownerId, franchiseId, referralSource]);

  return (
    <MotionLink
      href={href}
      prefetch
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative z-30 inline-flex cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-95 ${className}`}
    >
      {label}
    </MotionLink>
  );
}
