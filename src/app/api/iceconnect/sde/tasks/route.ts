import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["TECH_EXECUTIVE", "TECH_HEAD", "ADMIN"]);

type TaskItem = {
  id: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  deadline: string | null;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";
};

function toPriority(value: number): TaskItem["priority"] {
  if (value >= 7) return "HIGH";
  if (value >= 3) return "MEDIUM";
  return "LOW";
}

function toStatus(status: string): TaskItem["status"] {
  const s = status.toUpperCase();
  if (s === "IN_PROGRESS") return "IN_PROGRESS";
  if (s === "DONE" || s === "COMPLETED") return "DONE";
  if (s === "BLOCKED") return "BLOCKED";
  return "PENDING";
}

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId: session.sub,
      companyId: session.companyId ?? undefined,
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 30,
    select: {
      id: true,
      title: true,
      priority: true,
      dueDate: true,
      status: true,
    },
  });

  const payload: TaskItem[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    priority: toPriority(task.priority),
    deadline: task.dueDate ? task.dueDate.toISOString() : null,
    status: toStatus(task.status),
  }));

  return NextResponse.json({ tasks: payload });
}
