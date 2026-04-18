/**
 * Canonical platform owner for `/bgos/control` and `superBoss` JWT flows.
 * Override with `BGOS_BOSS_EMAIL` (e.g. staging); when unset, this address is used.
 * Safe for Edge + Node (env only).
 */
export const BGOS_PLATFORM_BOSS_EMAIL = "boss@bgos.online";

export function getBgosBossEmail(): string {
  const fromEnv = (process.env.BGOS_BOSS_EMAIL ?? "").trim().toLowerCase();
  return fromEnv || BGOS_PLATFORM_BOSS_EMAIL;
}

export function isSuperBossEmail(email: string | null | undefined): boolean {
  const boss = getBgosBossEmail();
  if (!boss) return false;
  const e = (email ?? "").trim().toLowerCase();
  return e.length > 0 && e === boss;
}
