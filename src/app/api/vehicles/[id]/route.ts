import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  year: z.number().int().optional(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  vin: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { projects: { include: { phases: true } }, customer: true },
  });
  if (!vehicle) return jsonError("Not found", 404);
  return NextResponse.json(vehicle);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.vehicle.findUnique({ where: { id } });
    if (!before) return jsonError("Not found", 404);

    const vehicle = await prisma.vehicle.update({ where: { id }, data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Vehicle",
      entityId: id,
      action: "UPDATE",
      before,
      after: vehicle,
    });
    return NextResponse.json(vehicle);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.vehicle.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);

  await prisma.vehicle.delete({ where: { id } });
  await writeAuditLog({
    userId: session!.user.id,
    entityType: "Vehicle",
    entityId: id,
    action: "DELETE",
    before,
  });
  return NextResponse.json({ ok: true });
}
