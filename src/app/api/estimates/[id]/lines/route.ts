import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { handleApiError, writeAuditLog } from "@/lib/api-utils";

const createSchema = z.object({
  jobPhaseId: z.string().optional(),
  type: z.enum(["LABOR", "PART", "SPECIAL_ORDER"]),
  description: z.string().min(1),
  estimatedQuantity: z.number().positive(),
  estimatedUnitCost: z.number().nonnegative(),
});

// Estimates are mutable: lines can be added at any time before invoicing.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireRole("ADMIN", "SHOP_MANAGER", "FRONT_DESK");
  if (error) return error;

  const { id } = await params;
  try {
    const body = createSchema.parse(await req.json());
    const line = await prisma.estimateLine.create({ data: { ...body, estimateId: id } });
    await writeAuditLog({
      userId: session!.user.id,
      entityType: "EstimateLine",
      entityId: line.id,
      action: "CREATE",
      after: line,
    });
    return NextResponse.json(line, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
