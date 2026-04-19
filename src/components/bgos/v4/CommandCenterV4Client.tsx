"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import {
  bodyMutedClass,
  glassPanel,
  glassPanelHover,
  headingClass,
  ds,
} from "@/styles/design-system";
import { CommandCenterNexaCeoSections } from "@/components/bgos/v4/CommandCenterNexaCeoSections";

type Briefing = {
  revenue_today: number;
  active_deals: number;
  team_performance: number;
  alerts: string[];
  suggestions: string[];
  executive_summary?: string;
};

type NexaTaskRow = {
  id: string;
  task: string;
  status: string;
  assigneeName?: string;
  createdAt: string;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export type CommandCenterVariant = "client" | "internal";

export function CommandCenterV4Client({ variant = "client" }: { variant?: CommandCenterVariant }) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<NexaTaskRow[]>([]);
  const [chat, setChat] = useState<{ role: "user" | "nexa"; text: string }[]>([
    {
      role: "nexa",
      text: "Nexa online. Ask about Sales, People, Accounts, or Tech. I respond with a direct answer.",
    },
  ]);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  const loadBriefing = useCallback(async () => {
    setBriefErr(null);
    try {
      const res = await apiFetch("/api/nexa/briefing", { credentials: "include" });
      const j = ((await readApiJson(res, "nexa-briefing")) ?? {}) as Briefing & {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || j.ok === false) {
        setBriefErr(typeof j.error === "string" ? j.error : "Briefing unavailable");
        return;
      }
      setBriefing({
        revenue_today: j.revenue_today ?? 0,
        active_deals: j.active_deals ?? 0,
        team_performance: j.team_performance ?? 0,
        alerts: Array.isArray(j.alerts) ? j.alerts : [],
        suggestions: Array.isArray(j.suggestions) ? j.suggestions : [],
        executive_summary: typeof j.executive_summary === "string" ? j.executive_summary : undefined,
      });
    } catch {
      setBriefErr("Could not load briefing");
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const tasksUrl =
        variant === "internal"
          ? "/api/internal/network/nexa-tasks"
          : "/api/company/nexa-tasks";
      const res = await apiFetch(tasksUrl, { credentials: "include" });
      const j = ((await readApiJson(res, "nexa-tasks")) ?? {}) as {
        success?: boolean;
        data?: { tasks?: NexaTaskRow[] };
        tasks?: NexaTaskRow[];
      };
      const list =
        j.success === true && Array.isArray(j.tasks)
          ? j.tasks
          : Array.isArray(j.data?.tasks)
            ? j.data!.tasks!
            : [];
      setTasks(list);
    } catch {
      setTasks([]);
    }
  }, [variant]);

  useEffect(() => {
    void loadBriefing();
    void loadTasks();
  }, [loadBriefing, loadTasks]);

  const decisionPrompts = useMemo(
    () => briefing?.suggestions?.slice(0, 3) ?? [],
    [briefing],
  );

  async function sendChat() {
    const t = input.trim();
    if (!t || chatBusy) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text: t }]);
    setChatBusy(true);
    try {
      const res = await apiFetch("/api/nexa/control-assistant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: t }),
      });
      const j = ((await readApiJson(res, "nexa-assistant")) ?? {}) as { ok?: boolean; reply?: string };
      const reply =
        res.ok && j.ok === true && typeof j.reply === "string"
          ? j.reply
          : "Nexa couldn’t reach the assistant — try again.";
      setChat((c) => [...c, { role: "nexa", text: reply }]);
    } catch {
      setChat((c) => [...c, { role: "nexa", text: "Connection error — retry in a moment." }]);
    } finally {
      setChatBusy(false);
    }
  }

  const today = tasks.filter((x) => x.status === "PENDING");
  const progress = tasks.filter((x) => x.status === "IN_PROGRESS");
  const done = tasks.filter((x) => x.status === "DONE");

  const modules =
    variant === "internal"
      ? [
          {
            href: "/internal/sales",
            title: "Sales Network",
            desc: "Hierarchy, targets, promotions, performance.",
            icon: "◎",
          },
          {
            href: "/internal/team",
            title: "People & HR",
            desc: "RSM, Tech Exec, team, wellbeing, training.",
            icon: "◆",
          },
          {
            href: "/internal/control",
            title: "Accounts & Compliance",
            desc: "Revenue, expenses, commissions, alerts.",
            icon: "◇",
          },
          {
            href: "/internal/tech",
            title: "Tech & Automation",
            desc: "Queue, requests, completions.",
            icon: "⎔",
          },
        ]
      : [
          {
            href: "/bgos/sales",
            title: "Sales",
            desc: "Pipeline, leads, and customer motion.",
            icon: "◎",
          },
          {
            href: "/bgos/hr",
            title: "People & HR",
            desc: "Team, roles, and people operations.",
            icon: "◆",
          },
          {
            href: "/bgos/accounts",
            title: "Accounts",
            desc: "Finance and compliance snapshot.",
            icon: "◇",
          },
          {
            href: "/bgos/internal-tech",
            title: "Tech & Automation",
            desc: "Requests, integrations, and delivery.",
            icon: "⎔",
          },
        ];

  return (
    <div
      className={`min-h-full pb-20 pt-6 ${BGOS_MAIN_PAD}`}
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 45%)` }}
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="grid gap-8 xl:grid-cols-[1fr_400px]">
          <div className="space-y-8">
            <header>
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={bodyMutedClass}
              >
                {greeting()}
                {variant === "internal" ? ", platform lead." : ", Boss."}
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className={`${headingClass} mt-2`}
              >
                {variant === "internal" ? "Nexa Internal Command Center" : "Nexa Command Center"}
              </motion.h1>
              <p className={`${bodyMutedClass} mt-2 max-w-2xl`}>
                {variant === "internal"
                  ? "BGOS platform control — sales network, tech, and revenue separate from tenant workspaces."
                  : "Decisions over navigation — Nexa surfaces what matters; you approve the move."}
              </p>
            </header>

            <section className={`${glassPanel} p-6 md:p-8`}>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/80">
                Nexa briefing
              </h2>
              {briefErr ? (
                <p className="mt-3 text-sm text-amber-400/90">{briefErr}</p>
              ) : briefing ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Today revenue", value: `₹${briefing.revenue_today.toFixed(2)}` },
                    { label: "Active deals", value: String(briefing.active_deals) },
                    { label: "Team performance", value: `${briefing.team_performance}%` },
                    { label: "Alerts", value: String(briefing.alerts.length) },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3"
                    >
                      <p className="text-xs text-[#AEB6C4]">{m.label}</p>
                      <p className="mt-1 text-lg font-semibold text-white">{m.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={`${bodyMutedClass} mt-4`}>Loading briefing…</p>
              )}
              {briefing?.executive_summary ? (
                <p className="mt-6 text-sm leading-relaxed text-white/80">{briefing.executive_summary}</p>
              ) : null}
              {briefing && briefing.alerts.length > 0 ? (
                <ul className="mt-6 space-y-2 text-sm text-amber-200/90">
                  {briefing.alerts.map((a) => (
                    <li key={a}>• {a}</li>
                  ))}
                </ul>
              ) : null}
              {decisionPrompts.length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {decisionPrompts.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-[#4FD1FF]/25 bg-[#4FD1FF]/10 px-3 py-1 text-xs text-[#4FD1FF]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-200"
                >
                  Act
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-medium text-[#AEB6C4]"
                >
                  Ignore
                </button>
                <button
                  type="button"
                  className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-200"
                  onClick={() => void loadBriefing()}
                >
                  Ask Nexa again
                </button>
              </div>
            </section>

            <CommandCenterNexaCeoSections />

            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/70">
                Modules
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {modules.map((m, i) => (
                  <motion.div
                    key={m.href}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i }}
                  >
                    <Link
                      href={m.href}
                      className={`block ${glassPanel} ${glassPanelHover} p-6 no-underline`}
                    >
                      <div className="flex items-start gap-4">
                        <span className="text-2xl text-[#4FD1FF]" aria-hidden>
                          {m.icon}
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{m.title}</h3>
                          <p className={`mt-1 text-sm ${bodyMutedClass}`}>{m.desc}</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </section>

            <section className={`${glassPanel} p-6 md:p-8`}>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">
                  Work board
                </h2>
                <Link
                  href={variant === "internal" ? "/internal/control" : "/bgos/operations"}
                  className="text-xs font-medium text-[#4FD1FF] hover:underline"
                >
                  Open full board
                </Link>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <TaskColumn title="Today" items={today} empty="Nothing due right now." />
                <TaskColumn title="In progress" items={progress} empty="No tasks in flight." />
                <TaskColumn title="Completed" items={done.slice(0, 8)} empty="No completions yet." />
              </div>
            </section>
          </div>

          <aside className="xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)]">
            <div className={`flex h-full min-h-[420px] flex-col ${glassPanel} overflow-hidden`}>
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Nexa</p>
                <p className="text-sm text-[#AEB6C4]">Command channel</p>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {chat.map((m, idx) => (
                  <div
                    key={`${idx}-${m.text.slice(0, 12)}`}
                    className={
                      m.role === "user"
                        ? "ml-8 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white"
                        : "mr-6 rounded-2xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/5 px-3 py-2 text-sm text-[#E8FBFF]"
                    }
                  >
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="border-t border-white/[0.06] p-3">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void sendChat()}
                    placeholder="Ask Nexa…"
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/35"
                  />
                  <button
                    type="button"
                    disabled={chatBusy}
                    onClick={() => void sendChat()}
                    className="shrink-0 rounded-2xl bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] px-4 py-2 text-xs font-semibold text-[#05070A] disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function TaskColumn({
  title,
  items,
  empty,
}: {
  title: string;
  items: NexaTaskRow[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#AEB6C4]">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-white/40">{empty}</li>
        ) : (
          items.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-sm text-white/90"
            >
              <span className="line-clamp-3">{t.task}</span>
              {t.assigneeName ? (
                <span className="mt-1 block text-xs text-[#AEB6C4]">{t.assigneeName}</span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
