/**
 * Returns true when the viewport width is ≤ 768 px (mobile breakpoint).
 * Safe to call on the server — returns false when window is not available.
 */
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= 768;
}
