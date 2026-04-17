"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { PRICING } from "@/config/pricing";
import { LeadStatus, TaskStatus } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import { forwardLeadStatuses, leadStatusLabel } from "@/lib/lead-pipeline";
import { IncentivesFeedBanner } from "@/components/incentives/IncentivesFeedBanner";
import { OnboardBossButton } from "@/components/onboarding/OnboardBossButton";
import { IceconnectWorkspaceView } from "./IceconnectWorkspaceView";
import { IcPanel } from "./IcPanel";

type LeadRow = {
  id: string;
  name: string;
  status: LeadStatus;
  statusLabel: string;
  phone: string;
  location?: string | null;
  lastActivityAt?: string | null;
  nextActionDue?: string | null;
  activityCount?: number;
  responseStatus?: string | null;
  confidenceScore?: number | null;
  conversionProbability?: number | null;
  expectedRevenue?: number | null;
  predictedCloseDate?: string | null;
  probabilityBand?: "HIGH" | "MEDIUM" | "RISK" | null;
  heat?: "HOT" | "WARM" | "COLD" | null;
  nexaAssistSuggestion?: string | null;
  urgencyMessage?: string | null;
  atRisk?: boolean;
  nexaPriority?: boolean;
  nexaMovedAt?: string | null;
  nexaMovedReason?: string | null;
  value: number | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  overdue: boolean;
  dueDate: string | null;
  lead: { id: string; name: string } | null;
};

type SalesStats = {
  leadCount: number;
  pendingTaskCount: number;
  overdueTaskCount: number;
};
type RevenueIntel = {
  expectedRevenueThisMonth: number;
  likelyClosures: number;
  highProbabilityLeads: Array<{ leadId: string; name: string; probability: number; expectedRevenue: number; assignee: string }>;
  riskLeads: Array<{ leadId: string; name: string; probability: number; inactivityHours: number }>;
  alerts: string[];
};

function roleDisplay(role: string): string {
  if (role === "SALES_EXECUTIVE") return "Sales Executive";
  if (role === "TELECALLER") return "Telecaller";
  if (role === "MANAGER") return "Manager";
  return role;
}

type MetroStage = "New" | "Introduced" | "Demo" | "Follow-up" | "Onboard" | "Subscription";
const METRO_STAGES: MetroStage[] = [
  "New",
  "Introduced",
  "Demo",
  "Follow-up",
  "Onboard",
  "Subscription",
];

function leadToMetroStage(status: LeadStatus): MetroStage {
  if (status === LeadStatus.NEW) return "New";
  if (status === LeadStatus.CONTACTED || status === LeadStatus.QUALIFIED) return "Introduced";
  if (status === LeadStatus.SITE_VISIT_SCHEDULED || status === LeadStatus.SITE_VISIT_COMPLETED || status === LeadStatus.PROPOSAL_SENT) return "Demo";
  if (status === LeadStatus.NEGOTIATION) return "Follow-up";
  if (status === LeadStatus.PROPOSAL_WON) return "Onboard";
  if (status === LeadStatus.WON) return "Subscription";
  return "New";
}

