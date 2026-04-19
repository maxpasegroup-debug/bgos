/**
 * GET  /api/internal/training  — list materials scoped to caller's role
 * POST /api/internal/training  — upload new material (RSM / BOSS only)
 *
 * POST accepts multipart/form-data:
 *   file        — File (PDF/DOC/SCRIPT); omit for VIDEO type
 *   title       — string (required)
 *   description — string (optional)
 *   type        — "PDF" | "VIDEO" | "SCRIPT"
 *   role_scope  — "ALL" | "BDE" | "BDM" | "RSM"
 *   url         — string (required when type = VIDEO)
 */

import { NextResponse } from "next/server";
import { TrainingMaterialType, TrainingRoleScope } from "@prisma/client";
import { logCaughtError } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";
import { prisma } from "@/lib/prisma";
import {
  listTrainingMaterials,
  createTrainingMaterial,
  canUpload,
  assertAllowedTrainingFile,
  saveTrainingFile,
  deleteTrainingFile,
} from "@/lib/internal-training";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — list
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    const items = await listTrainingMaterials(prisma, session.companyId, session.salesNetworkRole);
    return NextResponse.json({ ok: true as const, items });
  } catch (e) {
    logCaughtError("internal-training-list", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to load materials", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — upload
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const user = requireAuth(request);
    if (user instanceof NextResponse) return user;

    const session = await requireInternalSalesSession(user);
    if (session instanceof NextResponse) return session;

    if (!canUpload(session.salesNetworkRole)) {
      return NextResponse.json(
        { ok: false as const, error: "Only RSM and BOSS can upload materials.", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false as const, error: "Invalid form data.", code: "BAD_REQUEST" as const },
        { status: 400 },
      );
    }

    const title = (form.get("title") as string | null)?.trim() ?? "";
    if (!title || title.length < 2) {
      return NextResponse.json(
        { ok: false as const, error: "Title is required (min 2 chars).", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    const description = (form.get("description") as string | null)?.trim() || null;
    const rawType = (form.get("type") as string | null)?.toUpperCase();
    const rawScope = (form.get("role_scope") as string | null)?.toUpperCase() ?? "ALL";

    if (!rawType || !Object.values(TrainingMaterialType).includes(rawType as TrainingMaterialType)) {
      return NextResponse.json(
        { ok: false as const, error: "type must be PDF, VIDEO, or SCRIPT.", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    if (!Object.values(TrainingRoleScope).includes(rawScope as TrainingRoleScope)) {
      return NextResponse.json(
        { ok: false as const, error: "role_scope must be ALL, BDE, BDM, or RSM.", code: "VALIDATION" as const },
        { status: 400 },
      );
    }

    const type = rawType as TrainingMaterialType;
    const roleScope = rawScope as TrainingRoleScope;

    let fileUrl: string;
    let fileName: string | null = null;

    if (type === TrainingMaterialType.VIDEO) {
      const url = (form.get("url") as string | null)?.trim() ?? "";
      if (!url || !url.startsWith("http")) {
        return NextResponse.json(
          { ok: false as const, error: "Provide a valid URL for VIDEO type.", code: "VALIDATION" as const },
          { status: 400 },
        );
      }
      fileUrl = url;
    } else {
      const fileRaw = form.get("file");
      if (!(fileRaw instanceof File)) {
        return NextResponse.json(
          { ok: false as const, error: "file is required for PDF and SCRIPT types.", code: "VALIDATION" as const },
          { status: 400 },
        );
      }
      const check = assertAllowedTrainingFile(fileRaw);
      if (!check.ok) {
        return NextResponse.json(
          { ok: false as const, error: check.error, code: "VALIDATION" as const },
          { status: 400 },
        );
      }
      let stored: { storageKey: string };
      try {
        stored = await saveTrainingFile(session.companyId, fileRaw);
      } catch {
        return NextResponse.json(
          { ok: false as const, error: "Could not save file.", code: "STORAGE" as const },
          { status: 500 },
        );
      }
      fileUrl = stored.storageKey;
      fileName = fileRaw.name?.trim() || null;
    }

    try {
      const material = await createTrainingMaterial(prisma, {
        companyId: session.companyId,
        title,
        description,
        type,
        fileUrl,
        fileName,
        roleScope,
        uploadedBy: session.userId,
      });
      return NextResponse.json({ ok: true as const, material }, { status: 201 });
    } catch {
      if (type !== TrainingMaterialType.VIDEO) await deleteTrainingFile(fileUrl);
      return NextResponse.json(
        { ok: false as const, error: "Could not save record.", code: "DB_ERROR" as const },
        { status: 500 },
      );
    }
  } catch (e) {
    logCaughtError("internal-training-upload", e);
    return NextResponse.json(
      { ok: false as const, error: "Upload failed", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
