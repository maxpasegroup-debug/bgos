/**
 * BGOS Control V4 — unified tokens (Nexa Command Center).
 * Use with Tailwind arbitrary values or inline style where needed.
 */
export const ds = {
  colors: {
    bgPrimary: "#05070A",
    bgSecondary: "#0B0F1A",
    accentPrimary: "#4FD1FF",
    accentSecondary: "#7C5CFF",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    body: "#AEB6C4",
    highlight: "#FFFFFF",
  },
  radius: {
    sm: "12px",
    md: "16px",
    lg: "20px",
    xl: "24px",
  },
} as const;

/** Tailwind-friendly class bundles for glass panels (dark control shell). */
export const glassPanel =
  "rounded-[20px] border border-white/[0.08] bg-white/[0.04] shadow-[0_0_48px_-12px_rgba(79,209,255,0.12)] backdrop-blur-xl";

export const glassPanelHover =
  "transition-all duration-300 hover:border-[#4FD1FF]/25 hover:shadow-[0_0_56px_-8px_rgba(124,92,255,0.18)]";

export const textGradientLogo =
  "bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] bg-clip-text font-bold tracking-[0.12em] text-transparent";

export const headingClass = "text-2xl font-bold tracking-tight text-white md:text-3xl";
export const bodyMutedClass = "text-sm text-[#AEB6C4]";
export const accentGlow =
  "shadow-[0_0_32px_-8px_rgba(79,209,255,0.35),inset_0_1px_0_0_rgba(255,255,255,0.06)]";
