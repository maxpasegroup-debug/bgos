import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";

const bodySchema = z.object({
  user_data: z
    .object({
      role: z.string().trim().min(1).max(64).optional(),
      streak: z.number().int().nonnegative().optional(),
      pending_tasks: z.number().int().nonnegative().optional(),
    })
    .optional(),
  performance: z
    .object({
      conversion_rate: z.number().min(0).max(100).optional(),
      leads_today: z.number().int().nonnegative().optional(),
      target_today: z.number().int().positive().optional(),
      revenue_mtd: z.number().nonnegative().optional(),
    })
    .optional(),
});

/**
 * Lightweight global Nexa manager endpoint.
 * Input: user + performance snapshot. Output: tasks, alerts, suggestions.
 */
export async function POST(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const user = parsed.data.user_data ?? {};
    const perf = parsed.data.performance ?? {};

    const pending = user.pending_tasks ?? 0;
    const streak = user.streak ?? 0;
    const conv = perf.conversion_rate ?? 0;
    const leadsToday = perf.leads_today ?? 0;
    const targetToday = perf.target_today ?? 5;

    const tasks: string[] = [];
    const alerts: string[] = [];
    const suggestions: string[] = [];

    if (pending > 8) {
      alerts.push(`High pending workload (${pending} tasks). Prioritize top 3 now.`);
      tasks.push("Close 3 oldest pending tasks before adding new work.");
    }
    if (leadsToday < targetToday) {
      tasks.push(`Add ${Math.max(0, targetToday - leadsToday)} more leads to hit today's target.`);
    }
    if (conv < 12) {
      alerts.push(`Conversion rate is low (${conv.toFixed(1)}%). Review follow-up quality.`);
      suggestions.push("Use closing script and schedule same-day callbacks for warm leads.");
    } else {
      suggestions.push("Conversion health is good. Push pipeline velocity with faster follow-ups.");
    }
    if (streak >= 3) {
      suggestions.push(`Strong streak (${streak} days). Keep momentum with one quick win first.`);
    } else if (streak === 0) {
      tasks.push("Log one meaningful sales action now to restart streak.");
    }
    if (tasks.length === 0) {
      tasks.push("Review today's pipeline and execute the highest-value next action.");
    }
    if (alerts.length === 0) {
      alerts.push("No critical operational alerts.");
    }

    return NextResponse.json({
      ok: true as const,
      tasks,
      alerts,
      suggestions,
      context: {
        actor_id: session.sub,
        employee_system: session.employeeSystem ?? null,
        role: user.role ?? session.role,
      },
    });
  } catch (e) {
    return handleApiError("POST /api/nexa/engine", e);
  }
}
