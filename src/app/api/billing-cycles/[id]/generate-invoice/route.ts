import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";
import { computeTimeEntryHours } from "@/lib/time-entries";

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
      const shopRate = Number(cycle.project.shopRateOverride ?? settings?.defaultShopRate ?? 95);

      const lines: {
        type: "LABOR" | "PART" | "SPECIAL_ORDER" | "DEPOSIT";
        description: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        jobPhaseId?: string;
      }[] = [];

      for (const entry of cycle.timeEntries) {
        const hours = computeTimeEntryHours(entry);
        if (hours <= 0) continue;
        lines.push({
          type: "LABOR",
          description: `Labor - ${entry.jobPhase.name}`,
          quantity: hours,
          unitPrice: shopRate,
          lineTotal: hours * shopRate,
          jobPhaseId: entry.jobPhaseId,
        });
      }

      for (const c of cycle.partConsumptions) {
        const unitPrice = Number(c.overridePrice ?? c.sellingPriceLockedAt ?? c.part?.sellingPrice ?? 0);
        lines.push({
          type: "PART",
          description: `Part - ${c.part?.description ?? c.skuEntered}`,
          quantity: c.quantity,
          unitPrice,
          lineTotal: unitPrice * c.quantity,
          jobPhaseId: c.jobPhaseId,
        });
      }

      for (const item of cycle.specialOrderItems) {
        lines.push({
          type: "SPECIAL_ORDER",
          description: `Special Order - ${item.description} (${item.specialOrder.vendorName})`,
          quantity: item.quantity,
          unitPrice: Number(item.sellingPrice),
          lineTotal: Number(item.sellingPrice) * item.quantity,
        });
      }

      const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
      const depositApplied = body.depositApplied ?? 0;
      const total = subtotal - depositApplied;

      // Atomically increment a dedicated counter instead of COUNT(*)-ing the
      // Invoice table, avoiding a full-table scan inside this transaction
      // and a race between concurrent invoice generations.
      const nextSequence = await tx.shopSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", invoiceSequence: 1 },
        update: { invoiceSequence: { increment: 1 } },
        select: { invoiceSequence: true },
      });
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(nextSequence.invoiceSequence).padStart(5, "0")}`;

      const created = await tx.invoice.create({
        data: {
          billingCycleId: cycle.id,
          customerId: cycle.project.vehicle.customer!.id,
          invoiceNumber,
          status: "DRAFT",
          subtotal,
          depositApplied,
          total,
          lineItems: {
            create: [
              ...lines,
              ...(depositApplied > 0
                ? [
                    {
                      type: "DEPOSIT" as const,
                      description: "Deposit applied",
                      quantity: 1,
                      unitPrice: -depositApplied,
                      lineTotal: -depositApplied,
                    },
                  ]
                : []),
            ],
          },
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
