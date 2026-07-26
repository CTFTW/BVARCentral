import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, parsePagination, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  jobPhaseId: z.string().min(1),
  skuEntered: z.string().min(1),
  quantity: z.number().int().positive(),
});

export async function GET(req: Request) {
  const { session, error } = await requireRole(
    "ADMIN",
    "SHOP_MANAGER",
    "PARTS_MANAGER",
    "TECHNICIAN"
  );
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const jobPhaseId = searchParams.get("jobPhaseId") ?? undefined;
  const pendingApproval = searchParams.get("pendingApproval");

  const techId = session!.user.role === "TECHNICIAN" ? session!.user.id : undefined;

  const { take, skip } = parsePagination(searchParams);
  const consumptions = await prisma.partConsumption.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(jobPhaseId ? { jobPhaseId } : {}),
      ...(techId ? { techId } : {}),
      ...(pendingApproval === "true" ? { status: "PENDING", requiresApproval: true } : {}),
    },
    include: { part: true, jobPhase: { include: { project: true } }, tech: true },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
  return NextResponse.json(consumptions);
}

/**
 * Tech creates a consumption by scanning/entering a SKU + quantity for a
 * phase they're working on. Business rule (see plan "Parts consumption"):
 *   - Known SKU with sufficient stock  -> auto-approved immediately,
 *     inventory deducted, sellingPrice locked in at time of consumption.
 *   - Unknown SKU or insufficient stock -> left Pending and flagged for
 *     Shop/Parts Manager approval; no inventory change until approved.
 */
export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "TECHNICIAN");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const techId = session!.user.id;

    const result = await prisma.$transaction(async (tx) => {
      const part = await tx.part.findUnique({ where: { sku: body.skuEntered } });

      if (part) {
        // Atomic conditional decrement: only succeeds if quantityOnHand is
        // still >= the requested quantity at the moment of the write, which
        // prevents two concurrent requests from both passing a separate
        // read-then-write stock check and overdrawing inventory.
        const decremented = await tx.part.updateMany({
          where: { id: part.id, quantityOnHand: { gte: body.quantity } },
          data: { quantityOnHand: { decrement: body.quantity } },
        });

        if (decremented.count > 0) {
          return tx.partConsumption.create({
            data: {
              jobPhaseId: body.jobPhaseId,
              partId: part.id,
              skuEntered: body.skuEntered,
              quantity: body.quantity,
              techId,
              status: "APPROVED",
              requiresApproval: false,
              sellingPriceLockedAt: part.sellingPrice,
            },
          });
        }
      }

      return tx.partConsumption.create({
        data: {
          jobPhaseId: body.jobPhaseId,
          partId: part?.id,
          skuEntered: body.skuEntered,
          quantity: body.quantity,
          techId,
          status: "PENDING",
          requiresApproval: true,
        },
      });
    });

    await writeAuditLog({
      userId: techId,
      entityType: "PartConsumption",
      entityId: result.id,
      action: "CREATE",
      after: result,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
