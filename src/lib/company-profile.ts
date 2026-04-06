import { z } from "zod";

export function normalizeLogoUrl(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  if (!t) return null;
  if (t.length > 2048) throw new Error("INVALID_LOGO");
  if (/^https?:\/\/.+/i.test(t) || t.startsWith("/")) return t;
  throw new Error("INVALID_LOGO");
}

export const companySettingsPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    logoUrl: z.string().max(2048).optional().nullable(),
    primaryColor: z.string().max(32).optional().nullable(),
    secondaryColor: z.string().max(32).optional().nullable(),
    companyEmail: z
      .union([z.literal(""), z.string().email().max(200)])
      .optional()
      .nullable(),
    companyPhone: z.string().max(40).optional().nullable(),
    billingAddress: z.string().max(4000).optional().nullable(),
    gstNumber: z.string().max(32).optional().nullable(),
    bankDetails: z.string().max(4000).optional().nullable(),
  })
  .strict();

export type CompanySettingsPatchInput = z.infer<typeof companySettingsPatchSchema>;

export function sanitizeCompanySettingsPatch(
  raw: CompanySettingsPatchInput,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (raw.name !== undefined) out.name = raw.name.trim();
  if (raw.logoUrl !== undefined) {
    try {
      const n = normalizeLogoUrl(raw.logoUrl ?? null);
      out.logoUrl = n;
    } catch {
      throw new Error("INVALID_LOGO");
    }
  }
  if (raw.primaryColor !== undefined) {
    const p = raw.primaryColor?.trim();
    out.primaryColor = p && p.length > 0 ? p : null;
  }
  if (raw.secondaryColor !== undefined) {
    const p = raw.secondaryColor?.trim();
    out.secondaryColor = p && p.length > 0 ? p : null;
  }
  if (raw.companyEmail !== undefined) {
    out.companyEmail =
      raw.companyEmail === null || raw.companyEmail === ""
        ? null
        : raw.companyEmail.trim();
  }
  if (raw.companyPhone !== undefined) {
    const p = raw.companyPhone?.trim();
    out.companyPhone = p && p.length > 0 ? p : null;
  }
  if (raw.billingAddress !== undefined) {
    const p = raw.billingAddress?.trim();
    out.billingAddress = p && p.length > 0 ? p : null;
  }
  if (raw.gstNumber !== undefined) {
    const p = raw.gstNumber?.trim();
    out.gstNumber = p && p.length > 0 ? p.toUpperCase() : null;
  }
  if (raw.bankDetails !== undefined) {
    const p = raw.bankDetails?.trim();
    out.bankDetails = p && p.length > 0 ? p : null;
  }
  return out;
}
