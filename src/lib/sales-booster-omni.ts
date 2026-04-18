import "server-only";

import { SalesBoosterOmnichannel, SalesBoosterConnectionState } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SALES_BOOSTER_CHANNELS: SalesBoosterOmnichannel[] = [
  SalesBoosterOmnichannel.WHATSAPP,
  SalesBoosterOmnichannel.INSTAGRAM,
  SalesBoosterOmnichannel.FACEBOOK,
  SalesBoosterOmnichannel.EMAIL,
  SalesBoosterOmnichannel.SMS,
];

/** Ensure one connection row per channel per company (disconnected by default). */
export async function ensureSalesBoosterConnections(companyId: string): Promise<void> {
  const existing = await prisma.salesBoosterChannelConnection.findMany({
    where: { companyId },
    select: { channel: true },
  });
  const have = new Set(existing.map((e) => e.channel));
  const missing = SALES_BOOSTER_CHANNELS.filter((c) => !have.has(c));
  if (missing.length === 0) return;
  await prisma.salesBoosterChannelConnection.createMany({
    data: missing.map((channel) => ({
      companyId,
      channel,
      status: SalesBoosterConnectionState.DISCONNECTED,
    })),
  });
}

const DEFAULT_FLOW = {
  version: 1,
  nodes: [
    { id: "start", type: "start", label: "Start" },
    { id: "greet", type: "message", label: "Greeting", body: "Hi! Thanks for reaching out." },
    { id: "ask", type: "question", label: "Ask Name", field: "name" },
    { id: "save", type: "action", label: "Save Lead", action: "save_lead" },
    { id: "notify", type: "action", label: "Notify Team", action: "notify_team" },
  ],
  edges: [
    { from: "start", to: "greet" },
    { from: "greet", to: "ask" },
    { from: "ask", to: "save" },
    { from: "save", to: "notify" },
  ],
};

export async function ensureSalesBoosterAutomationFlow(companyId: string): Promise<void> {
  const row = await prisma.salesBoosterAutomationFlow.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (row) return;
  await prisma.salesBoosterAutomationFlow.create({
    data: {
      companyId,
      jsonFlow: DEFAULT_FLOW as object,
      autoReplyEnabled: false,
    },
  });
}
