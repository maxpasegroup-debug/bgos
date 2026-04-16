import { z } from "zod";

export const DOCUMENT_TYPES = [
  "AGREEMENT",
  "SITE",
  "INVOICE",
  "KSEB",
  "KYC_PAN",
  "KYC_ID",
  "OTHER",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  AGREEMENT: "Agreement",
  SITE: "Site",
  INVOICE: "Invoice",
  KSEB: "KSEB",
  KYC_PAN: "PAN",
  KYC_ID: "ID",
  OTHER: "Other",
};

export function documentDownloadPath(documentId: string) {
  return `/api/document/download/${documentId}`;
}
