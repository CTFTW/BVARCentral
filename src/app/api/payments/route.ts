import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, jsonError, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["CASH", "CHECK", "CARD", "ACH", "OTHER"]),
  reference: z.string().optional(),
  paidAt: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("invoiceId") ?? undefined;
  const customerId = searchParams.get("customerId") ?? undefined;

  const payments = await prisma.payment.findMany({
    where: { ...(invoiceId ? { invoiceId } : {}), ...(customerId ? { customerId } : {}) },
    orderBy: { paidAt: "desc" },
  });
  return NextResponse.json(payments);
}

// Partial payments are allowed; invoice status is derived from total paid.
export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());

    const payment = await prisma.$transaction(async (tx) => {
      // Lock the invoice row for the duration of this transaction so
      // concurrent payments against the same invoice are serialized instead
      // of both computing "total paid" from a stale pre-insert snapshot
      // (which could leave the invoice under-marked as PARTIALLY_PAID).
      const locked = await tx.$queryRaw<
        { id: string; total: Prisma.Decimal; status: InvoiceStatus; customerId: string }[]
      >`
        SELECT id, total, status, "customerId" FROM "Invoice" WHERE id = ${body.invoiceId} FOR UPDATE
      `;
      const invoice = locked[0];
      if (!invoice) throw new Error("NOT_FOUND");

      const created = await tx.payment.create({
        data: {
          invoiceId: body.invoiceId,
          customerId: invoice.customerId,
          amount: body.amount,
          method: body.method,
          reference: body.reference,
          paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
        },
      });

      const aggregate = await tx.payment.aggregate({
        where: { invoiceId: body.invoiceId },
        _sum: { amount: true },
      });
      const totalPaid = Number(aggregate._sum.amount ?? 0);
      const status = totalPaid >= Number(invoice.total) ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : invoice.status;

      await tx.invoice.update({ where: { id: body.invoiceId }, data: { status } });

      return created;
    });

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Payment",
      entityId: payment.id,
      action: "CREATE",
      after: payment,
    });
    return NextResponse.json(payment, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") return jsonError("Invoice not found", 404);
    return handleApiError(err);
  }
}
