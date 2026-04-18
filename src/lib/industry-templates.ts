import "server-only";

import { prisma } from "@/lib/prisma";
import { applySolarTemplateWithClient } from "@/lib/industry-templates-core";

export * from "@/lib/industry-templates-core";

/** Applies the Solar industry pack: company workspace config + default automations (idempotent on automations). */
export async function applySolarTemplate(companyId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await applySolarTemplateWithClient(tx, companyId);
  });
}

/** Extensible hook for future packs (real estate, coaching, clinics). */
export async function applyIndustryTemplate(companyId: string, industry: string): Promise<void> {
  const key = industry.trim().toLowerCase();
  if (key === "custom") return;
  if (key === "solar" || key === "solar-company" || key === "energy") {
    await applySolarTemplate(companyId);
  }
}
