import type { OnboardingWorkflowPlanTier } from "@prisma/client";

export type WorkflowFieldDef = {
  key: string;
  label: string;
  type: "textarea";
};

export type WorkflowSectionDef = {
  id: string;
  title: string;
  fields: WorkflowFieldDef[];
};

export type WorkflowTemplateSections = {
  sections: WorkflowSectionDef[];
};

export function collectFieldKeys(sections: WorkflowTemplateSections): string[] {
  const keys: string[] = [];
  for (const s of sections.sections) {
    for (const f of s.fields) keys.push(f.key);
  }
  return keys;
}

export function computeCompletionPercent(
  sections: WorkflowTemplateSections,
  data: Record<string, unknown>,
): number {
  const keys = collectFieldKeys(sections);
  if (keys.length === 0) return 0;
  let filled = 0;
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim().length > 0) filled += 1;
  }
  return Math.round((filled / keys.length) * 100);
}

export function solarTemplateSections(
  plan: OnboardingWorkflowPlanTier,
): WorkflowTemplateSections {
  const basic: WorkflowSectionDef[] = [
    {
      id: "business",
      title: "Business details",
      fields: [
        { key: "companyName", label: "Company / brand name", type: "textarea" },
        { key: "registeredAddress", label: "Registered address", type: "textarea" },
        { key: "gstNumber", label: "GST / tax ID (optional)", type: "textarea" },
        { key: "businessNotes", label: "Anything else about the business", type: "textarea" },
      ],
    },
    {
      id: "team",
      title: "Team setup",
      fields: [
        {
          key: "teamSetup",
          label: "Team members & roles (add as many lines as you need)",
          type: "textarea",
        },
      ],
    },
    {
      id: "operations",
      title: "Operations",
      fields: [{ key: "operationsNotes", label: "Day-to-day operations", type: "textarea" }],
    },
    {
      id: "goals",
      title: "Goals",
      fields: [{ key: "goalsNotes", label: "Goals for BGOS / ICECONNECT", type: "textarea" }],
    },
  ];

  const proExtra: WorkflowSectionDef[] = [
    {
      id: "salesBooster",
      title: "Sales Booster setup (Pro)",
      fields: [
        { key: "leadSources", label: "Lead sources", type: "textarea" },
        { key: "whatsappApi", label: "WhatsApp API — yes / no / need help", type: "textarea" },
        { key: "socialLinks", label: "Social / website links", type: "textarea" },
        { key: "automationNeeds", label: "Automation needs", type: "textarea" },
      ],
    },
  ];

  const enterpriseExtra: WorkflowSectionDef[] = [
    {
      id: "enterprise",
      title: "Enterprise",
      fields: [
        { key: "orgStructure", label: "Org structure", type: "textarea" },
        { key: "customRequirements", label: "Custom requirements", type: "textarea" },
        { key: "integrations", label: "Integrations", type: "textarea" },
        { key: "expectations", label: "Expectations & success criteria", type: "textarea" },
      ],
    },
  ];

  if (plan === "BASIC") return { sections: basic };
  if (plan === "PRO") return { sections: [...basic, ...proExtra] };
  return { sections: [...basic, ...proExtra, ...enterpriseExtra] };
}

/** Paid custom-build intake (same sections all tiers; tier stored for ops / pricing context). */
export function customTemplateSections(_plan: OnboardingWorkflowPlanTier): WorkflowTemplateSections {
  void _plan;
  return {
    sections: [
      {
        id: "business_info",
        title: "Business info",
        fields: [
          { key: "businessName", label: "Business name", type: "textarea" },
          { key: "industryType", label: "Industry type", type: "textarea" },
          { key: "location", label: "Location", type: "textarea" },
        ],
      },
      {
        id: "structure",
        title: "Structure",
        fields: [
          { key: "teamSize", label: "Team size", type: "textarea" },
          { key: "departments", label: "Departments", type: "textarea" },
          { key: "roles", label: "Roles", type: "textarea" },
        ],
      },
      {
        id: "operations",
        title: "Operations",
        fields: [
          { key: "automateTargets", label: "What do you want to automate?", type: "textarea" },
          { key: "currentWorkflow", label: "Current workflow", type: "textarea" },
          { key: "painPoints", label: "Pain points", type: "textarea" },
        ],
      },
      {
        id: "requirements",
        title: "Requirements",
        fields: [
          { key: "requiredFeatures", label: "Required features", type: "textarea" },
          { key: "customModules", label: "Custom modules", type: "textarea" },
          { key: "reportingNeeds", label: "Reporting needs", type: "textarea" },
        ],
      },
      {
        id: "expectation",
        title: "Expectation",
        fields: [
          { key: "timeline", label: "Timeline", type: "textarea" },
          { key: "businessGoals", label: "Business goals", type: "textarea" },
        ],
      },
    ],
  };
}
