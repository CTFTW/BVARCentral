import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  estimatedQuantity: z.number().positive().optional(),
  estimatedUnitCost: z.number().nonnegative().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { lineId } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.estimateLine.findUnique({ where: { id: lineId } });
    if (!before) return jsonError("Not found", 404);

    const line = await prisma.estimateLine.update({ where: { id: lineId }, data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "EstimateLine",
      entityId: lineId,
      action: "UPDATE",
      before,
      after: line,
    });
    return NextResponse.json(line);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { lineId } = await params;
  const before = await prisma.estimateLine.findUnique({ where: { id: lineId } });
  if (!before) return jsonError("Not found", 404);

  await prisma.estimateLine.delete({ where: { id: lineId } });
  await writeAuditLog({
    userId: session!.user.id,
    entityType: "EstimateLine",
    entityId: lineId,
    action: "DELETE",
    before,
  });
  return NextResponse.json({ ok: true });
}
