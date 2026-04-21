"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { bodyMutedClass, glassPanel, headingClass, ds } from "@/styles/design-system";

type NexaTaskRow = {
  id: string;
  task: string;
  status: string;
  assigneeName?: string;
  createdAt: string;
};

export default function ControlWorkBoardPage() {
  const [tasks, setTasks] = useState<NexaTaskRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/control/network/nexa-tasks", { credentials: "include" });
      const j = ((await readApiJson(res, "work-nexa-tasks")) ?? {}) as {
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
      setError("Could not load tasks");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const today = tasks.filter((x) => x.status === "PENDING");
  const progress = tasks.filter((x) => x.status === "IN_PROGRESS");
  const done = tasks.filter((x) => x.status === "DONE");

  return (
    <div
      className={`min-h-full pb-20 pt-6 ${BGOS_MAIN_PAD}`}
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 50%)` }}
    >
      <div className="mx-auto max-w-6xl">
        <Link href="/bgos/control/v4" className="text-sm text-[#4FD1FF] hover:underline">
          ← Command Center
        </Link>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${headingClass} mt-4`}
        >
          Work board
        </motion.h1>
        <p className={`${bodyMutedClass} mt-2 max-w-2xl`}>
          Nexa tasks across the internal workspace — Today, In progress, and Completed.
        </p>
        {error ? <p className="mt-4 text-sm text-amber-400">{error}</p> : null}

        <div className={`${glassPanel} mt-8 grid gap-6 p-6 md:p-8 lg:grid-cols-3`}>
          <Column title="Today" items={today} />
          <Column title="In progress" items={progress} />
          <Column title="Completed" items={done} />
        </div>
      </div>
    </div>
  );
}

function Column({ title, items }: { title: string; items: NexaTaskRow[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#AEB6C4]">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-white/40">—</li>
        ) : (
          items.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2 text-sm text-white/90"
            >
              {t.task}
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
