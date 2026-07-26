import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  sequence: z.number().int().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"]).optional(),
  assignedTechId: z.string().optional(),
  estimatedHours: z.number().nonnegative().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const assignedTechId = searchParams.get("assignedTechId") ?? undefined;

  // Require a scoping filter so this can't be called unfiltered and return
  // every phase (with nested project/vehicle/tech includes) in the system.
  if (!projectId && !assignedTechId) {
    return jsonError("projectId or assignedTechId query parameter is required", 400);
  }

  const phases = await prisma.jobPhase.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(assignedTechId ? { assignedTechId } : {}),
    },
    include: { project: { include: { vehicle: true } }, assignedTech: true },
    orderBy: { sequence: "asc" },
  });
  return NextResponse.json(phases);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const phase = await prisma.jobPhase.create({ data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "JobPhase",
      entityId: phase.id,
      action: "CREATE",
      after: phase,
    });
    return NextResponse.json(phase, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
