import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { jsonError, writeAuditLog } from "@/lib/api-utils";
import { sendInvoiceEmail } from "@/lib/mailer";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { customer: true } });
  if (!invoice) return jsonError("Not found", 404);

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });

  if (invoice.customer.email) {
    await sendInvoiceEmail(
      invoice.customer.email,
      invoice.invoiceNumber,
      `${process.env.NEXTAUTH_URL}/portal/invoices/${id}`
    );
  }
  if (invoice.customer.userId) {
    await prisma.notification.create({
      data: {
        userId: invoice.customer.userId,
        title: "New invoice",
        message: `Invoice ${invoice.invoiceNumber} is ready for your review.`,
        link: `/portal/invoices/${id}`,
      },
    });
  }

  await writeAuditLog({
    userId: session!.user.id,
    entityType: "Invoice",
    entityId: id,
    action: "SEND",
    before: invoice,
    after: updated,
  });
  return NextResponse.json(updated);
}
