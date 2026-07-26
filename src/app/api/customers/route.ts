import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, parsePagination, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export async function GET(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;
  void session;

  const { take, skip } = parsePagination(new URL(req.url).searchParams);
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: { vehicles: true },
    take,
    skip,
  });
  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const customer = await prisma.customer.create({ data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Customer",
      entityId: customer.id,
      action: "CREATE",
      after: customer,
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
