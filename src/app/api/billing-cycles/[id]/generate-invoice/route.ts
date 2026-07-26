import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";
import {
  buildLaborLines,
  buildPartLines,
  buildSpecialOrderLines,
  computeInvoiceTotals,
  formatInvoiceNumber,
  resolveShopRate,
} from "@/lib/billing";

const schema = z.object({
  depositApplied: z.number().nonnegative().optional(),
});

/**
 * Generates an Invoice from a BillingCycle:
 *   total = (chargeable hours x applicable shop rate)
 *         + approved PartConsumption in cycle (at sellingPriceLockedAt/override)
 *         + approved SpecialOrder items delivered in cycle
 *         - depositApplied
 *
 * Chargeable hours use the project's shopRateOverride if set, otherwise the
 * shop-wide ShopSettings.defaultShopRate ("Global default with per-project
 * override; rate applied at billing time").
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  try {
    const body = schema.parse(await req.json().catch(() => ({})));

    const invoice = await prisma.$transaction(async (tx) => {
      const cycle = await tx.billingCycle.findUnique({
        where: { id },
        include: {
          invoice: true,
          project: { include: { vehicle: { include: { customer: true } } } },
          timeEntries: { include: { jobPhase: true } },
          partConsumptions: { include: { part: true, jobPhase: true } },
          specialOrderItems: { include: { specialOrder: true } },
        },
      });
      if (!cycle) throw new Error("NOT_FOUND");
      if (cycle.invoiced || cycle.invoice) throw new Error("ALREADY_INVOICED");
      if (!cycle.project.vehicle.customer) throw new Error("NO_CUSTOMER");

      const settings = await tx.shopSettings.findUnique({ where: { id: "singleton" } });
      const shopRate = resolveShopRate(cycle.project.shopRateOverride, settings?.defaultShopRate);

      const lines = [
        ...buildLaborLines(cycle.timeEntries, shopRate),
        ...buildPartLines(cycle.partConsumptions),
        ...buildSpecialOrderLines(cycle.specialOrderItems),
      ];

      const depositApplied = body.depositApplied ?? 0;
      const { subtotal, total, lines: lineItemsToCreate } = computeInvoiceTotals(lines, depositApplied);

      // Atomically increment a dedicated counter instead of COUNT(*)-ing the
      // Invoice table, avoiding a full-table scan inside this transaction
      // and a race between concurrent invoice generations.
      const nextSequence = await tx.shopSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", invoiceSequence: 1 },
        update: { invoiceSequence: { increment: 1 } },
        select: { invoiceSequence: true },
      });
      const invoiceNumber = formatInvoiceNumber(new Date().getFullYear(), nextSequence.invoiceSequence);

      const created = await tx.invoice.create({
        data: {
          billingCycleId: cycle.id,
          customerId: cycle.project.vehicle.customer!.id,
          invoiceNumber,
          status: "DRAFT",
          subtotal,
          depositApplied,
          total,
          lineItems: { create: lineItemsToCreate },
        },
        include: { lineItems: true },
      });

      await tx.billingCycle.update({ where: { id: cycle.id }, data: { invoiced: true } });
      await tx.timeEntry.updateMany({
        where: { billingCycleId: cycle.id },
        data: { status: "BILLED" },
      });

      return created;
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Invoice",
      entityId: invoice.id,
      action: "GENERATE",
      after: invoice,
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") return jsonError("Billing cycle not found", 404);
      if (err.message === "ALREADY_INVOICED") return jsonError("Billing cycle already invoiced", 400);
      if (err.message === "NO_CUSTOMER") return jsonError("Project's vehicle has no linked customer", 400);
    }
    return handleApiError(err);
  }
}
