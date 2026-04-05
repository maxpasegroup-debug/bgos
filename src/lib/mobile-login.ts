/**
 * Normalize mobile input for lookup against `User.mobile` (flexible formatting).
 */
export function mobileLookupVariants(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const variants = new Set<string>([t]);
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    variants.add(last10);
    variants.add(`+91${last10}`);
    variants.add(`91${last10}`);
    variants.add(`0${last10}`);
  }
  return [...variants];
}