function metroStageToLeadStatus(stage: MetroStage): LeadStatus {
  if (stage === "New") return LeadStatus.NEW;
  if (stage === "Introduced") return LeadStatus.CONTACTED;
  if (stage === "Demo") return LeadStatus.SITE_VISIT_SCHEDULED;
  if (stage === "Follow-up") return LeadStatus.NEGOTIATION;
  if (stage === "Onboard") return LeadStatus.PROPOSAL_WON;
  return LeadStatus.WON;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function formatIceApiError(json: unknown, fallback: string): string {
  if (!isRecord(json)) return fallback;
  const err = json.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (isRecord(err) && typeof err.formErrors === "object") {
    const fe = err.formErrors;
    if (Array.isArray(fe) && fe.length > 0 && typeof fe[0] === "string") return fe[0];
  }
  const code = json.code;
  if (typeof code === "string" && code.trim()) return `${fallback} (${code})`;
  return fallback;
}

function normalizeLead(raw: unknown): LeadRow | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const name = raw.name;
  const status = raw.status;
  if (typeof id !== "string" || !id || typeof name !== "string" || typeof status !== "string") {
    return null;
  }
  if (!(status in LeadStatus)) return null;
  const phone = typeof raw.phone === "string" ? raw.phone : "—";
  const location = typeof raw.location === "string" ? raw.location : null;
  const statusLabel =
    typeof raw.statusLabel === "string" && raw.statusLabel.trim()
      ? raw.statusLabel
      : leadStatusLabel(status as LeadStatus);
  const value =
    typeof raw.value === "number" && Number.isFinite(raw.value)
      ? raw.value
      : raw.value === null
        ? null
        : null;
  return {
    id,
    name,
    status: status as LeadStatus,
    statusLabel,
    phone,
    location,
    lastActivityAt: typeof raw.lastActivityAt === "string" ? raw.lastActivityAt : null,
    nextActionDue: typeof raw.nextActionDue === "string" ? raw.nextActionDue : null,
    activityCount: typeof raw.activityCount === "number" ? raw.activityCount : 0,
    responseStatus: typeof raw.responseStatus === "string" ? raw.responseStatus : null,
    confidenceScore: typeof raw.confidenceScore === "number" ? raw.confidenceScore : null,
    conversionProbability: typeof raw.conversionProbability === "number" ? raw.conversionProbability : null,
    expectedRevenue: typeof raw.expectedRevenue === "number" ? raw.expectedRevenue : null,
    predictedCloseDate: typeof raw.predictedCloseDate === "string" ? raw.predictedCloseDate : null,
    probabilityBand: typeof raw.probabilityBand === "string" ? (raw.probabilityBand as "HIGH" | "MEDIUM" | "RISK") : null,
    heat: typeof raw.heat === "string" ? (raw.heat as "HOT" | "WARM" | "COLD") : null,
    nexaAssistSuggestion: typeof raw.nexaAssistSuggestion === "string" ? raw.nexaAssistSuggestion : null,
    urgencyMessage: typeof raw.urgencyMessage === "string" ? raw.urgencyMessage : null,
    atRisk: raw.atRisk === true,
    nexaPriority: raw.nexaPriority === true,
    nexaMovedAt: typeof raw.nexaMovedAt === "string" ? raw.nexaMovedAt : null,
    nexaMovedReason: typeof raw.nexaMovedReason === "string" ? raw.nexaMovedReason : null,
    value,
  };
}

function normalizeTask(raw: unknown): TaskRow | null {
  if (!isRecord(raw)) return null;
  const id = raw.id;
  const title = raw.title;
  const status = raw.status;
  if (typeof id !== "string" || !id || typeof title !== "string" || typeof status !== "string") {
    return null;
  }
  if (!(status in TaskStatus)) return null;
  let lead: { id: string; name: string } | null = null;
  const lr = raw.lead;
  if (isRecord(lr) && typeof lr.id === "string" && typeof lr.name === "string") {
    lead = { id: lr.id, name: lr.name };
  }
  const dueDate = typeof raw.dueDate === "string" ? raw.dueDate : null;
  const overdue = raw.overdue === true;
  return {
    id,
    title,
    status: status as TaskStatus,
    overdue,
    dueDate,
    lead,
  };
}

function formatDueLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const day = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const t = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (d < now) return `Due ${day}, ${t}`;
  return `${day}, ${t}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function IceconnectSalesDashboard() {
  const { company } = useCompanyBranding();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeRole, setEmployeeRole] = useState("SALES_EXECUTIVE");
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<MetroStage | null>(null);
  const [nexaSuggestion, setNexaSuggestion] = useState("Follow up with 3 leads today.");
  const [nexaPreviewCount, setNexaPreviewCount] = useState(0);
  const [nexaPreviewOpen, setNexaPreviewOpen] = useState(false);
  const [nexaPreview, setNexaPreview] = useState<
    Array<{
      leadId: string;
      leadName: string;
      suggestion: string;
      reason: string;
      nextStatus?: string;
      heat?: "HOT" | "WARM" | "COLD";
      urgencyMessage?: string;
      atRisk?: boolean;
    }>
  >([]);
  const [nexaBusy, setNexaBusy] = useState(false);
  const [revenueIntel, setRevenueIntel] = useState<RevenueIntel | null>(null);
  const [sessionUserId, setSessionUserId] = useState("");

  useEffect(() => {
    let c = true;
    (async () => {
      try {
        const res = await apiFetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as { user?: { id?: string; name?: string; role?: string } };
        if (!c) return;
        if (typeof j.user?.id === "string" && j.user.id.trim()) {
          setSessionUserId(j.user.id.trim());
        }
        if (typeof j.user?.name === "string" && j.user.name.trim()) {
          setEmployeeName(j.user.name.trim());
        }
        if (typeof j.user?.role === "string" && j.user.role.trim()) {
          setEmployeeRole(j.user.role.trim());
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      c = false;
    };
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/iceconnect/sales/data", { credentials: "include" });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setErr(res.ok ? "Invalid response from server." : "Could not load your workspace.");
        return;
      }

      if (!res.ok) {
        setErr(
          formatIceApiError(
            json,
            res.status === 401 ? "Session expired — sign in again." : "Could not load your workspace.",
          ),
        );
        return;
      }

      if (!isRecord(json) || json.ok !== true) {
        setErr(formatIceApiError(json, "Could not load your workspace."));
        return;
      }

      const rawLeads = Array.isArray(json.leads) ? json.leads : [];
      const rawTasks = Array.isArray(json.tasks) ? json.tasks : [];
      setLeads(rawLeads.map(normalizeLead).filter(Boolean) as LeadRow[]);
      setTasks(rawTasks.map(normalizeTask).filter(Boolean) as TaskRow[]);

      const st = json.stats;
      if (
        isRecord(st) &&
        typeof st.leadCount === "number" &&
        typeof st.pendingTaskCount === "number" &&
        typeof st.overdueTaskCount === "number"
      ) {
        setStats({
          leadCount: st.leadCount,
          pendingTaskCount: st.pendingTaskCount,
          overdueTaskCount: st.overdueTaskCount,
        });
      } else {
        setStats(null);
      }

      const nx = json.nexa;
      if (isRecord(nx)) {
        if (typeof nx.suggestion === "string" && nx.suggestion.trim()) setNexaSuggestion(nx.suggestion);
        if (typeof nx.previewCount === "number") setNexaPreviewCount(nx.previewCount);
      }
      if (isRecord(json.revenueIntel)) {
        const ri = json.revenueIntel as RevenueIntel;
        setRevenueIntel(ri);
      }
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const { followUps, generalTasks } = useMemo(() => {
    const pending = tasks.filter((t) => t.status === TaskStatus.PENDING);
    const followUps = pending.filter((t) => t.dueDate != null && t.dueDate !== "");
    const generalTasks = pending.filter((t) => t.dueDate == null || t.dueDate === "");
    followUps.sort((a, b) => {
      const ta = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const tb = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return ta - tb;
    });
    return { followUps, generalTasks };
  }, [tasks]);

  const tasksDueToday = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const tom = today + 86400000;
    return followUps.filter((t) => {
      if (!t.dueDate) return false;
      const ts = new Date(t.dueDate).getTime();
      return ts >= today && ts < tom;
    }).length;
  }, [followUps]);

  const nexaAssist = useMemo(() => {
    const hotAutoClose = leads.find((l) => l.heat === "HOT" && l.nexaAssistSuggestion);
    if (hotAutoClose) {
      return {
        line: hotAutoClose.nexaAssistSuggestion!,
        sub: hotAutoClose.urgencyMessage ?? "High-intent lead ready to close.",
      };
    }
    const urgent = tasks.find((t) => t.status === TaskStatus.PENDING && t.overdue);
    if (urgent) {
      const who = urgent.lead?.name ?? urgent.title;
      return { line: `Follow up: ${who}`, sub: "Overdue — prioritize this touchpoint" };
    }
    const hot = leads.find(
      (l) => l.status === LeadStatus.QUALIFIED || l.status === LeadStatus.NEW,
    );
    if (hot) {
      return { line: `Call ${hot.name}`, sub: "Hot lead — move the conversation forward" };
    }
    if (leads.length > 0) {
      const l = leads[0];
      return { line: `Nurture ${l.name}`, sub: l.statusLabel };
    }
    return {
      line: "Review your pipeline",
      sub: "No urgent items — stay ready for new assignments.",
    };
  }, [tasks, leads]);

  const performanceScore = useMemo(() => {
    if (!stats) return null;
    const base = 100;
    const penalty = stats.overdueTaskCount * 12 + Math.max(0, stats.pendingTaskCount - 5) * 2;
    return Math.max(35, Math.min(100, base - penalty));
  }, [stats]);

  const metroStageCounts = useMemo(() => {
    const rows = METRO_STAGES.map((stage) => ({ stage, count: 0 }));
    for (const l of leads) {
      const stage = leadToMetroStage(l.status);
      const row = rows.find((r) => r.stage === stage);
      if (row) row.count += 1;
    }
    return rows;
  }, [leads]);

  const furthestStageIndex = useMemo(() => {
    let max = 0;
    for (const l of leads) {
      const idx = METRO_STAGES.indexOf(leadToMetroStage(l.status));
      if (idx > max) max = idx;
    }
    return max;
  }, [leads]);

  const pipelineSummary = useMemo(() => {
    const total = leads.length;
    const subs = leads.filter((l) => leadToMetroStage(l.status) === "Subscription").length;
    const moved = leads.filter((l) => leadToMetroStage(l.status) !== "New").length;
    return {
      total,
      conversion: total > 0 ? Math.round((subs / total) * 100) : 0,
      todayMovement: moved,
    };
  }, [leads]);

  const leadsSortedByPriority = useMemo(() => {
    const rows = [...leads];
    rows.sort((a, b) => {
      const pa = (a.conversionProbability ?? 0) * ((a.value ?? PRICING.BASIC.price) / 1000);
      const pb = (b.conversionProbability ?? 0) * ((b.value ?? PRICING.BASIC.price) / 1000);
      return pb - pa;
    });
    return rows;
  }, [leads]);

  async function updateStatus(leadId: string, status: LeadStatus) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/sales/lead-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setErr("Update failed — invalid response.");
        return;
      }
      if (!res.ok) {
        setErr(formatIceApiError(json, "Could not update lead status."));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function completeTask(taskId: string) {
    setBusy(taskId);
    setErr(null);
    try {
      const res = await apiFetch("/api/tasks/complete", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        setErr("Could not complete task — invalid response.");
        return;
      }
      if (!res.ok) {
        setErr(formatIceApiError(json, "Could not complete task."));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function openNexaPreview() {
    setNexaBusy(true);
    try {
      const res = await apiFetch("/api/iceconnect/sales/nexa-auto-move", { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        preview?: Array<{
          leadId: string;
          leadName: string;
          suggestion: string;
          reason: string;
          nextStatus?: string;
          heat?: "HOT" | "WARM" | "COLD";
          urgencyMessage?: string;
          atRisk?: boolean;
        }>;
      };
      if (res.ok && j.ok) {
        setNexaPreview(j.preview ?? []);
        setNexaPreviewOpen(true);
      }
    } finally {
      setNexaBusy(false);
    }
  }

  async function applyNexaAutoMove() {
    setNexaBusy(true);
    try {
      await apiFetch("/api/iceconnect/sales/nexa-auto-move", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewOnly: false }),
      });
      setNexaPreviewOpen(false);
      await load();
    } finally {
      setNexaBusy(false);
    }
  }

  const cName = company?.name?.trim() ?? "your company";
  const welcomeName = employeeName || "there";

  const hero = (
      <div className="space-y-5">
        <IncentivesFeedBanner variant="sales" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-sky-300">
            {cName}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Welcome back, {welcomeName}
          </h2>
          <p className="mt-1 text-sm text-slate-300">Here’s your work for today</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/iceconnect/internal-sales"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-100 transition hover:border-sky-400/40 hover:bg-white/10"
            >
              Team pipeline
            </Link>
            <Link
              href="/lead"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-100 transition hover:border-sky-400/40 hover:bg-white/10"
            >
              Add lead
            </Link>
          </div>
        </motion.div>

        {stats ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.35 }}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-sky-400/30"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Tasks due today
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{tasksDueToday}</p>
              <p className="mt-1 text-xs text-slate-400">
                {stats.overdueTaskCount > 0 ? (
                  <span className="font-medium text-amber-300">
                    {stats.overdueTaskCount} urgent overdue
                  </span>
                ) : (
                  "On track"
                )}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-sky-400/30"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Assigned leads
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {stats.leadCount}
              </p>
              <p className="mt-1 text-xs text-slate-400">Quick status updates below</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-sky-400/30"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Performance
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                {performanceScore ?? "—"}
              </p>
              <p className="mt-1 text-xs text-slate-400">Tasks completed vs pending balance</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-500/10 to-white/[0.03] p-4 shadow-sm backdrop-blur-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
                NEXA assist
              </p>
              <p className="mt-2 text-sm font-semibold text-white">Next action:</p>
              <p className="mt-0.5 text-sm text-slate-100">{nexaAssist.line}</p>
              <p className="mt-2 text-xs text-slate-300">{nexaAssist.sub}</p>
            </motion.div>
          </div>
        ) : null}
      </div>
  );

  const gradientBtn =
    "min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:brightness-105 disabled:opacity-50";
  const gradientStyle = {
    background: "linear-gradient(90deg, var(--ice-primary), var(--ice-secondary))",
  } as CSSProperties;

  const onboardBossLeadId = useMemo(() => {
    if (draggingLeadId && leads.some((l) => l.id === draggingLeadId)) return draggingLeadId;
    return leads[0]?.id ?? "";
  }, [draggingLeadId, leads]);

  return (
    <IceconnectWorkspaceView
      title={`${cName} Sales`}
      subtitle={`${roleDisplay(employeeRole)} • Leads assigned to you, tasks, and scheduled follow-ups.`}
      loading={loading}
      error={err}
      onRetry={() => void load()}
      hero={hero}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <OnboardBossButton
          source="sales"
          leadId={onboardBossLeadId}
          ownerId={sessionUserId}
          referralSource="sales_dashboard"
        />
        <button
          type="button"
          disabled={nexaBusy}
          onClick={() => void openNexaPreview()}
          className="min-h-11 rounded-lg border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50"
        >
          Nexa Auto Move ({nexaPreviewCount})
        </button>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-11 min-w-[5.5rem] rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:shadow disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
        <button type="button" onClick={() => setNexaPreviewOpen(true)} className="font-medium underline underline-offset-2">
          Nexa suggests:
        </button>{" "}
        {nexaSuggestion}
      </div>

      <IcPanel title="Nexa Revenue Intelligence">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs text-slate-400">Expected Revenue (month)</p>
            <p className="mt-1 text-xl font-semibold text-emerald-300">
              ₹{(revenueIntel?.expectedRevenueThisMonth ?? 0).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs text-slate-400">Likely Closures</p>
            <p className="mt-1 text-xl font-semibold text-white">{revenueIntel?.likelyClosures ?? 0}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 md:col-span-2">
            <p className="text-xs text-slate-400">Nexa alerts</p>
            <ul className="mt-1 list-disc pl-4 text-sm text-amber-200">
              {(revenueIntel?.alerts ?? ["No immediate risk alerts."]).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs text-slate-400">High probability leads</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {(revenueIntel?.highProbabilityLeads ?? []).slice(0, 5).map((l) => (
                <li key={l.leadId}>
                  {l.name} • {l.probability}% • ₹{l.expectedRevenue.toLocaleString("en-IN")}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs text-slate-400">Risk leads</p>
            <ul className="mt-2 space-y-1 text-sm text-rose-200">
              {(revenueIntel?.riskLeads ?? []).slice(0, 5).map((l) => (
                <li key={l.leadId}>
                  {l.name} • {l.probability}% • {l.inactivityHours}h inactive
                </li>
              ))}
            </ul>
          </div>
        </div>
      </IcPanel>

      <IcPanel title="Leads metro tracker">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
              Total leads: <span className="font-semibold text-white">{pipelineSummary.total}</span>
            </span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-1">
              Conversion: <span className="font-semibold text-emerald-200">{pipelineSummary.conversion}%</span>
            </span>
            <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1">
              Today movement: <span className="font-semibold text-amber-100">{pipelineSummary.todayMovement}</span>
            </span>
          </div>

          <div className="relative overflow-x-auto pb-1">
            <div className="absolute left-2 right-2 top-7 h-[2px] bg-white/15" />
            <motion.div
              className="absolute left-2 top-7 h-[2px] bg-gradient-to-r from-emerald-400 via-amber-300 to-sky-400"
              animate={{ x: ["0%", "25%", "0%"] }}
              transition={{ duration: 4.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              style={{ width: "35%" }}
            />
            <div className="relative hidden min-w-[760px] grid-cols-6 gap-3 md:grid">
              {metroStageCounts.map((row, idx) => {
                const done = idx <= furthestStageIndex;
                const active = dropTargetStage === row.stage;
                return (
                  <button
                    key={row.stage}
                    type="button"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTargetStage(row.stage);
                    }}
                    onDrop={() => {
                      const leadId = draggingLeadId;
                      setDropTargetStage(null);
                      if (!leadId) return;
                      void updateStatus(leadId, metroStageToLeadStatus(row.stage));
                    }}
                    onDragLeave={() => setDropTargetStage((prev) => (prev === row.stage ? null : prev))}
                    className="flex flex-col items-center gap-2 text-center"
                  >
                    <motion.span
                      animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                      transition={{ duration: 1.6, repeat: active ? Number.POSITIVE_INFINITY : 0 }}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        active
                          ? "border-amber-300 bg-amber-300/20 shadow-[0_0_18px_rgba(245,158,11,0.5)]"
                          : done
                            ? "border-emerald-400 bg-emerald-400/20"
                            : "border-slate-500 bg-slate-700/40"
                      }`}
                    />
                    <span className={`text-xs font-medium ${active ? "text-amber-200" : done ? "text-emerald-200" : "text-slate-400"}`}>
                      {row.stage}
                    </span>
                    <span className="text-sm font-semibold text-white">{row.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile fallback: vertical metro */}
            <div className="space-y-2 md:hidden">
              {metroStageCounts.map((row, idx) => {
                const done = idx <= furthestStageIndex;
                const active = dropTargetStage === row.stage;
                return (
                  <div
                    key={row.stage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTargetStage(row.stage);
                    }}
                    onDrop={() => {
                      const leadId = draggingLeadId;
                      setDropTargetStage(null);
                      if (!leadId) return;
                      void updateStatus(leadId, metroStageToLeadStatus(row.stage));
                    }}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      active
                        ? "border-amber-300/40 bg-amber-400/10"
                        : done
                          ? "border-emerald-400/30 bg-emerald-400/10"
                          : "border-white/10 bg-white/5"
                    }`}
                  >
                    <span className="text-sm text-white">{row.stage}</span>
                    <span className="text-sm font-semibold text-white">{row.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {leads.length === 0 ? (
            <p className="text-sm text-slate-400">No leads in pipeline yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="hidden min-w-[760px] grid-cols-6 gap-3 md:grid">
                {METRO_STAGES.map((stage, stageIdx) => {
                  const stageLeads = leadsSortedByPriority.filter((l) => leadToMetroStage(l.status) === stage);
                  return (
                    <div key={stage} className="space-y-3">
                      {stageLeads.map((l, i) => {
                        const options = forwardLeadStatuses(l.status);
                        const valueText =
                          l.value != null && l.value > 0 ? `₹${l.value.toLocaleString("en-IN")}` : null;
                        return (
                          <motion.div
                            layout
                            key={l.id}
                            draggable
                            onDragStart={() => setDraggingLeadId(l.id)}
                            onDragEnd={() => {
                              setDraggingLeadId(null);
                              setDropTargetStage(null);
                            }}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.03 + stageIdx * 0.02 }}
                            className={`rounded-[14px] border bg-white/[0.04] p-4 backdrop-blur-md transition hover:-translate-y-0.5 ${
                              l.heat === "HOT"
                                ? "border-emerald-300/45 shadow-[0_0_26px_rgba(16,185,129,0.28)]"
                                : l.atRisk
                                  ? "border-rose-300/35 shadow-[0_0_18px_rgba(244,63,94,0.2)]"
                                  : "border-white/10 hover:border-sky-400/30"
                            }`}
                            whileHover={l.heat === "HOT" ? { scale: 1.01 } : undefined}
                          >
                            <p className="truncate font-semibold text-white">{l.name || "Lead"}</p>
                            <p className="mt-1 text-xs text-slate-300">{l.phone}</p>
                            <p className="mt-1 text-xs text-slate-400">{l.location || "Location pending"}</p>
                            <span className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                              {stage}
                            </span>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  (l.conversionProbability ?? 0) >= 70
                                    ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
                                    : (l.conversionProbability ?? 0) >= 40
                                      ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
                                      : "border-rose-300/40 bg-rose-500/15 text-rose-200"
                                }`}
                              >
                                {(l.conversionProbability ?? 0)}%
                              </span>
                              <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                                ₹{Math.round(l.expectedRevenue ?? 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                            {l.predictedCloseDate ? (
                              <p className="mt-1 text-[10px] text-slate-400">
                                Closes by{" "}
                                {new Date(l.predictedCloseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </p>
                            ) : null}
                            {l.nexaMovedAt ? (
                              <span className="ml-1 mt-2 inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
                                Moved by Nexa
                              </span>
                            ) : null}
                            {l.heat ? (
                              <span
                                className={`ml-1 mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${
                                  l.heat === "HOT"
                                    ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                                    : l.heat === "WARM"
                                      ? "border-amber-300/40 bg-amber-500/10 text-amber-100"
                                      : "border-slate-300/30 bg-slate-500/10 text-slate-300"
                                }`}
                              >
                                {l.heat === "HOT" ? "🔥 Hot" : l.heat === "WARM" ? "⚡ Warm" : "❄ Cold"}
                              </span>
                            ) : null}
                            {l.atRisk ? (
                              <span className="ml-1 mt-2 inline-flex rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">
                                At Risk
                              </span>
                            ) : null}
                            {valueText ? <p className="mt-1 text-xs text-slate-300">{valueText}</p> : null}
                            {l.nexaAssistSuggestion ? (
                              <p className="mt-1 text-[10px] text-sky-200">{l.nexaAssistSuggestion}</p>
                            ) : null}
                            <div className="mt-3">
                              {options.length > 0 ? (
                                <select
                                  defaultValue=""
                                  disabled={busy === l.id}
                                  onChange={(e) => {
                                    const v = e.target.value as LeadStatus;
                                    if (v) void updateStatus(l.id, v);
                                    e.target.value = "";
                                  }}
                                  className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-sky-400/40"
                                >
                                  <option value="" disabled>
                                    Move stage…
                                  </option>
                                  {options.map((st) => (
                                    <option key={st} value={st}>
                                      {leadStatusLabel(st)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className="text-xs text-slate-500">Closed</p>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Mobile: single horizontal strip */}
              <div className="flex gap-3 md:hidden">
                {leadsSortedByPriority.map((l) => {
                const options = forwardLeadStatuses(l.status);
                const valueText = l.value != null && l.value > 0 ? `₹${l.value.toLocaleString("en-IN")}` : null;
                return (
                  <motion.div
                    layout
                    key={l.id}
                    draggable
                    onDragStart={() => setDraggingLeadId(l.id)}
                    onDragEnd={() => {
                      setDraggingLeadId(null);
                      setDropTargetStage(null);
                    }}
                    className={`rounded-[14px] border bg-white/[0.04] p-4 backdrop-blur-md transition hover:-translate-y-0.5 ${
                      l.heat === "HOT"
                        ? "border-emerald-300/45 shadow-[0_0_26px_rgba(16,185,129,0.28)]"
                        : l.atRisk
                          ? "border-rose-300/35 shadow-[0_0_18px_rgba(244,63,94,0.2)]"
                          : "border-white/10 hover:border-sky-400/30"
                    }`}
                  >
                    <p className="truncate font-semibold text-white">{l.name || "Lead"}</p>
                    <p className="mt-1 text-xs text-slate-300">{l.phone}</p>
                    <p className="mt-1 text-xs text-slate-400">{l.location || "Location pending"}</p>
                    <span className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                      {leadToMetroStage(l.status)}
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          (l.conversionProbability ?? 0) >= 70
                            ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
                            : (l.conversionProbability ?? 0) >= 40
                              ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
                              : "border-rose-300/40 bg-rose-500/15 text-rose-200"
                        }`}
                      >
                        {(l.conversionProbability ?? 0)}%
                      </span>
                      <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                        ₹{Math.round(l.expectedRevenue ?? 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {l.nexaMovedAt ? (
                      <span className="ml-1 mt-2 inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200">
                        Moved by Nexa
                      </span>
                    ) : null}
                    {l.heat ? (
                      <span
                        className={`ml-1 mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${
                          l.heat === "HOT"
                            ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
                            : l.heat === "WARM"
                              ? "border-amber-300/40 bg-amber-500/10 text-amber-100"
                              : "border-slate-300/30 bg-slate-500/10 text-slate-300"
                        }`}
                      >
                        {l.heat === "HOT" ? "🔥 Hot" : l.heat === "WARM" ? "⚡ Warm" : "❄ Cold"}
                      </span>
                    ) : null}
                    {l.atRisk ? (
                      <span className="ml-1 mt-2 inline-flex rounded-full border border-rose-300/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">
                        At Risk
                      </span>
                    ) : null}
                    {valueText ? <p className="mt-1 text-xs text-slate-300">{valueText}</p> : null}
                    {l.nexaAssistSuggestion ? (
                      <p className="mt-1 text-[10px] text-sky-200">{l.nexaAssistSuggestion}</p>
                    ) : null}
                    <div className="mt-3">
                      {options.length > 0 ? (
                        <select
                          defaultValue=""
                          disabled={busy === l.id}
                          onChange={(e) => {
                            const v = e.target.value as LeadStatus;
                            if (v) void updateStatus(l.id, v);
                            e.target.value = "";
                          }}
                          className="min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-sky-400/40"
                        >
                          <option value="" disabled>
                            Move stage…
                          </option>
                          {options.map((st) => (
                            <option key={st} value={st}>
                              {leadStatusLabel(st)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-slate-500">Closed</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </IcPanel>

      {nexaPreviewOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b1220] p-5 text-slate-100 shadow-2xl">
            <h3 className="text-lg font-semibold">Nexa move preview</h3>
            <p className="mt-1 text-sm text-slate-400">
              Safety mode: review moves before applying.
            </p>
            <div className="mt-4 max-h-72 space-y-2 overflow-auto">
              {nexaPreview.length === 0 ? (
                <p className="text-sm text-slate-400">No priority moves right now.</p>
              ) : (
                nexaPreview.map((p) => (
                  <div key={`${p.leadId}-${p.reason}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                    <p className="font-medium text-white">{p.leadName}</p>
                    <p className="text-slate-300">{p.suggestion}</p>
                    {p.urgencyMessage ? <p className="text-xs text-amber-200">{p.urgencyMessage}</p> : null}
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNexaPreviewOpen(false)}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                disabled={nexaBusy}
                onClick={() => void applyNexaAutoMove()}
                className="rounded-lg border border-amber-300/30 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-200 disabled:opacity-50"
              >
                Apply Nexa moves
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <IcPanel title="Follow-ups">
        <p className="mb-4 text-xs text-gray-500">
          Scheduled tasks with a due date — call or act before the time shown.
        </p>
        {followUps.length === 0 ? (
          <p className="text-sm text-gray-500">No scheduled follow-ups.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white/90">
            {followUps.map((t) => {
              const due = formatDueLabel(t.dueDate);
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-gray-900">{t.title || "Task"}</p>
                    {t.lead ? (
                      <p className="text-xs text-gray-500">Lead: {t.lead.name}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      {due ? (
                        <span className="text-xs tabular-nums text-[color:var(--ice-primary)]">
                          {due}
                        </span>
                      ) : null}
                      {t.overdue ? (
                        <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          Overdue
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void completeTask(t.id)}
                    className={gradientBtn}
                    style={gradientStyle}
                  >
                    Mark done
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </IcPanel>

      <IcPanel title="Tasks">
        {generalTasks.length === 0 ? (
          <p className="text-sm text-gray-500">No other pending tasks.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white/90">
            {generalTasks.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-gray-900">{t.title || "Task"}</p>
                  {t.lead ? (
                    <p className="text-xs text-gray-500">Lead: {t.lead.name}</p>
                  ) : null}
                  {t.overdue ? (
                    <span className="inline-flex rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                      Overdue
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void completeTask(t.id)}
                  className="min-h-11 w-full shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                >
                  Mark complete
                </button>
              </li>
            ))}
          </ul>
        )}
      </IcPanel>
    </IceconnectWorkspaceView>
  );
}
