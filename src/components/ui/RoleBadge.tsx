import { getRoleDisplayName } from "@/lib/role-display";

export function RoleBadge({ role }: { role: string }) {
  const display = getRoleDisplayName(role);

  const colors: Record<string, string> = {
    BDM: "bg-violet-500/10 text-violet-200 border-violet-300/35",
    ADMIN: "bg-cyan-500/10 text-cyan-200 border-cyan-300/35",
    TECH_EXECUTIVE: "bg-blue-500/10 text-blue-200 border-blue-300/35",
    TECH_HEAD: "bg-blue-500/10 text-blue-200 border-blue-300/35",
  };

  const colorClass = colors[role] ?? "bg-white/10 text-white/70 border-white/20";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${colorClass}`}>
      {display}
    </span>
  );
}
