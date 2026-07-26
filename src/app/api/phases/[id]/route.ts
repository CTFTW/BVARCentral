import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  sequence: z.number().int().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"]).optional(),
  assignedTechId: z.string().nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { id } = await params;
  const phase = await prisma.jobPhase.findUnique({
    where: { id },
    include: {
      project: { include: { vehicle: { include: { customer: true } } } },
      assignedTech: true,
      timeEntries: true,
      partConsumptions: true,
    },
  });
  if (!phase) return jsonError("Not found", 404);
  return NextResponse.json(phase);
}

// Shop Manager can update any field. Technicians may only update status
// (e.g. marking blocked/completed) on phases assigned to them.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.jobPhase.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);

  try {
    const body = updateSchema.parse(await req.json());

    if (session!.user.role === "TECHNICIAN") {
      if (before.assignedTechId !== session!.user.id) {
        return jsonError("Forbidden: phase not assigned to you", 403);
      }
      const allowedKeys = new Set(["status"]);
      const requestedKeys = Object.keys(body);
      if (requestedKeys.some((k) => !allowedKeys.has(k))) {
        return jsonError("Technicians may only update phase status", 403);
      }
    }

    const phase = await prisma.jobPhase.update({ where: { id }, data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "JobPhase",
      entityId: id,
      action: "UPDATE",
      before,
      after: phase,
    });
    return NextResponse.json(phase);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.jobPhase.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);

  await prisma.jobPhase.delete({ where: { id } });
  await writeAuditLog({
    userId: session!.user.id,
    entityType: "JobPhase",
    entityId: id,
    action: "DELETE",
    before,
  });
  return NextResponse.json({ ok: true });
}
