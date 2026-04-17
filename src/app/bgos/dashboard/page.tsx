import { Suspense } from "react";
import { BgosDashboardView } from "@/components/bgos/BgosDashboardView";

export default function BgosDashboardPage() {
  return (
    <Suspense fallback={null}>
      <BgosDashboardView />
    </Suspense>
  );
}
