import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, parsePagination, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  customerId: z.string().min(1),
  year: z.number().int().optional(),
  make: z.string().min(1),
  model: z.string().min(1),
  vin: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId") ?? undefined;
  const { take, skip } = parsePagination(searchParams);

  const vehicles = await prisma.vehicle.findMany({
    where: customerId ? { customerId } : undefined,
    include: { projects: true },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
  return NextResponse.json(vehicles);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const vehicle = await prisma.vehicle.create({ data: body });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Vehicle",
      entityId: vehicle.id,
      action: "CREATE",
      after: vehicle,
    });
    return NextResponse.json(vehicle, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
