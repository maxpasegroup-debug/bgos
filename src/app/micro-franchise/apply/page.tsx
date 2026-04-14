import { Suspense } from "react";
import { MicroFranchiseApplyClient } from "./MicroFranchiseApplyClient";

export default function MicroFranchiseApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050814] text-sm text-white/60">Loading…</div>
      }
    >
      <MicroFranchiseApplyClient />
    </Suspense>
  );
}
