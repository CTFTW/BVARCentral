import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, writeAuditLog } from "@/lib/api-utils";
import { sendPurchaseOrderEmail } from "@/lib/mailer";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  partId: z.string().optional(),
});

const createSchema = z.object({
  projectId: z.string().min(1),
  vendorName: z.string().min(1),
  vendorEmail: z.string().email().optional(),
  poNumber: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "PARTS_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const orders = await prisma.specialOrder.findMany({
    where: { ...(projectId ? { projectId } : {}), ...(status ? { status: status as never } : {}) },
    include: { items: true, project: { include: { vehicle: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "PARTS_MANAGER");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const order = await prisma.specialOrder.create({
      data: {
        projectId: body.projectId,
        vendorName: body.vendorName,
        poNumber: body.poNumber,
        status: body.poNumber ? "PO_SENT" : "REQUESTED",
        orderedAt: body.poNumber ? new Date() : undefined,
        items: { create: body.items },
      },
      include: { items: true },
    });

    if (order.status === "PO_SENT" && body.vendorEmail) {
      await sendPurchaseOrderEmail(body.vendorEmail, order.poNumber ?? order.id, order.vendorName);
    }

    await writeAuditLog({
      userId: session!.user.id,
      entityType: "SpecialOrder",
      entityId: order.id,
      action: "CREATE",
      after: order,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
