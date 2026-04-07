import type { Document } from "@prisma/client";
import { DOCUMENT_TYPE_LABELS, documentDownloadPath, type DocumentType } from "@/lib/document-types";

export type PublicDocumentRow = {
  id: string;
  companyId: string;
  leadId: string | null;
  type: string;
  typeLabel: string;
  fileName: string;
  downloadUrl: string;
  createdAt: string;
};

export function serializeDocument(row: Document): PublicDocumentRow {
  const t = row.type as DocumentType;
  return {
    id: row.id,
    companyId: row.companyId,
    leadId: row.leadId,
    type: row.type,
    typeLabel: DOCUMENT_TYPE_LABELS[t] ?? row.type,
    fileName: row.fileName,
    downloadUrl: documentDownloadPath(row.id),
    createdAt: row.createdAt.toISOString(),
  };
}
