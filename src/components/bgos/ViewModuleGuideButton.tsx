"use client";

import type { UserManualCategory } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

export function ViewModuleGuideButton({
  category,
  className = "",
}: {
  category: UserManualCategory;
  className?: string;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);

  const probe = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/user-manuals?category=${encodeURIComponent(category)}`);
      const j = (await res.json()) as { ok?: boolean; manual?: { id: string } | null };
      setAvailable(res.ok && !!j.manual?.id);
    } catch (e) {
      console.error("API ERROR:", e);
      setAvailable(false);
    }
  }, [category]);

  useEffect(() => {
    const id = window.setTimeout(() => void probe(), 0);
    return () => window.clearTimeout(id);
  }, [probe]);

  if (available === false || available === null) {
    return null;
  }

  return (
    <a
      href={`/api/user-manuals/file?category=${encodeURIComponent(category)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/90 transition hover:border-[#FFC300]/35 hover:text-[#FFE08A] ${className}`}
    >
      <span aria-hidden>📘</span> View Guide
    </a>
  );
}
