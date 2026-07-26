import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { jsonError } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole(
    "ADMIN",
    "SHOP_MANAGER",
    "FRONT_DESK",
    "CUSTOMER"
  );
  if (error) return error;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lineItems: true,
      payments: true,
      customer: true,
      billingCycle: { include: { project: { include: { vehicle: true } } } },
    },
  });
  if (!invoice) return jsonError("Not found", 404);

  if (session!.user.role === "CUSTOMER") {
    const customer = await prisma.customer.findUnique({ where: { userId: session!.user.id } });
    if (!customer || customer.id !== invoice.customerId) return jsonError("Forbidden", 403);
  }

  return NextResponse.json(invoice);
}
