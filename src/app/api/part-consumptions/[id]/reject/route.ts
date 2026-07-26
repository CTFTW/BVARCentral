import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const schema = z.object({ reason: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "PARTS_MANAGER");
  if (error) return error;

  const { id } = await params;
  try {
    const { reason } = schema.parse(await req.json().catch(() => ({})));

    const before = await prisma.partConsumption.findUnique({ where: { id } });
    if (!before) return jsonError("Not found", 404);
    if (before.status !== "PENDING") return jsonError("Already reviewed", 400);

    const updated = await prisma.partConsumption.update({
      where: { id },
      data: {
        status: "REJECTED",
        approverId: session!.user.id,
        rejectionReason: reason,
      },
    });

    await prisma.notification.create({
      data: {
        userId: before.techId,
        title: "Part consumption rejected",
        message: `Your request for ${before.skuEntered} x${before.quantity} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
      },
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "PartConsumption",
      entityId: id,
      action: "REJECT",
      before,
      after: updated,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
