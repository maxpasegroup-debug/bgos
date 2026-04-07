import { z } from "zod";

export const DOCUMENT_TYPES = ["AGREEMENT", "APPROVAL", "REPORT", "OTHER"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const documentTypeSchema = z.enum(DOCUMENT_TYPES);

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  AGREEMENT: "Agreement",
  APPROVAL: "KSEB / Approval",
  REPORT: "Site report",
  OTHER: "Customer / Other",
};

export function documentDownloadPath(documentId: string) {
  return `/api/document/download/${documentId}`;
}
