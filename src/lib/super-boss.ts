/**
 * BGOS platform owner (single configured email). Safe for Edge + Node (env only).
 */
export function getBgosBossEmail(): string {
  return (process.env.BGOS_BOSS_EMAIL ?? "").trim().toLowerCase();
}

export function isSuperBossEmail(email: string | null | undefined): boolean {
  const boss = getBgosBossEmail();
  if (!boss) return false;
  const e = (email ?? "").trim().toLowerCase();
  return e.length > 0 && e === boss;
}
