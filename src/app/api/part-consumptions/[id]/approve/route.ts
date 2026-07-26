import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const schema = z.object({
  overridePrice: z.number().nonnegative().optional(),
  // Allows approving against a different/newly-created part record when
  // the original SKU entered was unknown.
  partId: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "PARTS_MANAGER");
  if (error) return error;

  const { id } = await params;

  try {
    const body = schema.parse(await req.json().catch(() => ({})));

    const updated = await prisma.$transaction(async (tx) => {
      const consumption = await tx.partConsumption.findUnique({ where: { id } });
      if (!consumption) throw new Error("NOT_FOUND");
      if (consumption.status !== "PENDING") throw new Error("ALREADY_REVIEWED");

      const partId = body.partId ?? consumption.partId;
      if (!partId) throw new Error("NO_PART");

      const part = await tx.part.findUnique({ where: { id: partId } });
      if (!part) throw new Error("NO_PART");

      // Atomic conditional decrement, guarded by the current stock level at
      // write time rather than a separate earlier read, so two concurrent
      // approvals against the same part can't both succeed and overdraw.
      const decremented = await tx.part.updateMany({
        where: { id: part.id, quantityOnHand: { gte: consumption.quantity } },
        data: { quantityOnHand: { decrement: consumption.quantity } },
      });
      if (decremented.count === 0) throw new Error("INSUFFICIENT_STOCK");

      // Also guard the status transition itself against a concurrent
      // approve/reject racing this one.
      const statusUpdated = await tx.partConsumption.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: "APPROVED",
          partId: part.id,
          approverId: session!.user.id,
          sellingPriceLockedAt: body.overridePrice ?? part.sellingPrice,
          overridePrice: body.overridePrice,
        },
      });
      if (statusUpdated.count === 0) throw new Error("ALREADY_REVIEWED");

      return tx.partConsumption.findUniqueOrThrow({ where: { id } });
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "PartConsumption",
      entityId: id,
      action: "APPROVE",
      after: updated,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return jsonError("Not found", 404);
      if (err.message === "ALREADY_REVIEWED") return jsonError("Already reviewed", 400);
      if (err.message === "NO_PART") return jsonError("A valid inventory part must be linked before approval", 400);
      if (err.message === "INSUFFICIENT_STOCK") return jsonError("Insufficient stock to approve", 400);
    }
    return handleApiError(err);
  }
}
