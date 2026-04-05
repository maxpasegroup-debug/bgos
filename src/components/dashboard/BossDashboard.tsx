"use client";

import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { CommandCenterSection } from "./CommandCenterSection";
import { SalesPipelineSection } from "./SalesPipelineSection";
import { OperationsSection } from "./OperationsSection";
import { TeamPerformanceSection } from "./TeamPerformanceSection";
import { RevenueDashboardSection } from "./RevenueDashboardSection";
import { RisksOpportunitiesSection } from "./RisksOpportunitiesSection";
import { NexaControlPanelSection } from "./NexaControlPanelSection";

export function BossDashboard() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B0F19] text-white antialiased">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,59,59,0.07),transparent_50%),radial-gradient(ellipse_90%_60%_at_100%_50%,rgba(255,195,0,0.04),transparent_45%)]"
        aria-hidden
      />
      <DashboardSidebar />
      <div className="relative flex min-h-screen flex-col pl-[4.5rem] sm:pl-[4.75rem]">
        <DashboardHeader />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6 lg:px-10 xl:px-12">
          <CommandCenterSection />
          <SalesPipelineSection />
          <OperationsSection />
          <TeamPerformanceSection />
          <RevenueDashboardSection />
          <RisksOpportunitiesSection />
          <NexaControlPanelSection />
        </main>
      </div>
    </div>
  );
}
