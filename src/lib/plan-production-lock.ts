/**
 * When active, the product behaves as BASIC everywhere: effective plan is BASIC,
 * Sales Booster and upgrade prompts are hidden, Pro-gated APIs stay unavailable,
 * and WhatsApp-style automation actions do not run (no simulated sends).
 *
 * Safe for Edge (middleware) and Node — no server-only imports.
 *
 * - `BGOS_PLAN_LOCK_BASIC=true|1|on` — always lock
 * - `BGOS_PLAN_LOCK_BASIC=false|0|off` — never lock
 * - unset — lock when `NODE_ENV === "production"`
 */
export function isPlanLockedToBasic(): boolean {
  const v = process.env.BGOS_PLAN_LOCK_BASIC?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  return process.env.NODE_ENV === "production";
}
