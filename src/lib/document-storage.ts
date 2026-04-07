import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Max upload size (bytes). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/x-png",
]);

const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

export function uploadsDocumentsRoot() {
  return path.join(process.cwd(), "uploads", "documents");
}

export function assertAllowedDocumentFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!(file instanceof File) || file.size <= 0) {
    return { ok: false, error: "Choose a valid file" };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `File too large (max ${Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB)`,
    };
  }
  const name = file.name?.trim() || "";
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, error: "Only PDF, JPG, and PNG files are allowed" };
  }
  const mime = (file.type || "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (mime && !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: "Only PDF, JPG, and PNG files are allowed" };
  }
  return { ok: true };
}

function safeBasename(original: string): string {
  const base = path.basename(original).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const trimmed = base.slice(0, 120);
  return trimmed || "file";
}

/**
 * Returns relative path segments: `{companyId}/{random}-{hash6}-{safeName}` under uploads/documents.
 */
export async function saveCompanyDocument(
  companyId: string,
  file: File,
): Promise<{ relativePath: string; storedBytes: number }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 10);
  const rand = randomBytes(6).toString("hex");
  const safe = safeBasename(file.name);
  const fileName = `${Date.now()}-${rand}-${hash}-${safe}`;

  const dir = path.join(uploadsDocumentsRoot(), companyId);
  await mkdir(dir, { recursive: true });

  const abs = path.join(dir, fileName);
  await writeFile(abs, buf);

  return {
    relativePath: `${companyId.replace(/[/\\]/g, "")}/${fileName}`,
    storedBytes: buf.length,
  };
}

export function absoluteDocumentPath(relativePath: string): string {
  const root = uploadsDocumentsRoot();
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("..") ||
    normalized.split("/").some((p) => p === "" || p === "." || p === "..")
  ) {
    throw new Error("Invalid storage path");
  }
  const resolved = path.resolve(root, ...normalized.split("/"));
  if (!resolved.startsWith(path.resolve(root))) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export async function deleteStoredDocumentFile(relativePath: string): Promise<void> {
  try {
    await unlink(absoluteDocumentPath(relativePath));
  } catch {
    // ignore missing file
  }
}

export function mimeForDocumentFileName(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}
