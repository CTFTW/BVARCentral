import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, parsePagination, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  projectId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  // Require a project scope; an unfiltered call would otherwise return
  // every billing cycle with a 3-level nested include.
  if (!projectId) return jsonError("projectId query parameter is required", 400);

  const { take, skip } = parsePagination(searchParams);
  const cycles = await prisma.billingCycle.findMany({
    where: { projectId },
    include: { invoice: true, project: { include: { vehicle: { include: { customer: true } } } } },
    orderBy: { startDate: "desc" },
    take,
    skip,
  });
  return NextResponse.json(cycles);
}

/**
 * Opens a new billing cycle for a project. Attaches any as-yet-unbilled
 * approved TimeEntry / PartConsumption / SpecialOrderItem records dated
 * within the window to this cycle so invoice generation has a fixed,
 * explicit set of billable records ("Time-entry validate per billing
 * cycle on invoice generation" + "explicit join contract" risk mitigation).
 */
export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    const cycle = await prisma.$transaction(async (tx) => {
      const created = await tx.billingCycle.create({
        data: { projectId: body.projectId, startDate, endDate },
      });

      const phases = await tx.jobPhase.findMany({ where: { projectId: body.projectId }, select: { id: true } });
      const phaseIds = phases.map((p) => p.id);

      await tx.timeEntry.updateMany({
        where: {
          jobPhaseId: { in: phaseIds },
          status: { in: ["SUBMITTED", "APPROVED"] },
          billingCycleId: null,
          OR: [
            { endTime: { gte: startDate, lte: endDate } },
            { workDate: { gte: startDate, lte: endDate } },
          ],
        },
        data: { billingCycleId: created.id, status: "APPROVED" },
      });

      await tx.partConsumption.updateMany({
        where: {
          jobPhaseId: { in: phaseIds },
          status: "APPROVED",
          billingCycleId: null,
          createdAt: { gte: startDate, lte: endDate },
        },
        data: { billingCycleId: created.id },
      });

      await tx.specialOrderItem.updateMany({
        where: {
          billingCycleId: null,
          specialOrder: { projectId: body.projectId, status: "DELIVERED" },
          createdAt: { gte: startDate, lte: endDate },
        },
        data: { billingCycleId: created.id },
      });

      return created;
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "BillingCycle",
      entityId: cycle.id,
      action: "CREATE",
      after: cycle,
    });
    return NextResponse.json(cycle, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
