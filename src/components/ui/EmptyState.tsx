import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/**
 * Consistent empty / zero-data messaging for dashboards and lists.
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center sm:px-6 ${className}`}
      role="status"
    >
      {icon ? <div className="mb-3 flex justify-center text-white/35">{icon}</div> : null}
      <p className="text-sm font-medium text-white/80">{title}</p>
      {description ? <p className="mt-1.5 text-xs text-white/45">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
