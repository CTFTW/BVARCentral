import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, parsePagination, writeAuditLog } from "@/lib/api-utils";

const manualEntrySchema = z.object({
  jobPhaseId: z.string().min(1),
  workDate: z.string().datetime(),
  manualHours: z.number().positive(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const { session, error } = await requireRole(
    "ADMIN",
    "SHOP_MANAGER",
    "TECHNICIAN",
    "FRONT_DESK"
  );
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const jobPhaseId = searchParams.get("jobPhaseId") ?? undefined;
  const techId = searchParams.get("techId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  // Technicians can only view their own entries.
  const effectiveTechId = session!.user.role === "TECHNICIAN" ? session!.user.id : techId;

  const { take, skip } = parsePagination(searchParams);
  const entries = await prisma.timeEntry.findMany({
    where: {
      ...(jobPhaseId ? { jobPhaseId } : {}),
      ...(effectiveTechId ? { techId: effectiveTechId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: { jobPhase: { include: { project: true } }, tech: true },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
  return NextResponse.json(entries);
}

// Manual (non-timer) time entry creation.
export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "TECHNICIAN");
  if (error) return error;

  try {
    const body = manualEntrySchema.parse(await req.json());
    const entry = await prisma.timeEntry.create({
      data: {
        jobPhaseId: body.jobPhaseId,
        techId: session!.user.id,
        workDate: new Date(body.workDate),
        manualHours: body.manualHours,
        notes: body.notes,
        status: "SUBMITTED",
      },
    });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "TimeEntry",
      entityId: entry.id,
      action: "CREATE_MANUAL",
      after: entry,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
