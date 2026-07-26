import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(["ESTIMATE", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  shopRateOverride: z.number().positive().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  targetEndDate: z.string().datetime().nullable().optional(),
  actualEndDate: z.string().datetime().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      vehicle: { include: { customer: true } },
      phases: { orderBy: { sequence: "asc" }, include: { assignedTech: true } },
      estimate: { include: { lines: true } },
      billingCycles: true,
      specialOrders: { include: { items: true } },
    },
  });
  if (!project) return jsonError("Not found", 404);
  return NextResponse.json(project);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.project.findUnique({ where: { id } });
    if (!before) return jsonError("Not found", 404);

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
        targetEndDate:
          body.targetEndDate !== undefined ? (body.targetEndDate ? new Date(body.targetEndDate) : null) : undefined,
        actualEndDate:
          body.actualEndDate !== undefined ? (body.actualEndDate ? new Date(body.actualEndDate) : null) : undefined,
      },
    });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Project",
      entityId: id,
      action: "UPDATE",
      before,
      after: project,
    });
    return NextResponse.json(project);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.project.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);

  await prisma.project.delete({ where: { id } });
  await writeAuditLog({
    userId: session!.user.id,
    entityType: "Project",
    entityId: id,
    action: "DELETE",
    before,
  });
  return NextResponse.json({ ok: true });
}
