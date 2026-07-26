import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, writeAuditLog } from "@/lib/api-utils";

const lineSchema = z.object({
  jobPhaseId: z.string().optional(),
  type: z.enum(["LABOR", "PART", "SPECIAL_ORDER"]),
  description: z.string().min(1),
  estimatedQuantity: z.number().positive(),
  estimatedUnitCost: z.number().nonnegative(),
});

const createSchema = z.object({
  projectId: z.string().min(1),
  lines: z.array(lineSchema).optional(),
});

export async function GET(req: Request) {
  const { error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK", "TECHNICIAN", "PARTS_MANAGER");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  const estimates = await prisma.projectEstimate.findMany({
    where: projectId ? { projectId } : undefined,
    include: { lines: true, project: { include: { vehicle: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(estimates);
}

export async function POST(req: Request) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  try {
    const body = createSchema.parse(await req.json());
    const estimate = await prisma.projectEstimate.create({
      data: {
        projectId: body.projectId,
        lines: body.lines ? { create: body.lines } : undefined,
      },
      include: { lines: true },
    });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "ProjectEstimate",
      entityId: estimate.id,
      action: "CREATE",
      after: estimate,
    });
    return NextResponse.json(estimate, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
