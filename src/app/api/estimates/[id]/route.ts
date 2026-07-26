import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";
import { sendEstimateEmail } from "@/lib/mailer";
import { computeTimeEntryHours } from "@/lib/time-entries";
import { resolveShopRate } from "@/lib/billing";

const updateSchema = z.object({
  approvedNote: z.string().optional(),
  approve: z.boolean().optional(),
  sendToCustomer: z.boolean().optional(),
});

/**
 * Returns the estimate along with a real-time estimated-vs-actual variance
 * computed from approved/submitted TimeEntry hours and approved
 * PartConsumption/SpecialOrderItem records tied to the project's phases.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "TECHNICIAN", "PARTS_MANAGER");
  if (error) return error;

  const { id } = await params;
  const estimate = await prisma.projectEstimate.findUnique({
    where: { id },
    include: {
      lines: true,
      project: {
        include: {
          vehicle: { include: { customer: true } },
          phases: {
            include: {
              timeEntries: { where: { status: { in: ["SUBMITTED", "APPROVED", "BILLED"] } } },
              partConsumptions: { where: { status: "APPROVED" } },
            },
          },
          specialOrders: { include: { items: true } },
        },
      },
    },
  });
  if (!estimate) return jsonError("Not found", 404);

  const settings = await prisma.shopSettings.findUnique({ where: { id: "singleton" } });
  const shopRate = resolveShopRate(estimate.project.shopRateOverride, settings?.defaultShopRate);

  const estimatedLabor = estimate.lines
    .filter((l) => l.type === "LABOR")
    .reduce((sum, l) => sum + Number(l.estimatedQuantity) * Number(l.estimatedUnitCost), 0);
  const estimatedParts = estimate.lines
    .filter((l) => l.type !== "LABOR")
    .reduce((sum, l) => sum + Number(l.estimatedQuantity) * Number(l.estimatedUnitCost), 0);

  const actualHours = estimate.project.phases
    .flatMap((p) => p.timeEntries)
    .reduce((sum, e) => sum + computeTimeEntryHours(e), 0);
  const actualLaborCost = actualHours * shopRate;

  const actualParts = estimate.project.phases
    .flatMap((p) => p.partConsumptions)
    .reduce((sum, c) => sum + Number(c.sellingPriceLockedAt ?? c.overridePrice ?? 0) * c.quantity, 0);

  const actualSpecialOrders = estimate.project.specialOrders
    .flatMap((o) => o.items)
    .reduce((sum, i) => sum + Number(i.sellingPrice) * i.quantity, 0);

  const actualPartsAndSpecialOrders = actualParts + actualSpecialOrders;

  return NextResponse.json({
    estimate,
    variance: {
      shopRate,
      estimatedLabor,
      estimatedParts,
      estimatedTotal: estimatedLabor + estimatedParts,
      actualHours,
      actualLaborCost,
      actualPartsAndSpecialOrders,
      actualTotal: actualLaborCost + actualPartsAndSpecialOrders,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  try {
    const body = updateSchema.parse(await req.json());
    const before = await prisma.projectEstimate.findUnique({
      where: { id },
      include: { project: { include: { vehicle: { include: { customer: true } } } } },
    });
    if (!before) return jsonError("Not found", 404);

    const estimate = await prisma.projectEstimate.update({
      where: { id },
      data: {
        approvedNote: body.approvedNote,
        approvedAt: body.approve ? new Date() : undefined,
      },
    });

    if (body.sendToCustomer && before.project.vehicle.customer.email) {
      await sendEstimateEmail(
        before.project.vehicle.customer.email,
        before.project.name,
        `${process.env.NEXTAUTH_URL}/portal/estimates/${id}`
      );
    }

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "ProjectEstimate",
      entityId: id,
      action: "UPDATE",
      before,
      after: estimate,
    });
    return NextResponse.json(estimate);
  } catch (err) {
    return handleApiError(err);
  }
}
