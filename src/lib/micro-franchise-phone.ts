/** Normalize referral / partner phone to digits only for matching. */
export function normalizeMicroFranchisePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
