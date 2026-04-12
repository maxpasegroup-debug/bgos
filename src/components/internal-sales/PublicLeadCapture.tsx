"use client";

import Link from "next/link";

/** Public capture is disabled — leads are created by BGOS internal sales only. */
export function PublicLeadCapture() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-white">
      <h1 className="text-lg font-semibold">Contact BGOS</h1>
      <p className="mt-3 text-sm text-white/60">
        We no longer accept anonymous lead forms. Our sales team adds every opportunity to the CRM directly.
      </p>
      <p className="mt-4 text-sm text-white/50">
        If you are a BGOS partner or customer, sign in to your workspace or reach your account executive.
      </p>
      <Link
        href="/login"
        className="mt-6 inline-block rounded-xl bg-[#FFC300]/90 px-5 py-2.5 text-sm font-semibold text-black"
      >
        Sign in
      </Link>
    </div>
  );
}
