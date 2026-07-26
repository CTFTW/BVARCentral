import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { vehicles: { include: { projects: true } }, invoices: true },
  });
  if (!customer) return jsonError("Not found", 404);
  return NextResponse.json(customer);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.customer.findUnique({ where: { id } });
    if (!before) return jsonError("Not found", 404);

    const customer = await prisma.customer.update({ where: { id }, data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Customer",
      entityId: id,
      action: "UPDATE",
      before,
      after: customer,
    });
    return NextResponse.json(customer);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER");
  if (error) return error;

  const { id } = await params;
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) return jsonError("Not found", 404);

  await prisma.customer.delete({ where: { id } });
  await writeAuditLog({
    userId: session!.user.id,
    entityType: "Customer",
    entityId: id,
    action: "DELETE",
    before,
  });
  return NextResponse.json({ ok: true });
}
