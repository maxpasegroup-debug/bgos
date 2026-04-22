/**
 * TechRequest.description is a JSON string (set by BDM /api/bdm/tech-requests).
 * Extra SDE fields are merged into the same object; Prisma has no sdeNotes/assignee columns.
 */
export type DescriptionStatusEvent = { status: string; at: string; note?: string };

export type SdeTechRequestDescription = {
  leadId?: string | null;
  companyName?: string;
  industry?: string;
  employeeCount?: number;
  employees?: Array<{
    name?: string;
    role?: string;
    department?: string;
    responsibilities?: string;
    featuresNeeded?: string[] | string;
  }>;
  priority?: string;
  notes?: string;
  estimatedDelivery?: string;
  type?: string;
  submittedByUserId?: string;
  companyProfile?: unknown;
  bossDetails?: unknown;
  sdeNotes?: string;
  sdeAssigned?: string;
  statusHistory?: DescriptionStatusEvent[];
  completedAt?: string;
};

export function parseTechRequestDescription(raw: string | null | undefined): SdeTechRequestDescription {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SdeTechRequestDescription;
    }
  } catch {
    // ignore
  }
  return {};
}

export function normalizeTechRequestStatus(raw: string): "PENDING" | "IN_PROGRESS" | "REVIEW" | "DONE" {
  const s = raw.trim().toUpperCase();
  if (s === "IN_PROGRESS" || s === "REVIEW" || s === "DONE") return s;
  return "PENDING";
}

export function normalizePriority(raw: string): "URGENT" | "NORMAL" {
  return raw.trim().toUpperCase() === "URGENT" ? "URGENT" : "NORMAL";
}

export function companyNameFromDescription(desc: SdeTechRequestDescription, fallback: string | null): string {
  if (desc.companyName && String(desc.companyName).trim()) return String(desc.companyName).trim();
  if (fallback && fallback.trim()) return fallback;
  return "Unknown company";
}
