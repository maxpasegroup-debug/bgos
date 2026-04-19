/**
 * Internal Training System  (id: bgos_training_system_v2)
 *
 * Access rules:
 *   BOSS / RSM  — full CRUD
 *   BDM         — view materials where roleScope IN [ALL, BDE, BDM]
 *   BDE         — view materials where roleScope IN [ALL, BDE]
 *
 * Storage follows document-storage.ts: uploaded files are written to the
 * local `uploads/training/` folder; VIDEO materials store a raw URL.
 */

import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  SalesNetworkRole,
  TrainingMaterialType,
  TrainingRoleScope,
  type PrismaClient,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_TRAINING_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".txt"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

// ---------------------------------------------------------------------------
// Role → visible scopes
// ---------------------------------------------------------------------------

export function visibleScopesForRole(role: SalesNetworkRole): TrainingRoleScope[] {
  switch (role) {
    case SalesNetworkRole.BOSS:
    case SalesNetworkRole.RSM:
      return [TrainingRoleScope.ALL, TrainingRoleScope.BDE, TrainingRoleScope.BDM, TrainingRoleScope.RSM];
    case SalesNetworkRole.BDM:
      return [TrainingRoleScope.ALL, TrainingRoleScope.BDE, TrainingRoleScope.BDM];
    default:
      return [TrainingRoleScope.ALL, TrainingRoleScope.BDE];
  }
}

export function canUpload(role: SalesNetworkRole): boolean {
  return role === SalesNetworkRole.RSM || role === SalesNetworkRole.BOSS;
}

// ---------------------------------------------------------------------------
// File storage
// ---------------------------------------------------------------------------

function uploadsTrainingRoot() {
  return path.join(process.cwd(), "uploads", "training");
}

function safeBasename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

export function assertAllowedTrainingFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, error: "Choose a valid file." };
  }
  if (file.size > MAX_TRAINING_FILE_BYTES) {
    return { ok: false, error: `File too large (max ${MAX_TRAINING_FILE_BYTES / (1024 * 1024)} MB).` };
  }
  const ext = path.extname(file.name ?? "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: "Only PDF, DOC, DOCX, and TXT files are allowed." };
  }
  const mime = (file.type || "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime && !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Unsupported file type." };
  }
  return { ok: true };
}

export async function saveTrainingFile(
  companyId: string,
  file: File,
): Promise<{ storageKey: string }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 10);
  const rand = randomBytes(6).toString("hex");
  const safe = safeBasename(file.name);
  const fileName = `${Date.now()}-${rand}-${hash}-${safe}`;

  const safeCompany = companyId.replace(/[/\\]/g, "");
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const storageKey = `${safeCompany}/training/${y}/${m}/${fileName}`;

  const absDir = path.join(uploadsTrainingRoot(), ...storageKey.split("/").slice(0, -1));
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(uploadsTrainingRoot(), ...storageKey.split("/")), buf);

  return { storageKey };
}

export async function deleteTrainingFile(storageKey: string): Promise<void> {
  if (!storageKey || storageKey.startsWith("http")) return; // skip URL-type
  try {
    const root = uploadsTrainingRoot();
    const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    const resolved = path.resolve(root, ...normalized.split("/"));
    if (resolved.startsWith(path.resolve(root))) await unlink(resolved);
  } catch {
    // ignore missing file
  }
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

export type TrainingMaterialRow = {
  id: string;
  title: string;
  description: string | null;
  type: TrainingMaterialType;
  fileUrl: string;
  fileName: string | null;
  roleScope: TrainingRoleScope;
  uploadedBy: string;
  uploaderName: string | null;
  createdAt: string;
};

function serialize(
  row: {
    id: string;
    title: string;
    description: string | null;
    type: TrainingMaterialType;
    fileUrl: string;
    fileName: string | null;
    roleScope: TrainingRoleScope;
    uploadedBy: string;
    uploader: { name: string | null };
    createdAt: Date;
  },
): TrainingMaterialRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    roleScope: row.roleScope,
    uploadedBy: row.uploadedBy,
    uploaderName: row.uploader.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTrainingMaterials(
  prisma: PrismaClient,
  companyId: string,
  role: SalesNetworkRole,
): Promise<TrainingMaterialRow[]> {
  const scopes = visibleScopesForRole(role);
  const rows = await prisma.internalTrainingMaterial.findMany({
    where: { companyId, roleScope: { in: scopes } },
    include: { uploader: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serialize);
}

export async function createTrainingMaterial(
  prisma: PrismaClient,
  data: {
    companyId: string;
    title: string;
    description: string | null;
    type: TrainingMaterialType;
    fileUrl: string;
    fileName: string | null;
    roleScope: TrainingRoleScope;
    uploadedBy: string;
  },
): Promise<TrainingMaterialRow> {
  const row = await prisma.internalTrainingMaterial.create({
    data,
    include: { uploader: { select: { name: true } } },
  });
  return serialize(row);
}

export async function deleteTrainingMaterial(
  prisma: PrismaClient,
  id: string,
  companyId: string,
): Promise<{ fileUrl: string } | null> {
  const row = await prisma.internalTrainingMaterial.findFirst({
    where: { id, companyId },
    select: { id: true, fileUrl: true },
  });
  if (!row) return null;
  await prisma.internalTrainingMaterial.delete({ where: { id } });
  return { fileUrl: row.fileUrl };
}
