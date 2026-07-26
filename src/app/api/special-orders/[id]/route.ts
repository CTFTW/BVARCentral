import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const updateSchema = z.object({
  status: z
    .enum(["REQUESTED", "PO_SENT", "DELIVERED", "TRANSFERRED_TO_INVENTORY", "RETURNED", "CANCELLED"])
    .optional(),
  poNumber: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "PARTS_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  const order = await prisma.specialOrder.findUnique({
    where: { id },
    include: { items: true, project: { include: { vehicle: true } } },
  });
  if (!order) return jsonError("Not found", 404);
  return NextResponse.json(order);
}

/**
 * Drives the special-order lifecycle: creation -> PO sent -> delivery
 * confirmation -> transfer to inventory or return. Transferring to
 * inventory upserts/increments matching Part records by SKU-less item
 * (parts manager links a Part when creating, or one can be created here).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "PARTS_MANAGER");
  if (error) return error;

  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.specialOrder.findUnique({ where: { id }, include: { items: true } });
    if (!before) return jsonError("Not found", 404);

    // Transferring to inventory or returning are terminal, one-time actions
    // that must follow a DELIVERED order; without this guard a retried or
    // duplicate PATCH would double-credit inventory.
    if (
      (body.status === "TRANSFERRED_TO_INVENTORY" || body.status === "RETURNED") &&
      before.status !== "DELIVERED"
    ) {
      return jsonError(`Cannot transition to ${body.status} from ${before.status}; order must be DELIVERED first`, 400);
    }

    const order = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = { ...body };
      if (body.status === "PO_SENT" && !before.orderedAt) data.orderedAt = new Date();
      if (body.status === "DELIVERED") data.deliveredAt = new Date();

      // Guard the transition itself against a concurrent duplicate request
      // by only updating if the order is still in the expected prior state.
      const statusUpdated = await tx.specialOrder.updateMany({
        where: { id, status: before.status },
        data,
      });
      if (statusUpdated.count === 0) throw new Error("STALE_STATUS");

      if (body.status === "TRANSFERRED_TO_INVENTORY") {
        for (const item of before.items) {
          if (item.partId) {
            await tx.part.update({
              where: { id: item.partId },
              data: { quantityOnHand: { increment: item.quantity } },
            });
          }
        }
      }

      return tx.specialOrder.findUniqueOrThrow({ where: { id } });
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "SpecialOrder",
      entityId: id,
      action: "UPDATE",
      before,
      after: order,
    });
    return NextResponse.json(order);
  } catch (err) {
    if (err instanceof Error && err.message === "STALE_STATUS") {
      return jsonError("Order status changed concurrently; please retry", 409);
    }
    return handleApiError(err);
  }
}
