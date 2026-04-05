/**
 * Solar industry pack — pipeline labels + default automations (stored in Company.dashboardConfig + Automation rows).
 */
export const SOLAR_TEMPLATE = {
  id: "solar-company",

  pipeline: [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "SITE_VISIT_SCHEDULED",
    "SITE_VISIT_COMPLETED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
    "WON",
    "LOST",
  ],

  automations: [
    {
      name: "New Lead Auto Response",
      trigger: "LEAD_CREATED",
      action: "SEND_WHATSAPP",
      config: {
        message:
          "Hi {{name}}, thanks for your interest in solar solutions. We'll contact you shortly.",
      },
    },
    {
      name: "Follow-up Reminder",
      trigger: "STAGE_DELAY",
      action: "CREATE_TASK",
      config: {
        days: 2,
        task: "Follow up with {{name}}",
      },
    },
    {
      name: "Proposal Follow-up",
      trigger: "STAGE_ENTERED",
      action: "SEND_WHATSAPP",
      config: {
        stage: "PROPOSAL_SENT",
        message: "Hi {{name}}, just checking if you reviewed the proposal.",
      },
    },
  ],
} as const;

export type SolarTemplate = typeof SOLAR_TEMPLATE;
