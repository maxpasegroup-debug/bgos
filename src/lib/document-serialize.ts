import { formatDocumentUploaderRole } from "@/lib/document-role-label";
import { DOCUMENT_TYPE_LABELS, documentDownloadPath, type DocumentType } from "@/lib/document-types";

/** DB row shape for API serialization (keeps client bundle free of Prisma runtime). */
export type SerializableDocument = {
  id: string;
  companyId: string;
  leadId: string | null;
  type: string;
  fileUrl: string;
  fileName: string;
  createdAt: Date;
  uploadedByUserId?: string | null;
  uploadedByRole?: string | null;
  uploader?: { id: string; name: string } | null;
};

export type PublicDocumentRow = {
  id: string;
  companyId: string;
  leadId: string | null;
  type: string;
  typeLabel: string;
  fileName: string;
  downloadUrl: string;
  previewUrl: string;
  createdAt: string;
  uploadedByUserId: string | null;
  uploadedByName: string | null;
  uploadedByRole: string | null;
  uploadedByRoleLabel: string | null;
};

export function previewUrlForDocumentId(id: string) {
  return `${documentDownloadPath(id)}?inline=1`;
}

export function serializeDocument(row: SerializableDocument): PublicDocumentRow {
  const t = row.type as DocumentType;
  const role = row.uploadedByRole ?? null;
  return {
    id: row.id,
    companyId: row.companyId,
    leadId: row.leadId,
    type: row.type,
    typeLabel: DOCUMENT_TYPE_LABELS[t] ?? row.type,
    fileName: row.fileName,
    downloadUrl: documentDownloadPath(row.id),
    previewUrl: previewUrlForDocumentId(row.id),
    createdAt: row.createdAt.toISOString(),
    uploadedByUserId: row.uploadedByUserId ?? null,
    uploadedByName: row.uploader?.name ?? null,
    uploadedByRole: role,
    uploadedByRoleLabel: role ? formatDocumentUploaderRole(role) : null,
  };
}

export type PublicUploaderFilterOption = {
  userId: string;
  name: string;
  roleLabel: string;
};
