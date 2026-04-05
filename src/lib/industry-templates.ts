import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SOLAR_TEMPLATE } from "@/lib/templates/solar-template";

function solarTemplateJson(): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(SOLAR_TEMPLATE)) as Prisma.InputJsonValue;
}

/** Applies the Solar industry pack: company workspace config + default automations (idempotent on automations). */
export async function applySolarTemplate(companyId: string): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      businessTemplate: SOLAR_TEMPLATE.id,
      dashboardConfig: solarTemplateJson(),
    },
  });

  const existing = await prisma.automation.count({ where: { companyId } });
  if (existing > 0) return;

  await prisma.automation.createMany({
    data: SOLAR_TEMPLATE.automations.map((a) => ({
      name: a.name,
      trigger: a.trigger,
      action: a.action,
      config: JSON.parse(JSON.stringify(a.config)) as Prisma.InputJsonValue,
      companyId,
    })),
  });
}

/** Extensible hook for future packs (real estate, coaching, clinics). */
export async function applyIndustryTemplate(
  companyId: string,
  industry: string,
): Promise<void> {
  const key = industry.trim().toLowerCase();
  if (key === "solar" || key === "solar-company" || key === "energy") {
    await applySolarTemplate(companyId);
  }
}
