import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, parsePagination, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  vehicleId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["ESTIMATE", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  shopRateOverride: z.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  targetEndDate: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "PARTS_MANAGER", "TECHNICIAN");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const { take, skip } = parsePagination(searchParams);

  const projects = await prisma.project.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      vehicle: { include: { customer: true } },
      phases: { orderBy: { sequence: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const project = await prisma.project.create({
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        targetEndDate: body.targetEndDate ? new Date(body.targetEndDate) : undefined,
      },
    });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "Project",
      entityId: project.id,
      action: "CREATE",
      after: project,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
