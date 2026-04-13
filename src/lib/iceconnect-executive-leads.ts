import "server-only";

/** Normalize for duplicate checks within a company (last 10 digits when possible). */
export function normalizeLeadPhoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length >= 10) return d.slice(-10);
  return d;
}

export function leadPhonesDuplicate(a: string, b: string): boolean {
  const na = normalizeLeadPhoneDigits(a);
  const nb = normalizeLeadPhoneDigits(b);
  if (!na || !nb) return false;
  return na === nb;
}
