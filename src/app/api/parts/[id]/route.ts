import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  quantityOnHand: z.number().int().nonnegative().optional(),
  reorderThreshold: z.number().int().nonnegative().optional(),
  location: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(
    "ADMIN",
    "SHOP_MANAGER",
    "PARTS_MANAGER",
    "TECHNICIAN",
    "FRONT_DESK"
  );
  if (error) return error;

  const { id } = await params;
  const part = await prisma.part.findUnique({ where: { id } });
  if (!part) return jsonError("Not found", 404);
  return NextResponse.json(part);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "PARTS_MANAGER");
  if (error) return error;

  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.part.findUnique({ where: { id } });
    if (!before) return jsonError("Not found", 404);

    const part = await prisma.part.update({ where: { id }, data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Part",
      entityId: id,
      action: "UPDATE",
      before,
      after: part,
    });
    return NextResponse.json(part);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "PARTS_MANAGER");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.part.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);

  await prisma.part.delete({ where: { id } });
  await writeAuditLog({
    userId: session!.user.id,
    entityType: "Part",
    entityId: id,
    action: "DELETE",
    before,
  });
  return NextResponse.json({ ok: true });
}
